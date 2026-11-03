// Loading helpers shared by the browser (fetch) and the server (fs).
import { detailBucket } from "./hash";
import type { Prefs } from "./prefs";
import type { RankContext } from "./rank";
import type { DataIndex, Shard, Topic, VideoDetail, VideoLite } from "./types";

export type JsonLoader = <T>(path: string) => Promise<T>;

export function rankContext(index: DataIndex): RankContext {
  return {
    maxScore: index.stats.max_score,
    maxRecommenders: index.stats.max_recommenders,
    topicArea: new Map(index.topics.map((t) => [t.id, t.area])),
    topicName: new Map(index.topics.map((t) => [t.id, t.name])),
  };
}

export function codeMap(index: DataIndex): Map<string, string> {
  return new Map(index.topics.map((t) => [t.code, t.id]));
}

export function knownTopics(index: DataIndex): Set<string> {
  return new Set(index.topics.map((t) => t.id));
}

/** Candidate pool for a feed: every selected topic's shard plus the staples. */
export async function loadCandidates(load: JsonLoader, index: DataIndex, prefs: Prefs): Promise<VideoLite[]> {
  const known = knownTopics(index);
  const ids = Object.keys(prefs.topics).filter((t) => known.has(t)).sort();
  const shards = await Promise.all([
    load<Shard>("staples.json"),
    ...ids.map((id) => load<Shard>(`t/${id}.json`)),
  ]);
  const seen = new Set<string>();
  const out: VideoLite[] = [];
  // Topic shards first so their copy wins; all copies are identical anyway.
  for (const s of [...shards.slice(1), shards[0]!]) {
    for (const v of s.videos) if (!seen.has(v.id)) { seen.add(v.id); out.push(v); }
  }
  return out;
}

export async function loadDetail(load: JsonLoader, videoId: string): Promise<VideoDetail | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  const bucket = await load<Record<string, VideoDetail>>(`d/${detailBucket(videoId)}.json`);
  return Object.prototype.hasOwnProperty.call(bucket, videoId) ? bucket[videoId]! : null;
}

export function thumbUrl(id: string, style: "creator" | "frame" = "creator", size: "mq" | "hq" = "hq"): string {
  const file = style === "frame" ? `${size}2.jpg` : `${size}default.jpg`;
  return `https://i.ytimg.com/vi/${id}/${file}`;
}

export function youtubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function hnItemUrl(id: number): string {
  return `https://news.ycombinator.com/item?id=${id}`;
}

/**
 * Honest description of a feed's pool: how many videos match the topics directly. Feeds may also
 * contain "next door" (same area) and serendipity picks, so never say "top N of M" when M < N.
 */
export function poolLine(shown: number, pool: number, topics: number): string {
  if (!topics) return `The ${shown} videos HN recommended most, across every topic.`;
  if (pool >= shown) return `The top ${shown} of ${pool.toLocaleString("en-US")} videos HN recommended in ${topics === 1 ? "this topic" : "these topics"}.`;
  return `${pool.toLocaleString("en-US")} video${pool === 1 ? "" : "s"} match${pool === 1 ? "es" : ""} ${topics === 1 ? "this topic" : "these topics"} directly; the rest are nearby HN favourites.`;
}

/** The largest chip topic from each area, in the taxonomy's own area order (software first). */
export function starterChips(index: DataIndex): Topic[] {
  const chips = index.topics.filter((t) => t.chip);
  const out: Topic[] = [];
  for (const a of index.areas) out.push(...chips.filter((t) => t.area === a.id).sort((x, y) => y.count - x.count).slice(0, 1));
  return out;
}

/** A readable default name from the picks, e.g. "Machine learning & Fundamental physics". */
export function autoName(topicIds: string[], names: ReadonlyMap<string, string>): string {
  const short = topicIds.map((t) => (names.get(t) ?? "").split(/\s*(?:&|,|\()\s*/)[0]!.trim()).filter(Boolean);
  if (!short.length) return "";
  const two = short.slice(0, 2).join(" & ");
  const name = short.length > 2 ? `${two} +${short.length - 2}` : two;
  return name.length <= 48 ? name : short[0]!.slice(0, 48);
}
