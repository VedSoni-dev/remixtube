"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { rankContext } from "@/core/catalog";
import { rankFeed } from "@/core/rank";
import type { Shard } from "@/core/types";
import { Empty, Grid, PageHead, useFeedSignals } from "@/components/tube/Feed";
import { loadTopicShard } from "@/lib/data";
import { actions, useStore } from "@/lib/store";
import { useIndex } from "@/lib/useFeed";

export default function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const index = useIndex();
  const s = useStore();
  const { signals } = useFeedSignals();
  const topic = index?.topics.find((t) => t.id === id) ?? null;
  const [shard, setShard] = useState<Shard | null>(null);

  useEffect(() => {
    if (!topic) return;
    let live = true;
    loadTopicShard(topic.id).then((sh) => live && setShard(sh)).catch(() => live && setShard({ id: topic.id, videos: [] }));
    return () => { live = false; };
  }, [topic]);

  const items = useMemo(() => {
    if (!index || !shard || !topic) return [];
    return rankFeed(shard.videos, { ...s.prefs, topics: { ...s.prefs.topics, [topic.id]: 3 }, serendipity: 0 }, signals, rankContext(index), { limit: 400, includeWatched: true });
  }, [index, shard, topic, s.prefs, signals]);

  if (index && !topic) {
    return <Empty title="No such topic." action={<Link className="rounded-full bg-ink px-5 py-2.5 font-semibold text-paper" href="/tube/topics">All topics</Link>} />;
  }
  const inTube = topic ? !!s.prefs.topics[topic.id] : false;
  return (
    <div>
      <PageHead kicker={index?.areas.find((a) => a.id === topic?.area)?.name ?? "Topic"} title={topic?.name ?? "…"}>
        <p>{topic?.description}</p>
        {topic && (
          <button
            type="button"
            onClick={() => {
              const topics = { ...s.prefs.topics };
              if (inTube) delete topics[topic.id];
              else topics[topic.id] = 2;
              actions.setPrefs({ ...s.prefs, topics });
            }}
            className={`mt-4 h-10 rounded-full px-5 text-[0.875rem] font-semibold ${inTube ? "border border-ink" : "bg-ink text-paper"}`}
          >
            {inTube ? "Remove from my Tube" : "Add to my Tube"}
          </button>
        )}
      </PageHead>
      <Grid heading="Videos in this topic" items={items} loading={!shard} n={12} startRank={1} />
      {shard && !items.length && <Empty title="Nothing to show here.">Every video in this topic is hidden or marked unavailable.</Empty>}
    </div>
  );
}
