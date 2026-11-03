"use client";
import { RefreshCw, Shuffle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Empty, Grid, PageHead, useFeedSignals } from "@/components/tube/Feed";
import { actions, useHydrated, useStore } from "@/lib/store";
import { useFeed } from "@/lib/useFeed";

const PAGE = 24;

export default function ForYouPage() {
  const hydrated = useHydrated();
  const s = useStore();
  const { signals, refresh } = useFeedSignals();
  const [limit, setLimit] = useState(PAGE);
  const feed = useFeed(s.prefs, signals, limit);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const items = feed.status === "ready" ? feed.items : [];
  const more = feed.status === "ready" && items.length >= limit;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit]);

  if (hydrated && !s.hasTube) {
    return (
      <Empty title="No Tube yet." action={<Link href="/tube" className="rounded-full bg-ink px-5 py-2.5 font-semibold text-paper">Pick interests</Link>}>
        For You ranks videos from your interests. Pick a few to start.
      </Empty>
    );
  }
  return (
    <div>
      <PageHead kicker="For You" title="Everything, in your order.">
        One long ranked list from your topics, with a little serendipity mixed in. Likes and history reshape it when you refresh.
      </PageHead>
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" onClick={refresh} className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[0.8438rem] font-medium hover:border-ink">
          <RefreshCw size={14} aria-hidden /> Refresh with my likes
        </button>
        <button
          type="button"
          onClick={() => { actions.setPrefs({ ...s.prefs, seed: (Math.imul(s.prefs.seed, 1103515245) + 12345) >>> 0 }); setLimit(PAGE); }}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[0.8438rem] font-medium hover:border-ink"
        >
          <Shuffle size={14} aria-hidden /> Shuffle
        </button>
      </div>
      <Grid heading="Ranked videos" items={items} loading={feed.status === "loading" || !hydrated} n={PAGE} startRank={1} />
      {feed.status === "ready" && !items.length && <Empty title="You’ve seen it all.">Everything matching your topics is watched or hidden. Add topics in Customize.</Empty>}
      <div ref={sentinel} aria-hidden className="h-px" />
      {more && (
        <div className="mt-10 flex justify-center">
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-11 rounded-full border border-ink px-6 text-[0.875rem] font-semibold hover:bg-ink hover:text-paper">Show more</button>
        </div>
      )}
      {feed.status === "ready" && !more && items.length > 0 && (
        <p className="mt-10 text-center text-[0.8438rem] text-muted">
          That’s all {items.length} videos for your topics. <Link className="underline underline-offset-2" href="/tube/explore">Explore</Link> for more.
        </p>
      )}
    </div>
  );
}
