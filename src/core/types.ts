// Shared data shapes. Everything here is produced by the import pipeline from
// fields that exist in the HackerTube export; nothing is invented.

export const CONTENT_TYPES = [
  "talk", "lecture", "course", "documentary", "explainer", "interview", "podcast",
  "tutorial", "demo", "news", "commentary", "comedy", "music", "other",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const LEVELS = ["general", "intro", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const SHELF_LIVES = ["evergreen", "dated", "news"] as const;
export type ShelfLife = (typeof SHELF_LIVES)[number];

export const STANCES = ["strong_rec", "rec", "reference", "joke", "critical"] as const;
export type Stance = (typeof STANCES)[number];

/** Compact video record used for ranking and grids (shipped in topic shards). */
export interface VideoLite {
  id: string; // 11-char YouTube id
  t: string; // title
  c: string; // channel
  k: string[]; // topic ids, best first (1-3)
  ty: ContentType;
  lv: Level;
  sl: ShelfLife;
  s: number; // HackerTube score: rec_months + 0.5 x months with a strong rec
  r: number; // distinct HN commenters who recommended it
  m: number; // labeled mentions kept (capped at 20 upstream)
  rc: number; // mentions whose stance is rec or strong_rec
  sr: number; // strong recommendations
  cr: number; // critical + joke mentions
  y0: number; // first year mentioned on HN
  y1: number; // last year mentioned on HN
  q?: string; // best pull quote, checked to occur verbatim in the HN comment `qi`
  qi?: number; // HN comment id the pull quote comes from
}

export interface Topic {
  id: string;
  code: string; // 3-char stable short code used in share links
  name: string;
  area: string;
  description: string;
  count: number; // eligible videos in this topic, not counting news-of-the-day ones (hidden by default)
  chip: boolean; // big enough to make a useful feed on its own
}

export interface Area {
  id: string;
  name: string;
  topics: string[];
  count: number; // as Topic.count
}

export interface DataIndex {
  version: 1;
  source: {
    id: string;
    name: string;
    url: string;
    data_url: string;
    zip_sha256: string;
    exported: string;
    license: string;
    license_url: string;
    attribution: string;
  };
  stats: {
    source_videos: number;
    source_mentions: number;
    source_recommendations: number;
    videos: number; // eligible videos shipped
    mentions: number; // mentions kept for provenance
    recommenders: number; // distinct HN usernames who recommended an eligible video
    first_year: number;
    last_year: number;
    areas: number;
    topics: number;
    chips: number;
    max_score: number;
    max_recommenders: number;
  };
  filters: Record<string, string | number | boolean>;
  areas: Area[];
  topics: Topic[];
}

export interface Mention {
  id: number; // HN comment id
  a: string; // HN username
  mo: string; // YYYY-MM
  st: Stance;
  story: string; // HN story title the thread is under
  q: string; // verbatim quote (may be empty)
  w: string; // what a viewer gets, per this comment (may be empty)
  x: string; // comment excerpt, links replaced by [VIDEO]/[LINK]
  cut: boolean; // excerpt shortened by TubeRemix or upstream
}

export interface RelatedRef {
  id: string;
  t: string;
  c: string;
  n?: number; // shared HN recommenders (co-recommendation graph only)
}

export interface VideoDetail {
  v: VideoLite; // the same compact record as in the shards, so deep links work alone
  sum: string; // summary written by Claude for HackerTube
  why: string; // why HN likes it, written by Claude for HackerTube
  tags: string[];
  topic: string; // free-form primary topic
  mentions: Mention[];
  more: number; // labeled mentions not included here
  corec: RelatedRef[]; // recommended by the same HN people
  similar: RelatedRef[]; // nearest neighbours in the published embeddings
}

export interface Shard {
  id: string;
  videos: VideoLite[];
}
