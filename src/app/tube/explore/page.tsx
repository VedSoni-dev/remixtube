"use client";
import { useEffect, useMemo, useState } from "react";
import type { ContentType, Shard, VideoLite } from "@/core/types";
import { Empty, Grid, PageHead } from "@/components/tube/Feed";
import { loadAreaShard } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useIndex } from "@/lib/useFeed";

type Sort = "best" | "people" | "recent";
const ERAS = [
  { id: "all", label: "Any time", test: (_v: VideoLite) => true },
  { id: "early", label: "Before 2013", test: (v: VideoLite) => v.y0 < 2013 },
  { id: "mid", label: "2013–2019", test: (v: VideoLite) => v.y0 >= 2013 && v.y0 <= 2019 },
  { id: "late", label: "2020 on", test: (v: VideoLite) => v.y0 >= 2020 },
] as const;
type Era = (typeof ERAS)[number]["id"];
const PAGE = 36;

export default function ExplorePage() {
  const index = useIndex();
  const s = useStore();
  const [area, setArea] = useState<string | null>(null);
  const [shard, setShard] = useState<Shard | null>(null);
  const [sort, setSort] = useState<Sort>("best");
  const [type, setType] = useState<ContentType | "all">("all");
  const [era, setEra] = useState<Era>("all");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => { if (index && !area) setArea(index.areas[0]!.id); }, [index, area]);
  useEffect(() => {
    if (!area) return;
    let live = true;
    setShard(null);
    setLimit(PAGE);
    loadAreaShard(area).then((sh) => live && setShard(sh)).catch(() => live && setShard({ id: area, videos: [] }));
    return () => { live = false; };
  }, [area]);

  const list = useMemo(() => {
    if (!shard) return [];
    const eraTest = ERAS.find((e) => e.id === era)!.test;
    const out = shard.videos.filter((v) => (s.prefs.news || v.sl !== "news") && !s.disliked[v.id] && !s.unavailable[v.id] && (type === "all" || v.ty === type) && eraTest(v));
    if (sort === "people") out.sort((a, b) => b.r - a.r || b.s - a.s || (a.id < b.id ? -1 : 1));
    if (sort === "recent") out.sort((a, b) => b.y1 - a.y1 || b.s - a.s || (a.id < b.id ? -1 : 1));
    return out;
  }, [shard, sort, type, era, s.prefs.news, s.disliked, s.unavailable]);

  const types = useMemo(() => {
    const c = new Map<ContentType, number>();
    for (const v of shard?.videos ?? []) c.set(v.ty, (c.get(v.ty) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [shard]);

  const tab = (on: boolean) => `h-9 shrink-0 rounded-full border px-4 text-[13.5px] font-medium ${on ? "border-ink bg-ink text-paper" : "border-hair hover:border-ink/40"}`;
  return (
    <div>
      <PageHead kicker="Explore" title="Wander the whole map.">
        All {index?.stats.videos.toLocaleString("en-US") ?? "…"} videos, area by area, outside your feed’s ranking. Sorted by HackerTube’s lasting-recommendation score unless you choose otherwise.
      </PageHead>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" role="tablist" aria-label="Areas">
        {index?.areas.map((a) => (
          <button key={a.id} role="tab" aria-selected={a.id === area} type="button" onClick={() => setArea(a.id)} className={tab(a.id === area)}>
            {a.name} <span className="font-mono text-[10.5px] opacity-70">{a.count}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-hair pb-4 text-[13.5px]">
        <label className="flex items-center gap-2">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-full border border-hair bg-card px-3">
            <option value="best">Most lasting recommendations</option>
            <option value="people">Most recommenders</option>
            <option value="recent">Recently recommended</option>
          </select>
        </label>
        <label className="flex items-center gap-2">Format
          <select value={type} onChange={(e) => setType(e.target.value as ContentType | "all")} className="h-9 rounded-full border border-hair bg-card px-3">
            <option value="all">All formats</option>
            {types.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">First on HN
          <select value={era} onChange={(e) => setEra(e.target.value as Era)} className="h-9 rounded-full border border-hair bg-card px-3">
            {ERAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
        <span className="meta ml-auto">{shard ? `${list.length} videos` : "Loading"}</span>
      </div>
      <div className="mt-6">
        <Grid items={list.slice(0, limit)} loading={!shard} n={12} />
        {shard && !list.length && <Empty title="No videos match.">Try another format or time range.</Empty>}
        {list.length > limit && (
          <div className="mt-10 flex justify-center">
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-11 rounded-full border border-ink px-6 text-[14px] font-semibold hover:bg-ink hover:text-paper">Show more</button>
          </div>
        )}
      </div>
    </div>
  );
}
