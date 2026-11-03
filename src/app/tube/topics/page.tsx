"use client";
import Link from "next/link";
import type { TopicWeight } from "@/core/prefs";
import { PageHead } from "@/components/tube/Feed";
import { WEIGHT_LABEL } from "@/components/tube/TopicPicker";
import { actions, useStore } from "@/lib/store";
import { useIndex } from "@/lib/useFeed";

export default function TopicsPage() {
  const index = useIndex();
  const s = useStore();
  const setWeight = (id: string, w: TopicWeight | 0) => {
    const topics = { ...s.prefs.topics };
    if (w === 0) delete topics[id];
    else topics[id] = w;
    actions.setPrefs({ ...s.prefs, topics });
  };
  return (
    <div>
      <PageHead kicker="Topics" title="The whole taxonomy.">
        {index ? `${index.stats.topics} topics in ${index.stats.areas} areas, from the HackerTube data. Add one to your Tube, or open it to browse.` : "Loading…"}
      </PageHead>
      <div className="columns-1 gap-8 md:columns-2 2xl:columns-3">
        {index?.areas.map((a) => (
          <section key={a.id} className="mb-8 break-inside-avoid">
            <h2 className="border-b border-ink pb-1.5 font-serif text-[24px]">{a.name}</h2>
            <ul>
              {index.topics.filter((t) => t.area === a.id && t.count > 0).map((t) => {
                const w = s.prefs.topics[t.id];
                return (
                  <li key={t.id} className="flex items-center gap-3 border-b border-hair py-2">
                    <Link href={`/tube/topics/${t.id}`} className="min-w-0 flex-1 text-[14.5px] hover:underline" title={t.description}>
                      {t.name} <span className="font-mono text-[11px] text-muted">{t.count}</span>
                    </Link>
                    <select
                      aria-label={`How much ${t.name} in your Tube`}
                      value={w ?? 0}
                      onChange={(e) => setWeight(t.id, Number(e.target.value) as TopicWeight | 0)}
                      className={`h-8 rounded-full border px-2 text-[12.5px] ${w ? "border-ink bg-ink text-paper" : "border-hair bg-card"}`}
                    >
                      <option value={0}>Not in my Tube</option>
                      {([1, 2, 3] as const).map((x) => <option key={x} value={x}>{WEIGHT_LABEL[x]}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
