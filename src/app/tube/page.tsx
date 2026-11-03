"use client";
import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { autoName, rankContext } from "@/core/catalog";
import { defaultPrefs, type TopicWeight } from "@/core/prefs";
import { rankFeed, type Ranked } from "@/core/rank";
import { Empty, Grid, PageHead, Row, snapToLite, useFeedSignals } from "@/components/tube/Feed";
import { TopicPicker } from "@/components/tube/TopicPicker";
import { sinceStart, track } from "@/lib/analytics";
import { actions, useHydrated, useStore } from "@/lib/store";
import { useFeed, useIndex } from "@/lib/useFeed";

export default function HomePage() {
  const hydrated = useHydrated();
  const s = useStore();
  if (!hydrated) return <Grid items={[]} loading n={8} />;
  return s.hasTube ? <Home /> : <Welcome />;
}

function Welcome() {
  const index = useIndex();
  const [topics, setTopics] = useState<Record<string, TopicWeight>>({});
  const n = Object.keys(topics).length;
  return (
    <div>
      <PageHead kicker="New here" title={<>Start with a few <span className="marked">interests</span>.</>}>
        Pick topics and TubeRemix ranks thousands of HN-recommended videos for you, right in this browser. Change anything later.
      </PageHead>
      {index ? <TopicPicker index={index} value={topics} onChange={setTopics} /> : <div className="skeleton h-40 rounded" />}
      <div className="sticky bottom-16 z-20 -mx-4 mt-8 flex justify-center border-t border-hair bg-paper/95 px-4 py-3 backdrop-blur lg:bottom-0">
        <button
          type="button"
          disabled={!n}
          onClick={() => {
            const p = defaultPrefs();
            p.topics = topics;
            p.name = autoName(Object.keys(topics), new Map(index?.topics.map((t) => [t.id, t.name]) ?? []));
            track("builder_started", { source: "tube" }, { oncePerTab: true });
            if (n >= 3) track("interests_selected", { n, source: "tube" }, { oncePerTab: true });
            actions.setPrefs(p, { parent: null });
          }}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[0.9375rem] font-semibold text-paper disabled:border disabled:border-line disabled:bg-paper-2 disabled:text-muted"
        >
          {n ? `Make my Tube · ${n} picked` : "Pick an interest to start"} <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function Home() {
  const s = useStore();
  const { signals, refresh } = useFeedSignals();
  const feed = useFeed(s.prefs, signals, 48);
  const reported = useRef(false);

  useEffect(() => {
    if (feed.status !== "ready" || reported.current) return;
    reported.current = true;
    const fromBuilder = new URL(window.location.href).searchParams.get("new") === "1";
    track("feed_generated", { source: fromBuilder ? "builder" : "tube", ms: sinceStart(), n: Object.keys(s.prefs.topics).length }, { oncePerTab: true });
    actions.recordImpressions(feed.items.slice(0, 12).map((r) => r.video.id));
    if (fromBuilder) {
      const u = new URL(window.location.href);
      u.searchParams.delete("new");
      window.history.replaceState(window.history.state, "", u);
    }
  }, [feed, s.prefs.topics]);

  const rows = useMemo(() => {
    if (feed.status !== "ready") return null;
    const ctx = rankContext(feed.index);
    const top = feed.items.slice(0, 12);
    const shown = new Set(top.map((r) => r.video.id));
    const topicIds = Object.entries(s.prefs.topics).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([t]) => t);
    const perTopic = topicIds.map((t) => {
      const p = { ...s.prefs, topics: { [t]: 3 as TopicWeight }, serendipity: 0 as const };
      const list = rankFeed(feed.candidates.filter((v) => v.k.includes(t) && !shown.has(v.id)), p, signals, ctx, { limit: 12 });
      list.forEach((r) => shown.add(r.video.id));
      return { id: t, name: ctx.topicName.get(t) ?? t, list };
    });
    const sel = new Set(Object.keys(s.prefs.topics));
    const off: Ranked[] = rankFeed(
      feed.candidates.filter((v) => !v.k.some((t) => sel.has(t)) && !shown.has(v.id)),
      { ...defaultPrefs(), seed: s.prefs.seed, serendipity: 2 }, signals, ctx, { limit: 12 },
    ).map((r) => ({ ...r, reasons: [{ kind: "serendipity", text: `Off your map: a favourite in ${ctx.topicName.get(r.video.k[0] ?? "") ?? "another topic"}` }, ...r.reasons.slice(1)] }));
    return { top, perTopic, off };
  }, [feed, s.prefs, signals]);

  const later = Object.values(s.later).sort((a, b) => b.at - a.at);
  const names = feed.status === "ready" ? new Map(feed.index.topics.map((t) => [t.id, t.name])) : new Map<string, string>();

  return (
    <div>
      <PageHead kicker={s.parent ? "A remix" : "Your Tube"} title={s.prefs.name || <>Your <span className="marked">Tube</span>.</>}>
        <span className="flex flex-wrap items-center gap-2">
          {Object.keys(s.prefs.topics).map((t) => <span key={t} className="rounded-full bg-paper-2 px-3 py-1 text-[0.8125rem]">{names.get(t) ?? t}</span>)}
          <Link href="/tube/customize" className="text-[0.8438rem] font-medium underline underline-offset-4">Customize</Link>
        </span>
      </PageHead>

      {feed.status === "error" && <Empty title="Couldn’t load your videos.">Check your connection and reload the page.</Empty>}

      <div className="mb-4 flex items-end justify-between border-b border-hair pb-2">
        <h2 className="font-serif text-[1.75rem] leading-none">Top picks</h2>
        <button type="button" onClick={refresh} className="inline-flex h-10 items-center gap-1.5 text-[0.8438rem] font-medium hover:underline" title="Re-rank with your latest likes and history">
          <RefreshCw size={14} aria-hidden /> Refresh
        </button>
      </div>
      <Grid items={rows?.top ?? []} loading={!rows} n={12} startRank={1} />
      {rows && rows.top.length === 0 && <Empty title="Nothing left to show.">You’ve hidden or watched everything that matches. Add topics in Customize, or clear History.</Empty>}

      {rows?.perTopic.map((r) => (
        <Row key={r.id} title={`In ${r.name}`} href={`/tube/topics/${r.id}`} items={r.list} />
      ))}
      {later.length > 0 && <Row title="Saved for later" href="/tube/later" items={later.map(snapToLite)} snaps />}
      {rows && <Row title="Off your map" note="HN favourites from outside your interests. Turn these down in Customize." items={rows.off} />}

      <div className="mt-14 flex justify-center">
        <Link href="/tube/for-you" className="inline-flex h-11 items-center gap-2 rounded-full border border-ink px-5 text-[0.875rem] font-semibold hover:bg-ink hover:text-paper">
          Keep going in For You <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
