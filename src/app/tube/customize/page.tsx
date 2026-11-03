"use client";
import { Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { describeWithKeywords, type Suggestion } from "@/core/describe";
import { cleanName, type Depth, type Prefs, type Serendipity, type TopicWeight } from "@/core/prefs";
import { CONTENT_TYPES, type ContentType } from "@/core/types";
import { AiPanel, useAiConnections } from "@/components/tube/AiPanel";
import { PageHead } from "@/components/tube/Feed";
import { TopicPicker, WEIGHT_LABEL } from "@/components/tube/TopicPicker";
import { describeWithAi, PROVIDERS, type ProviderId } from "@/lib/ai";
import { track } from "@/lib/analytics";
import { actions, useHydrated, useStore } from "@/lib/store";
import { useIndex } from "@/lib/useFeed";

const SER: { v: Serendipity; label: string }[] = [
  { v: 0, label: "Off" }, { v: 1, label: "A little" }, { v: 2, label: "Some" }, { v: 3, label: "Lots" },
];

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="grid gap-4 border-t border-hair py-8 lg:grid-cols-[240px_1fr] lg:gap-10">
      <div>
        <h2 className="font-serif text-[26px] leading-none">{title}</h2>
        {note && <p className="mt-2 text-[13px] text-muted">{note}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function CustomizePage() {
  const hydrated = useHydrated();
  const s = useStore();
  const index = useIndex();
  const p = s.prefs;
  const set = (patch: Partial<Prefs>) => actions.setPrefs({ ...p, ...patch });
  const names = useMemo(() => new Map(index?.topics.map((t) => [t.id, t.name]) ?? []), [index]);

  if (!hydrated || !index) return <div className="skeleton h-96 rounded" />;

  return (
    <div className="max-w-[1080px]">
      <PageHead kicker="Customize" title="Make it yours.">Changes apply instantly and stay in this browser. Shared links carry them too.</PageHead>

      <Section title="Name">
        <input
          defaultValue={p.name}
          maxLength={48}
          placeholder="My Tube"
          aria-label="Tube name"
          onBlur={(e) => set({ name: cleanName(e.target.value) })}
          className="h-11 w-full max-w-md rounded-[4px] border border-hair bg-card px-3 text-[16px] outline-none focus:border-ink"
        />
      </Section>

      <Section title="Describe it" note="Type what you’re in the mood for. Keyword matching runs here with no AI; a connected model can do it too.">
        <Describe onApply={(sug, mode) => {
          const topics = mode === "replace" ? sug.topics : { ...p.topics, ...sug.topics };
          set({ topics: Object.fromEntries(Object.entries(topics).slice(0, 16)) as Record<string, TopicWeight>, formats: { ...p.formats, ...sug.formats }, depth: sug.depth ?? p.depth, name: p.name || cleanName(sug.name ?? "") });
          track("interests_selected", { n: Object.keys(topics).length, source: "describe" });
        }} />
      </Section>

      <Section title="Interests" note="Curious, into it, obsessed: stronger topics take more of your feed.">
        {Object.keys(p.topics).length > 0 && (
          <ul className="mb-6 divide-y divide-hair border-y border-hair">
            {Object.entries(p.topics).map(([id, w]) => (
              <li key={id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 text-[15px] font-medium">{names.get(id) ?? id}</span>
                <div className="flex rounded-full border border-hair p-0.5" role="radiogroup" aria-label={`How much ${names.get(id) ?? id}`}>
                  {([1, 2, 3] as const).map((x) => (
                    <button key={x} type="button" role="radio" aria-checked={w === x} onClick={() => set({ topics: { ...p.topics, [id]: x } })} className={`h-8 rounded-full px-3 text-[12.5px] ${w === x ? "bg-ink text-paper" : "text-ink-2"}`}>{WEIGHT_LABEL[x]}</button>
                  ))}
                </div>
                <button type="button" aria-label={`Remove ${names.get(id) ?? id}`} onClick={() => { const t = { ...p.topics }; delete t[id]; set({ topics: t }); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2"><X size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        <TopicPicker index={index} value={p.topics} onChange={(topics) => set({ topics })} compact />
      </Section>

      <Section title="Formats" note="More or less of a kind of video. Labels come from the HackerTube data.">
        <div className="grid gap-2 sm:grid-cols-2">
          {CONTENT_TYPES.filter((t) => t !== "other" && t !== "news").map((ty) => {
            const v = p.formats[ty] ?? 0;
            const choose = (n: -1 | 0 | 1) => { const f = { ...p.formats }; if (n === 0) delete f[ty]; else f[ty] = n; set({ formats: f }); };
            return (
              <div key={ty} className="flex items-center justify-between gap-3 rounded-[4px] border border-hair bg-card px-3 py-2">
                <span className="text-[14.5px] capitalize">{ty}</span>
                <div className="flex rounded-full border border-hair p-0.5" role="radiogroup" aria-label={`${ty} videos`}>
                  {([[-1, "Less"], [0, "Normal"], [1, "More"]] as [-1 | 0 | 1, string][]).map(([n, label]) => (
                    <button key={n} type="button" role="radio" aria-checked={v === n} onClick={() => choose(n)} className={`h-7 rounded-full px-2.5 text-[12px] ${v === n ? "bg-ink text-paper" : "text-ink-2"}`}>{label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Depth & surprise">
        <fieldset>
          <legend className="text-[14px] font-semibold">Depth</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["any", "intro", "deep"] as Depth[]).map((d) => (
              <button key={d} type="button" aria-pressed={p.depth === d} onClick={() => set({ depth: d })} className={`h-9 rounded-full border px-4 text-[13.5px] ${p.depth === d ? "border-ink bg-ink text-paper" : "border-hair bg-card"}`}>
                {d === "any" ? "Any" : d === "intro" ? "Beginner-friendly" : "Deep and technical"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">A light nudge: most videos in the data are labeled “general”.</p>
        </fieldset>
        <fieldset className="mt-6">
          <legend className="text-[14px] font-semibold">Serendipity</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SER.map(({ v, label }) => (
              <button key={v} type="button" aria-pressed={p.serendipity === v} onClick={() => set({ serendipity: v })} className={`h-9 rounded-full border px-4 text-[13.5px] ${p.serendipity === v ? "border-ink bg-ink text-paper" : "border-hair bg-card"}`}>{label}</button>
            ))}
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">How often an HN favourite from outside your interests slips in, and how much the order varies.</p>
        </fieldset>
        <label className="mt-6 flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={p.news} onChange={(e) => set({ news: e.target.checked })} /> Include videos that only mattered around one news event
        </label>
      </Section>

      <Section title="Thumbnails">
        <div className="flex flex-wrap gap-2">
          {(["creator", "frame"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={s.thumbs === t} onClick={() => actions.setThumbs(t)} className={`h-9 rounded-full border px-4 text-[13.5px] ${s.thumbs === t ? "border-ink bg-ink text-paper" : "border-hair bg-card"}`}>
              {t === "creator" ? "Uploader’s thumbnail" : "A frame from mid-video"}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">Mid-video frames skip clickbait thumbnails, the way HackerTube does it.</p>
      </Section>

      <Section title="AI (optional)">
        <AiPanel onChange={() => {}} />
      </Section>

      <Section title="Your data" note="Prefs, likes, saves and history live only in this browser’s storage.">
        <button type="button" onClick={() => { if (window.confirm("Reset your Tube, likes, saves and history in this browser?")) { actions.resetAll(); window.location.assign("/tube"); } }} className="h-10 rounded-full border border-bad/50 px-4 text-[13.5px] font-medium text-bad">
          Reset everything
        </button>
      </Section>
    </div>
  );
}

function Describe({ onApply }: { onApply: (s: Suggestion, mode: "add" | "replace") => void }) {
  const index = useIndex();
  const { connected } = useAiConnections();
  const [text, setText] = useState("");
  const [via, setVia] = useState<"keywords" | ProviderId>("keywords");
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const names = new Map(index?.topics.map((t) => [t.id, t.name]) ?? []);

  const run = async () => {
    if (!index || !text.trim()) return;
    setErr(null); setSug(null);
    if (via === "keywords") {
      const s = describeWithKeywords(text, index);
      if (!Object.keys(s.topics).length) setErr("No topics matched those words. Try naming subjects, like “compilers”, “space history” or “woodworking”.");
      else setSug(s);
      return;
    }
    setBusy(true);
    try { setSug(await describeWithAi(via, text, index)); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={600}
        rows={3}
        placeholder="Deep technical talks on databases and distributed systems, plus space history documentaries. No comedy."
        aria-label="Describe what you want to watch"
        className="w-full rounded-[4px] border border-hair bg-card p-3 text-[15px] outline-none focus:border-ink"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13.5px]">Using
          <select value={via} onChange={(e) => setVia(e.target.value as typeof via)} className="h-9 rounded-full border border-hair bg-card px-3">
            <option value="keywords">Keywords (no AI)</option>
            {connected.map((p) => <option key={p} value={p}>{PROVIDERS[p].name}</option>)}
          </select>
        </label>
        <button type="button" onClick={run} disabled={busy || !text.trim()} className="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-paper disabled:opacity-40">
          <Sparkles size={14} aria-hidden /> {busy ? "Thinking…" : "Suggest topics"}
        </button>
      </div>
      {err && <p role="alert" className="mt-3 text-[13.5px] text-bad">{err}</p>}
      {sug && (
        <div className="mt-4 rounded-[4px] border border-ink bg-card p-4">
          <p className="meta">{sug.via === "ai" ? "Suggested by your model, checked against the real topic list" : "Matched from topic names and descriptions"}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Object.entries(sug.topics).map(([id, w]) => <li key={id} className="rounded-full bg-paper-2 px-3 py-1 text-[13px]">{names.get(id)} · {WEIGHT_LABEL[w]}</li>)}
            {(Object.entries(sug.formats) as [ContentType, number][]).map(([ty, v]) => <li key={ty} className="rounded-full border border-hair px-3 py-1 text-[13px]">{v > 0 ? "More" : "Less"} {ty}</li>)}
            {sug.depth && sug.depth !== "any" && <li className="rounded-full border border-hair px-3 py-1 text-[13px]">{sug.depth === "intro" ? "Beginner-friendly" : "Deep"}</li>}
          </ul>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { onApply(sug, "add"); setSug(null); setText(""); }} className="h-9 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-paper">Add to my Tube</button>
            <button type="button" onClick={() => { onApply(sug, "replace"); setSug(null); setText(""); }} className="h-9 rounded-full border border-ink px-4 text-[13.5px] font-semibold">Replace my interests</button>
          </div>
        </div>
      )}
    </div>
  );
}
