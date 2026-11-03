"use client";
import { ArrowRight, Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultPrefs, MAX_TOPICS, type Prefs } from "@/core/prefs";
import { emptySignals, type Ranked } from "@/core/rank";
import { autoName, poolLine, starterChips } from "@/core/catalog";
import type { Topic } from "@/core/types";
import { sinceStart, track } from "@/lib/analytics";
import { actions } from "@/lib/store";
import { useFeed } from "@/lib/useFeed";
import { useFlip } from "@/lib/useFlip";
import { PlayerProvider, usePlayer } from "../player/PlayerProvider";
import { CardSkeleton, VideoCard } from "../VideoCard";

const SIGNALS = emptySignals();
const PREVIEW = 12;

export interface BuilderInitial {
  items: Ranked[]; // the no-interest ranking, computed on the server so real videos arrive with the HTML
  chips: Topic[];
  chipCount: number;
}

export function LiveBuilder({ initial }: { initial: BuilderInitial }) {
  return (
    <PlayerProvider source="landing">
      <Builder initial={initial} />
    </PlayerProvider>
  );
}

function Builder({ initial }: { initial: BuilderInitial }) {
  const router = useRouter();
  const player = usePlayer();
  const [picked, setPicked] = useState<string[]>([]);
  const [names, setNames] = useState<Map<string, string>>(() => new Map(initial.chips.map((t) => [t.id, t.name])));
  const [showAll, setShowAll] = useState(false);
  const started = useRef(false);

  // The preview ranks with exactly the prefs "Make my Tube" saves, so what you see is what you get.
  const prefs: Prefs = useMemo(() => {
    const p = defaultPrefs();
    for (const t of picked) p.topics[t] = 2;
    p.name = autoName(picked, names);
    return p;
  }, [picked, names]);

  const feed = useFeed(prefs, SIGNALS, PREVIEW);
  const index = feed.status === "ready" ? feed.index : null;
  useEffect(() => { if (index) setNames(new Map(index.topics.map((t) => [t.id, t.name]))); }, [index]);
  const items = feed.status === "ready" ? feed.items : picked.length === 0 ? initial.items : [];
  const showGrid = feed.status === "ready" || picked.length === 0;
  const flip = useFlip<HTMLOListElement>(items.map((i) => i.video.id));

  useEffect(() => { sinceStart(); track("landing_view", {}, { oncePerTab: true }); }, []);
  useEffect(() => { if (picked.length >= 3) track("interests_selected", { n: picked.length, source: "landing" }, { oncePerTab: true }); }, [picked.length]);

  const toggle = (id: string) => {
    if (!started.current) { started.current = true; track("builder_started", { source: "landing" }, { oncePerTab: true }); }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_TOPICS ? p : [...p, id]));
  };
  const full = picked.length >= MAX_TOPICS;

  const make = () => {
    actions.setPrefs(prefs, { parent: null, archive: true });
    router.push("/tube?new=1");
  };

  const shown = showAll && index ? null : index ? starterChips(index) : initial.chips;
  const pickedNames = picked.map((t) => names.get(t) ?? t);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(300px,380px)_1fr] lg:gap-14">
      <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <p className="meta">Step 1</p>
        <h2 className="mt-1 font-serif text-[2.125rem] leading-[1.02] tracking-[-0.01em]">Pick a few interests.</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          Every topic comes from the HackerTube data. Three picks are plenty; the grid re-ranks itself from real videos as you tap.
        </p>

        <div className="mt-5" role="group" aria-label="Interests">
          {shown && (
            <div className="no-scrollbar -mx-4 grid auto-cols-max grid-flow-col grid-rows-2 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex sm:flex-wrap sm:overflow-visible sm:px-0">
              {[...shown, ...(index?.topics ?? []).filter((t) => picked.includes(t.id) && !shown.some((s) => s.id === t.id))].map((t) => (
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
          <button type="button" disabled={!index} onClick={() => setShowAll((s) => !s)} className="mt-3 text-[0.8438rem] font-medium underline underline-offset-4 hover:no-underline disabled:opacity-50">
            {showAll ? "Show fewer topics" : `Browse all ${initial.chipCount} topics`}
          </button>
        </div>

        <div className={`mt-7 border-t border-hair pt-5 ${picked.length ? "hidden lg:block" : ""}`}>
          <p className="meta">Step 2</p>
          <button
            type="button"
            onClick={make}
            disabled={!picked.length}
            className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[0.9375rem] font-semibold text-paper transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-35"
          >
            Make my Tube <ArrowRight size={17} />
          </button>
          <p className="mt-2 text-[0.8125rem] text-muted">{full ? `That’s the limit: ${MAX_TOPICS} topics.` : picked.length ? "No account, no questionnaire. Your Tube is kept in this browser." : "Pick at least one interest to start."}</p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex min-h-[44px] flex-wrap items-end justify-between gap-2" aria-live="polite">
          <p className="max-w-[60ch] text-[0.875rem] leading-snug text-ink-2">
            {picked.length === 0 ? (
              <>HN’s <span className="font-semibold">12 all-time favourites</span>, by how many months people kept recommending them. Pick an interest and watch them re-rank.</>
            ) : feed.status !== "ready" ? "Ranking…" : (
              <>{poolLine(items.length, feed.pool, picked.length)} <span className="text-muted">({pickedNames.slice(0, 3).join(", ")}{pickedNames.length > 3 ? ` +${pickedNames.length - 3}` : ""})</span></>
            )}
          </p>
          <span className="meta">Live preview</span>
        </div>
        <ol ref={flip} className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
          {!showGrid ? <CardSkeleton n={PREVIEW} /> : items.map((r, i) => (
            <li key={r.video.id} data-flip={r.video.id} className="min-w-0">
              <VideoCard video={r.video} reasons={r.reasons} rank={i + 1} priority={i < 4} showActions={false} onOpen={(v) => player.open(v, { queue: items.map((x) => x.video), reasons: r.reasons })} />
            </li>
          ))}
        </ol>
        {feed.status === "error" && <p className="mt-4 text-[0.875rem] text-bad">Couldn’t load the videos. Check your connection and reload.</p>}
        {picked.length > 0 && (
          <div className="sticky bottom-3 z-30 mt-6 flex justify-center lg:hidden">
            <button type="button" onClick={make} className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[0.9375rem] font-semibold text-paper shadow-[var(--shadow)]">
              Make my Tube · {picked.length} picked <ArrowRight size={17} />
            </button>
          </div>
        )}
        {feed.status === "ready" && picked.length > 0 && (
          <p className="mt-6 text-[0.8125rem] text-muted">
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
      className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[0.8438rem] font-medium transition-colors sm:h-9 ${on ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-ink"}`}
    >
      {on ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden className="text-muted" />}
      {topic.name}
      <span className={`font-mono text-[0.6562rem] tabular-nums ${on ? "text-paper/70" : "text-muted"}`}>{topic.count}</span>
    </button>
  );
}
