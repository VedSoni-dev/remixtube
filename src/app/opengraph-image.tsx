import { renderCard, OG_SIZE } from "@/lib/og";
import { readIndex, readJson } from "@/lib/server-data";
import type { Shard } from "@/core/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "TubeRemix: Make your own HackerTube.";

export default async function Image() {
  const [index, staples] = await Promise.all([readIndex(), readJson<Shard>("staples.json")]);
  return renderCard({
    kicker: "An independent remix of HackerTube’s open data",
    title: "Make your own HackerTube.",
    topics: ["Pick interests", "Get a feed", "Share it"],
    videos: staples.videos.slice(0, 4),
    footnote: `${index.stats.videos.toLocaleString("en-US")} videos that HN commenters recommended, 2007–2026. No login, no AI required.`,
  });
}
