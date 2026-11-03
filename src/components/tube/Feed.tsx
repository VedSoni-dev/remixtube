"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Ranked, Signals } from "@/core/rank";
import type { VideoLite } from "@/core/types";
import { getState, signalsFrom, useStore, type Snap } from "@/lib/store";
import { usePlayer } from "../player/PlayerProvider";
import { CardSkeleton, VideoCard } from "../VideoCard";

/**
 * Signals for a feed: likes, history and impressions are snapshotted when the page opens
 * (so the grid doesn't jump while you browse); "Not for me" and removed videos apply live.
 */
export function useFeedSignals(): { signals: Signals; refresh: () => void } {
  const s = useStore();
  const [snap, setSnap] = useState(() => signalsFrom(getState()));
  const refresh = useCallback(() => setSnap(signalsFrom(getState())), []);
  const signals = useMemo<Signals>(() => {
    const live = signalsFrom(s);
    return { ...snap, disliked: live.disliked, unavailable: live.unavailable };
  }, [snap, s]);
  return { signals, refresh };
}

/** Saved snapshots only carry id, title, channel and topics; the player loads the full record. */
export function snapToLite(x: Snap): VideoLite {
  return { id: x.id, t: x.t, c: x.c, k: x.k, ty: "other", lv: "general", sl: "evergreen", s: 0, r: 0, m: 0, rc: 0, sr: 0, cr: 0, y0: 0, y1: 0 };
}

export function Grid({ items, loading, n = 12, startRank, snaps = false, heading }: { items: Ranked[] | VideoLite[]; loading?: boolean; n?: number; startRank?: number; snaps?: boolean; heading?: string }) {
  const player = usePlayer();
  const ranked: Ranked[] = (items as (Ranked | VideoLite)[]).map((x) => ("video" in x ? x : { video: x, score: 0, reasons: [], slot: "match" as const }));
  const queue = ranked.map((r) => r.video);
  return (
    <>
    {heading && <h2 className="sr-only">{heading}</h2>}
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4">
      {loading ? <CardSkeleton n={n} /> : ranked.map((r, i) => (
        <VideoCard
          key={r.video.id}
          video={r.video}
          reasons={r.reasons}
          rank={startRank !== undefined ? startRank + i : undefined}
          priority={i < 3}
          onOpen={(v) => (snaps ? player.openId(v.id) : player.open(v, { queue, reasons: r.reasons }))}
        />
      ))}
    </div>
    </>
  );
}

export function Row({ title, href, items, note, snaps = false }: { title: string; href?: string; items: Ranked[] | VideoLite[]; note?: string; snaps?: boolean }) {
  const player = usePlayer();
  const scroller = useRef<HTMLDivElement | null>(null);
  const ranked: Ranked[] = (items as (Ranked | VideoLite)[]).map((x) => ("video" in x ? x : { video: x, score: 0, reasons: [], slot: "match" as const }));
  if (!ranked.length) return null;
  const queue = ranked.map((r) => r.video);
  const scroll = (d: number) => scroller.current?.scrollBy({ left: d * scroller.current.clientWidth * 0.85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-end justify-between gap-3 border-b border-hair pb-2">
        <div>
          <h2 className="font-serif text-[1.75rem] leading-none">{title}</h2>
          {note && <p className="mt-1.5 text-[0.8125rem] text-muted">{note}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {href && <Link href={href} className="mr-2 inline-flex h-10 items-center px-1 text-[0.8438rem] font-medium underline-offset-4 hover:underline">See all</Link>}
          <button type="button" onClick={() => scroll(-1)} className="hidden h-10 w-10 place-items-center rounded-full border border-line hover:border-ink sm:grid" aria-label={`Scroll ${title} left`}><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => scroll(1)} className="hidden h-10 w-10 place-items-center rounded-full border border-line hover:border-ink sm:grid" aria-label={`Scroll ${title} right`}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div ref={scroller} className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-pl-6 sm:px-6">
        {ranked.map((r) => (
          <div key={r.video.id} className="w-[78vw] shrink-0 snap-start min-[480px]:w-[300px]">
            <VideoCard video={r.video} reasons={r.reasons} onOpen={(v) => (snaps ? player.openId(v.id) : player.open(v, { queue, reasons: r.reasons }))} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function PageHead({ kicker, title, children }: { kicker?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {kicker && <p className="meta">{kicker}</p>}
      <h1 className="mt-1 font-serif text-[2.75rem] leading-[0.98] tracking-[-0.015em] sm:text-[3.5rem]">{title}</h1>
      {children && <div className="mt-3 max-w-[70ch] text-[0.9375rem] leading-relaxed text-ink-2">{children}</div>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-dashed border-hair px-6 py-14 text-center">
      <p className="font-serif text-[1.875rem] leading-tight">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-[48ch] text-[0.9062rem] text-ink-2">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
