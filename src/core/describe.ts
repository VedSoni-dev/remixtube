// "Describe your Tube in words" without any AI: match the text against the taxonomy's
// own names and synonym-rich descriptions. AI providers, when connected, return the same shape.
import type { Depth, TopicWeight } from "./prefs";
import type { ContentType, DataIndex } from "./types";

export interface Suggestion {
  topics: Record<string, TopicWeight>;
  formats: Partial<Record<ContentType, 1 | -1>>;
  depth: Depth | null;
  name: string | null;
  via: "keywords" | "ai";
  matched: { id: string; terms: string[] }[];
}

const STOP = new Set("a an and are as at be but by for from have i in into is it its like love me my of on or so some stuff that the things this to want watch videos video with about more less no not any good great really very".split(" "));

export function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokens(s: string): string[] {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9+#]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

const FORMAT_WORDS: Record<string, ContentType> = {
  talk: "talk", lecture: "lecture", course: "course", documentary: "documentary", doc: "documentary", explainer: "explainer",
  interview: "interview", podcast: "podcast", tutorial: "tutorial", demo: "demo", comedy: "comedy", funny: "comedy", music: "music", commentary: "commentary",
};

export function describeWithKeywords(text: string, index: DataIndex, limit = 6): Suggestion {
  const raw = text.slice(0, 600);
  const q = tokens(raw);
  const out: Suggestion = { topics: {}, formats: {}, depth: null, name: null, via: "keywords", matched: [] };
  if (!q.length) return out;

  // Formats, with simple negation: "no comedy", "not music", "less podcasts".
  const words = raw.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  words.forEach((w, i) => {
    const ty = FORMAT_WORDS[stem(w)];
    if (!ty) return;
    const prev = words.slice(Math.max(0, i - 2), i);
    out.formats[ty] = prev.some((p) => p === "no" || p === "not" || p === "less" || p === "without" || p === "skip") ? -1 : 1;
  });
  const noDeepLearning = raw.replace(/deep[\s-]+(learning|neural|net)/gi, "");
  if (/\b(beginner|intro|introduct|basics|newbie|eli5|gentle)/i.test(raw)) out.depth = "intro";
  else if (/\b(advanced|deep|in-depth|technical|expert|hardcore)/i.test(noDeepLearning)) out.depth = "deep";

  // Words that name a format, follow a negation, or only describe depth never pick topics.
  const formatStems = new Set(Object.keys(FORMAT_WORDS));
  const skip = new Set<string>();
  words.forEach((w, i) => {
    if (["no", "not", "without", "skip", "less"].includes(w) && words[i + 1]) skip.add(stem(words[i + 1]!));
  });
  const depthWords = new Set(["deep", "technical", "advanced", "beginner", "intro", "basic", "expert", "hardcore", "gentle"].map(stem));
  const queryWords = [...new Set(q)].filter((w) => !formatStems.has(w) && !skip.has(w) && !depthWords.has(w));

  // Inverse document frequency over the chip topics: rare words are strong signals.
  const chips = index.topics.filter((t) => t.chip);
  const docs = chips.map((t) => ({ t, name: new Set(tokens(t.name)), desc: new Set(tokens(t.description)) }));
  const idf = (w: string) => {
    const df = docs.filter((d) => d.name.has(w) || d.desc.has(w)).length;
    return df ? Math.log(1 + docs.length / df) : 0;
  };
  const scored: { id: string; score: number; terms: string[] }[] = [];
  for (const d of docs) {
    let score = 0;
    const terms: string[] = [];
    for (const w of queryWords) {
      if (w.length < 3 && !/^(ai|ml|os|ui|ux|vr|ar|3d|c#|c\+\+)$/.test(w)) continue;
      if (d.name.has(w)) { score += 3 * idf(w); terms.push(w); } else if (d.desc.has(w)) { score += idf(w); terms.push(w); }
    }
    // Phrase bonus: two consecutive query words appearing together in the description.
    const desc = d.t.description.toLowerCase();
    for (let i = 0; i + 1 < q.length; i++) if (desc.includes(`${q[i]} ${q[i + 1]}`)) score += 2;
    if (score >= 3) scored.push({ id: d.t.id, score, terms });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const best = scored[0]?.score ?? 0;
  const top = scored.filter((s) => s.score >= best * 0.3).slice(0, limit);
  for (const s of top) {
    out.topics[s.id] = s.score >= best * 0.8 ? 3 : s.score >= best * 0.5 ? 2 : 1;
    out.matched.push({ id: s.id, terms: s.terms });
  }
  return out;
}

/** Validates an AI provider's JSON answer against the real taxonomy. Unknown ids are dropped. */
export function parseAiSuggestion(raw: string, index: DataIndex): Suggestion | null {
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) return null;
  let o: unknown;
  try { o = JSON.parse(m[0]); } catch { return null; }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const known = new Map(index.topics.filter((t) => t.chip).map((t) => [t.id, t]));
  const out: Suggestion = { topics: {}, formats: {}, depth: null, name: null, via: "ai", matched: [] };
  if (Array.isArray(r.topics)) {
    for (const x of r.topics.slice(0, 8)) {
      const id = typeof x === "string" ? x : x && typeof x === "object" ? (x as { id?: unknown }).id : null;
      const w = x && typeof x === "object" ? (x as { weight?: unknown }).weight : 2;
      if (typeof id === "string" && known.has(id)) {
        out.topics[id] = w === 1 || w === 3 ? w : 2;
        out.matched.push({ id, terms: [] });
      }
    }
  }
  if (r.formats && typeof r.formats === "object") {
    for (const [k, v] of Object.entries(r.formats as Record<string, unknown>)) {
      if (Object.values(FORMAT_WORDS).includes(k as ContentType) && (v === 1 || v === -1)) out.formats[k as ContentType] = v;
    }
  }
  if (r.depth === "intro" || r.depth === "deep" || r.depth === "any") out.depth = r.depth;
  if (typeof r.name === "string") out.name = r.name.slice(0, 48);
  return Object.keys(out.topics).length ? out : null;
}

export function aiPrompt(text: string, index: DataIndex): { system: string; user: string } {
  const list = index.topics.filter((t) => t.chip).map((t) => `${t.id}: ${t.name}`).join("\n");
  return {
    system:
      "You map a person's description of what they like to watch onto a fixed list of topic ids. Reply with JSON only: " +
      '{"topics":[{"id":"<topic id>","weight":1|2|3}],"formats":{"talk":1,"comedy":-1},"depth":"any"|"intro"|"deep","name":"<short title for their feed>"}. ' +
      "Use 2 to 6 topic ids, copied exactly from the list. Weight 3 means central, 1 means a side interest. Formats are optional; allowed keys: talk, lecture, course, documentary, explainer, interview, podcast, tutorial, demo, commentary, comedy, music.",
    user: `Topics:\n${list}\n\nDescription: ${text.slice(0, 600)}`,
  };
}
