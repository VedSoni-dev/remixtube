// Normalises a source bundle into the small static files the app serves.
// Pure and deterministic: same bundle in, byte-identical files out.
import { createHash } from "node:crypto";
import { detailBucket, DETAIL_BUCKETS, topicCode } from "../core/hash";
import type {
  Area, DataIndex, Mention, RelatedRef, Shard, Stance, Topic, VideoDetail, VideoLite,
} from "../core/types";
import type { UpstreamMention, UpstreamVideo } from "./schema";
import type { SourceAdapter, SourceBundle } from "./sources";

export const FILTERS = {
  minRecommenders: 1, // at least one HN comment actually recommends it
  requireNetPositive: true, // recommendations must outnumber jokes + criticism
  dedupeByNormalizedTitle: true, // same talk uploaded twice: keep the better-scored one
  minDedupeTitleLength: 12,
  provenancePerVideo: 8,
  excerptChars: 600,
  quoteChars: 220,
  chipMinVideos: 15,
  similarPerVideo: 8,
  corecPerVideo: 8,
  staples: 300,
} as const;

const STANCE_ORDER: Record<Stance, number> = { strong_rec: 0, rec: 1, reference: 2, critical: 3, joke: 4 };

export interface BuildReport {
  source: string;
  exported: string;
  zip_sha256: string;
  input: { videos: number; mentions: number; related: number; topics: number };
  dropped: { duplicate_ids: number; no_recommenders: number; net_negative: number; duplicate_titles: number; no_categories: number; unknown_categories: number; orphan_mentions: number; unverified_quotes: number };
  output: { videos: number; mentions: number; topics: number; chips: number; files: number; bytes: number };
  duplicate_title_examples: { kept: string; dropped: string; title: string }[];
}

export interface BuildResult {
  files: Map<string, string>; // relative path -> contents
  report: BuildReport;
  index: DataIndex;
  videos: VideoLite[];
}

export function normalizeTitle(t: string): string {
  return t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clip(s: string, n: number): { text: string; cut: boolean } {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= n) return { text: clean, cut: false };
  const cutAt = clean.lastIndexOf(" ", n);
  return { text: `${clean.slice(0, cutAt > n * 0.6 ? cutAt : n).trimEnd()}…`, cut: true };
}

