import { renderCard, OG_SIZE } from "@/lib/og";
import { readIndex, readJson } from "@/lib/server-data";
import { resolveShared } from "@/lib/shared";
import type { Shard } from "@/core/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A TubeRemix Tube: its name, interests and top videos";

export default async function Image({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  const t = await resolveShared(segment, 4);
  if (!t.ok) {
    const [index, staples] = await Promise.all([readIndex(), readJson<Shard>("staples.json")]);
    return renderCard({ kicker: "Made with TubeRemix", title: "Make your own HackerTube.", topics: [], videos: staples.videos.slice(0, 4), footnote: `${index.stats.videos.toLocaleString("en-US")} videos recommended on Hacker News. Data: HackerTube (ODC-By).` });
  }
  return renderCard({
    kicker: "A TubeRemix Tube",
    title: t.config.prefs.name || "A HackerTube remix",
    topics: t.topicNames,
    videos: t.items.map((r) => r.video),
    footnote: `Made with TubeRemix · top picks from ${t.pool.toLocaleString("en-US")} videos HN recommended. Data: HackerTube (ODC-By).`,
  });
}
