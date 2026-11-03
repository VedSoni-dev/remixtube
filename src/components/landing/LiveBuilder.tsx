"use client";
import { ArrowRight, Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultPrefs, type Prefs } from "@/core/prefs";
import { emptySignals } from "@/core/rank";
import type { DataIndex, Topic } from "@/core/types";
import { sinceStart, track } from "@/lib/analytics";
import { actions } from "@/lib/store";
import { useFeed } from "@/lib/useFeed";
import { useFlip } from "@/lib/useFlip";
import { PlayerProvider, usePlayer } from "../player/PlayerProvider";
import { CardSkeleton, VideoCard } from "../VideoCard";

const SIGNALS = emptySignals();
const PREVIEW = 12;

/** Two of the largest topics from each area, so the first row of chips spans the whole map. */
function starterChips(index: DataIndex): Topic[] {
  const chips = index.topics.filter((t) => t.chip);
  const out: Topic[] = [];
  for (const a of index.areas) {
    out.push(...chips.filter((t) => t.area === a.id).sort((x, y) => y.count - x.count).slice(0, 1));
  }
  return out.sort((a, b) => b.count - a.count);
}

export function LiveBuilder() {
  return (
    <PlayerProvider source="landing">
      <Builder />
    </PlayerProvider>
  );
}

function Builder() {
  const router = useRouter();
  const player = usePlayer();
  const [picked, setPicked] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const started = useRef(false);

  const prefs: Prefs = useMemo(() => {
    const p = defaultPrefs();
    for (const t of picked) p.topics[t] = 2;
    p.serendipity = 0;
    return p;
  }, [picked]);

  const feed = useFeed(prefs, SIGNALS, PREVIEW);
  const index = feed.status === "ready" ? feed.index : null;
  const items = feed.status === "ready" ? feed.items : [];
  const flip = useFlip<HTMLOListElement>(items.map((i) => i.video.id));

  useEffect(() => { sinceStart(); track("landing_view", {}, { oncePerTab: true }); }, []);
  useEffect(() => { if (picked.length >= 3) track("interests_selected", { n: picked.length, source: "landing" }, { oncePerTab: true }); }, [picked.length]);

  const toggle = (id: string) => {
    if (!started.current) { started.current = true; track("builder_started", { source: "landing" }, { oncePerTab: true }); }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 16 ? p : [...p, id]));
  };

  const make = () => {
    const p = defaultPrefs();
    for (const t of picked) p.topics[t] = 2;
    p.seed = (Date.now() % 0xffffffff) >>> 0;
    actions.setPrefs(p, { parent: null });
    router.push("/tube?new=1");
  };

  const names = index ? new Map(index.topics.map((t) => [t.id, t.name])) : new Map<string, string>();
  const shown = index ? (showAll ? null : starterChips(index)) : null;
  const pickedNames = picked.map((t) => names.get(t) ?? t);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(300px,380px)_1fr] lg:gap-14">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="meta">Step 1</p>
        <h2 className="mt-1 font-serif text-[34px] leading-[1.02] tracking-[-0.01em]">Pick a few interests.</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          Every topic comes from the HackerTube data. Three picks are plenty; the grid re-ranks itself from real videos as you tap.
        </p>

        <div className="mt-5" role="group" aria-label="Interests">
          {!index && <div className="flex flex-wrap gap-2" aria-busy="true">{Array.from({ length: 12 }, (_, i) => <span key={i} className="skeleton h-9 w-28 rounded-full" />)}</div>}
          {index && shown && (
            <div className="flex flex-wrap gap-2">
              {[...shown, ...index.topics.filter((t) => picked.includes(t.id) && !shown.some((s) => s.id === t.id))].map((t) => (
                <Chip key={t.id} topic={t} on={picked.includes(t.id)} onClick={() => toggle(t.id)} />
              ))}
            </div>
          )}
          {index && !shown && (
            <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
              {index.areas.map((a) => {
                const ts = index.topics.filter((t) => t.area === a.id && t.chip);
                if (!ts.length) return null;
                return (
                  <div key={a.id}>
                    <p className="meta mb-2">{a.name}</p>
                    <div className="flex flex-wrap gap-2">{ts.map((t) => <Chip key={t.id} topic={t} on={picked.includes(t.id)} onClick={() => toggle(t.id)} />)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {index && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-3 text-[13.5px] font-medium underline underline-offset-4 hover:no-underline">
              {showAll ? "Show fewer topics" : `Browse all ${index.stats.chips} topics`}
            </button>
          )}
        </div>

        <div className="mt-7 border-t border-hair pt-5">
          <p className="meta">Step 2</p>
          <button
            type="button"
            onClick={make}
            disabled={!picked.length}
            className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-paper transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-35"
          >
            Make my Tube <ArrowRight size={17} />
          </button>
          <p className="mt-2 text-[13px] text-muted">{picked.length ? "No account, no questionnaire. Saved in this browser." : "Pick at least one interest to start."}</p>
        </div>
      </div>

      <div>
        <div className="mb-4 flex min-h-[44px] flex-wrap items-end justify-between gap-2" aria-live="polite">
          <p className="max-w-[60ch] text-[14px] leading-snug text-ink-2">
            {feed.status !== "ready" ? "Loading real videos…" : picked.length === 0 ? (
              <>The <span className="font-semibold">12 most-recommended videos</span> across all of HN. Pick an interest and watch them re-rank.</>
            ) : (
              <>Your top 12 from <span className="font-semibold tabular-nums">{feed.pool.toLocaleString("en-US")}</span> videos HN recommended in {pickedNames.slice(0, 3).join(", ")}{pickedNames.length > 3 ? ` and ${pickedNames.length - 3} more` : ""}.</>
            )}
          </p>
          <span className="meta">Live preview</span>
        </div>
        <ol ref={flip} className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
          {feed.status !== "ready" ? <CardSkeleton n={PREVIEW} /> : items.map((r, i) => (
            <li key={r.video.id} data-flip={r.video.id} className="min-w-0">
              <VideoCard video={r.video} reasons={r.reasons} rank={i + 1} priority={i < 4} showActions={false} onOpen={(v) => player.open(v, { queue: items.map((x) => x.video), reasons: r.reasons })} />
            </li>
          ))}
        </ol>
        {feed.status === "error" && <p className="mt-4 text-[14px] text-bad">Couldn’t load the videos. Check your connection and reload.</p>}
        {feed.status === "ready" && picked.length > 0 && (
          <p className="mt-6 text-[13px] text-muted">
            Ranked on this device by {picked.length > 1 ? "how well each video matches your picks" : "topic match"}, how many different HN commenters recommended it, and variety. No AI call, no account.{" "}
            <a href="#ranking" className="underline underline-offset-2">How ranking works</a>
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({ topic, on, onClick }: { topic: Topic; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors ${on ? "border-ink bg-ink text-paper" : "border-hair bg-card text-ink hover:border-ink/40"}`}
    >
      {on ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden className="text-muted" />}
      {topic.name}
      <span className={`font-mono text-[10.5px] tabular-nums ${on ? "text-paper/70" : "text-muted"}`}>{topic.count}</span>
    </button>
  );
}