function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function cmpId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function buildCatalog(bundle: SourceBundle, adapter: SourceAdapter, zipSha256: string): BuildResult {
  const report: BuildReport = {
    source: adapter.id,
    exported: bundle.exported,
    zip_sha256: zipSha256,
    input: { videos: bundle.videos.length, mentions: bundle.mentions.length, related: bundle.related.length, topics: 0 },
    dropped: { duplicate_ids: 0, no_recommenders: 0, net_negative: 0, duplicate_titles: 0, no_categories: 0, unknown_categories: 0, orphan_mentions: 0, unverified_quotes: 0 },
    output: { videos: 0, mentions: 0, topics: 0, chips: 0, files: 0, bytes: 0 },
    duplicate_title_examples: [],
  };

  // Taxonomy -> topics and areas.
  const topicMeta = new Map<string, { name: string; area: string; description: string }>();
  for (const a of bundle.taxonomy.areas) {
    for (const c of a.categories) {
      if (topicMeta.has(c.id)) throw new Error(`taxonomy: duplicate category id ${c.id}`);
      topicMeta.set(c.id, { name: c.name, area: a.id, description: c.description });
    }
  }
  report.input.topics = topicMeta.size;
  const codes = new Map<string, string>();
  for (const id of topicMeta.keys()) {
    const code = topicCode(id);
    if (codes.has(code)) throw new Error(`topic code collision: ${id} and ${codes.get(code)} -> ${code}`);
    codes.set(code, id);
  }

  // Mentions per video, stance counts.
  const mentionsByVid = new Map<string, UpstreamMention[]>();
  const seenMention = new Set<string>();
  for (const m of bundle.mentions) {
    const key = `${m.hn_comment_id}:${m.vid}`;
    if (seenMention.has(key)) continue;
    seenMention.add(key);
    let list = mentionsByVid.get(m.vid);
    if (!list) mentionsByVid.set(m.vid, (list = []));
    list.push(m);
  }

  // Dedupe by id (keep first: upstream is best-scored first), then filter.
  const byId = new Map<string, UpstreamVideo>();
  for (const v of bundle.videos) {
    if (byId.has(v.vid)) { report.dropped.duplicate_ids++; continue; }
    byId.set(v.vid, v);
  }

  const candidates: { v: UpstreamVideo; lite: VideoLite }[] = [];
  for (const v of byId.values()) {
    if (v.hn.recommenders < FILTERS.minRecommenders) { report.dropped.no_recommenders++; continue; }
    const st = v.hn.stances;
    const rc = (st.rec ?? 0) + (st.strong_rec ?? 0);
    const cr = (st.critical ?? 0) + (st.joke ?? 0);
    if (FILTERS.requireNetPositive && rc < cr) { report.dropped.net_negative++; continue; }
    const k: string[] = [];
    for (const c of v.categories) {
      const meta = topicMeta.get(c.id);
      if (!meta || meta.area !== c.area) { report.dropped.unknown_categories++; continue; }
      if (!k.includes(c.id)) k.push(c.id);
    }
    if (!k.length) { report.dropped.no_categories++; continue; }
    // Keep the pull quote only if it really occurs in the comment it cites.
    let q: string | undefined;
    let qi: number | undefined;
    if (v.quote?.text) {
      const src = (mentionsByVid.get(v.vid) ?? []).find((m) => m.hn_comment_id === v.quote!.hn_comment_id);
      if (src && squash(src.text).includes(squash(v.quote.text))) {
        q = clip(v.quote.text, FILTERS.quoteChars).text;
        qi = src.hn_comment_id;
      } else report.dropped.unverified_quotes++;
    }
    const lite: VideoLite = {
      id: v.vid, t: v.title.trim(), c: v.channel.trim(), k,
      ty: v.content_type, lv: v.level, sl: v.shelf_life,
      s: v.score, r: v.hn.recommenders, m: v.hn.mentions, rc, sr: v.hn.strong_recs, cr,
      y0: v.hn.first_year, y1: v.hn.last_year,
      ...(q ? { q, qi } : {}),
    };
    candidates.push({ v, lite });
  }

  // Duplicate uploads of the same talk: keep the better-scored one.
  candidates.sort((a, b) => b.lite.s - a.lite.s || b.lite.r - a.lite.r || cmpId(a.lite.id, b.lite.id));
  const titleSeen = new Map<string, string>();
  const kept: typeof candidates = [];
  for (const c of candidates) {
    const nt = normalizeTitle(c.lite.t);
    if (FILTERS.dedupeByNormalizedTitle && nt.length >= FILTERS.minDedupeTitleLength) {
      const prev = titleSeen.get(nt);
      if (prev) {
        report.dropped.duplicate_titles++;
        if (report.duplicate_title_examples.length < 15) report.duplicate_title_examples.push({ kept: prev, dropped: c.lite.id, title: c.lite.t });
        continue;
      }
      titleSeen.set(nt, c.lite.id);
    }
    kept.push(c);
  }
  const videos = kept.map((c) => c.lite);
  const keptIds = new Set(videos.map((v) => v.id));
  const liteById = new Map(videos.map((v) => [v.id, v]));
  for (const m of bundle.mentions) if (!byId.has(m.vid)) report.dropped.orphan_mentions++;

  // Topic and area counts.
  const topicVideos = new Map<string, VideoLite[]>();
  for (const id of topicMeta.keys()) topicVideos.set(id, []);
  for (const v of videos) for (const t of v.k) topicVideos.get(t)!.push(v);

  const topics: Topic[] = [];
  for (const [id, meta] of topicMeta) {
    const list = topicVideos.get(id)!;
    const usable = list.filter((v) => v.sl !== "news").length;
    topics.push({
      id, code: topicCode(id), name: meta.name, area: meta.area, description: meta.description,
      count: usable,
      chip: usable >= FILTERS.chipMinVideos && !id.endsWith("-other"),
    });
  }
  const areas: Area[] = bundle.taxonomy.areas.map((a) => {
    const ids = new Set<string>();
    for (const c of a.categories) for (const v of topicVideos.get(c.id) ?? []) if (v.sl !== "news") ids.add(v.id);
    return { id: a.id, name: a.name, topics: a.categories.map((c) => c.id), count: ids.size };
  });

  // Provenance details.
  const details = new Map<string, VideoDetail>();
  let mentionsOut = 0;
  for (const c of kept) {
    const ms = (mentionsByVid.get(c.v.vid) ?? []).slice().sort((a, b) =>
      STANCE_ORDER[a.stance] - STANCE_ORDER[b.stance] || (a.month < b.month ? 1 : a.month > b.month ? -1 : 0) || a.hn_comment_id - b.hn_comment_id);
    const chosen = ms.slice(0, FILTERS.provenancePerVideo);
    const mentions: Mention[] = chosen.map((m) => {
      const ex = clip(m.text, FILTERS.excerptChars);
      return {
        id: m.hn_comment_id, a: m.author, mo: m.month, st: m.stance, story: m.story_title,
        q: m.quote, w: m.why, x: ex.text, cut: ex.cut || m.text.length >= 1500,
      };
    });
    mentionsOut += mentions.length;
    details.set(c.v.vid, {
      v: c.lite,
      sum: c.v.summary, why: c.v.why_hn, tags: c.v.tags.map((t) => t.toLowerCase().trim()).filter((t, i, arr) => t && arr.indexOf(t) === i),
      topic: c.v.primary_topic, mentions, more: Math.max(0, ms.length - mentions.length),
      corec: [], similar: [],
    });
  }

  const ref = (id: string, n?: number): RelatedRef => {
    const v = liteById.get(id)!;
    return n ? { id, t: v.t, c: v.c, n } : { id, t: v.t, c: v.c };
  };
  for (const r of bundle.related) {
    const d = details.get(r.vid);
    if (!d) continue;
    d.corec = r.related.filter((x) => keptIds.has(x.vid) && x.vid !== r.vid)
      .sort((a, b) => b.shared_recommenders - a.shared_recommenders || cmpId(a.vid, b.vid))
      .slice(0, FILTERS.corecPerVideo).map((x) => ref(x.vid, x.shared_recommenders));
  }

  // Similar videos from the published embeddings (vectors themselves are not shipped).
  if (bundle.embeddings) {
    const { ids, cols, data } = bundle.embeddings;
    const rowsKept: number[] = [];
    ids.forEach((id, i) => { if (keptIds.has(id)) rowsKept.push(i); });
    const n = rowsKept.length;
    const mat = new Float32Array(n * cols);
    rowsKept.forEach((row, j) => {
      let norm = 0;
      for (let d = 0; d < cols; d++) norm += data[row * cols + d]! ** 2;
      const inv = norm > 0 ? 1 / Math.sqrt(norm) : 0;
      for (let d = 0; d < cols; d++) mat[j * cols + d] = data[row * cols + d]! * inv;
    });
    const K = FILTERS.similarPerVideo;
    for (let a = 0; a < n; a++) {
      const topS = new Float32Array(K).fill(-2);
      const topI = new Int32Array(K).fill(-1);
      const aOff = a * cols;
      for (let b = 0; b < n; b++) {
        if (b === a) continue;
        const bOff = b * cols;
        let s = 0;
        for (let d = 0; d < cols; d++) s += mat[aOff + d]! * mat[bOff + d]!;
        if (s > topS[K - 1]!) {
          let p = K - 1;
          while (p > 0 && s > topS[p - 1]!) { topS[p] = topS[p - 1]!; topI[p] = topI[p - 1]!; p--; }
          topS[p] = s; topI[p] = b;
        }
      }
      const id = ids[rowsKept[a]!]!;
      details.get(id)!.similar = Array.from(topI).filter((i) => i >= 0).map((i) => ref(ids[rowsKept[i]!]!));
    }
  }

  // Index.
  const recommenders = new Set<string>();
  let sourceRecs = 0;
  for (const m of bundle.mentions) {
    if (m.stance === "rec" || m.stance === "strong_rec") {
      sourceRecs++;
      if (keptIds.has(m.vid)) recommenders.add(m.author);
    }
  }
  const index: DataIndex = {
    version: 1,
    source: {
      id: adapter.id, name: adapter.name, url: adapter.homepage, data_url: adapter.dataUrl,
      zip_sha256: zipSha256, exported: bundle.exported,
      license: adapter.license.id, license_url: adapter.license.url, attribution: adapter.license.attribution,
    },
    stats: {
      source_videos: bundle.videos.length,
      source_mentions: bundle.mentions.length,
      source_recommendations: sourceRecs,
      videos: videos.length,
      mentions: mentionsOut,
      recommenders: recommenders.size,
      first_year: Math.min(...videos.map((v) => v.y0)),
      last_year: Math.max(...videos.map((v) => v.y1)),
      areas: areas.length,
      topics: topics.length,
      chips: topics.filter((t) => t.chip).length,
      max_score: Math.max(...videos.map((v) => v.s)),
      max_recommenders: Math.max(...videos.map((v) => v.r)),
    },
    filters: { ...FILTERS },
    areas,
    topics,
  };

  // Files.
  const files = new Map<string, string>();
  const byScore = (a: VideoLite, b: VideoLite) => b.s - a.s || b.r - a.r || cmpId(a.id, b.id);
  files.set("index.json", stableJson(index));
  for (const t of topics) {
    const shard: Shard = { id: t.id, videos: topicVideos.get(t.id)!.slice().sort(byScore) };
    files.set(`t/${t.id}.json`, stableJson(shard));
  }
  for (const a of areas) {
    const seen = new Set<string>();
    const list: VideoLite[] = [];
    for (const t of a.topics) for (const v of topicVideos.get(t) ?? []) if (!seen.has(v.id)) { seen.add(v.id); list.push(v); }
    files.set(`a/${a.id}.json`, stableJson({ id: a.id, videos: list.sort(byScore) } satisfies Shard));
  }
  // Staples: the best overall, with every area represented.
  const staples = new Map<string, VideoLite>();
  for (const v of videos.slice().sort(byScore).filter((v) => v.sl !== "news").slice(0, FILTERS.staples)) staples.set(v.id, v);
  for (const a of areas) {
    const best = videos.filter((v) => v.sl !== "news" && v.k.some((t) => topicMeta.get(t)?.area === a.id)).sort(byScore).slice(0, 10);
    for (const v of best) staples.set(v.id, v);
  }
  files.set("staples.json", stableJson({ id: "staples", videos: [...staples.values()].sort(byScore) } satisfies Shard));

  const buckets: Record<string, VideoDetail>[] = Array.from({ length: DETAIL_BUCKETS }, () => ({}));
  for (const id of [...details.keys()].sort(cmpId)) buckets[detailBucket(id)]![id] = details.get(id)!;
  buckets.forEach((b, i) => files.set(`d/${i}.json`, stableJson(b)));

  // Manifest with per-video content hashes, for incremental updates and diffs.
  const videoHashes: Record<string, string> = {};
  for (const v of videos.slice().sort((a, b) => cmpId(a.id, b.id))) {
    videoHashes[v.id] = createHash("sha256").update(stableJson(v)).update(stableJson(details.get(v.id))).digest("hex").slice(0, 16);
  }
  const fileHashes: Record<string, { sha256: string; bytes: number }> = {};
  let bytes = 0;
  for (const [p, body] of [...files.entries()].sort((a, b) => cmpId(a[0], b[0]))) {
    const b = Buffer.byteLength(body);
    bytes += b;
    fileHashes[p] = { sha256: createHash("sha256").update(body).digest("hex"), bytes: b };
  }
  files.set("manifest.json", stableJson({ version: 1, source: adapter.id, exported: bundle.exported, zip_sha256: zipSha256, files: fileHashes, videos: videoHashes }));

  report.output = { videos: videos.length, mentions: mentionsOut, topics: topics.length, chips: index.stats.chips, files: files.size, bytes };
  return { files, report, index, videos };
}

export interface CatalogDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export function diffManifests(prev: { videos: Record<string, string> } | null, next: { videos: Record<string, string> }): CatalogDiff {
  const d: CatalogDiff = { added: [], removed: [], changed: [] };
  if (!prev) { d.added = Object.keys(next.videos); return d; }
  for (const [id, h] of Object.entries(next.videos)) {
    if (!(id in prev.videos)) d.added.push(id);
    else if (prev.videos[id] !== h) d.changed.push(id);
  }
  for (const id of Object.keys(prev.videos)) if (!(id in next.videos)) d.removed.push(id);
  return d;
}
