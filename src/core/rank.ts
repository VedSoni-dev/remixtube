// TubeRemix ranking: deterministic, explainable, no model calls.
// The same inputs always give the same feed. Explained in the README ("How ranking works").

import { hash01 } from "./hash";
import type { Prefs } from "./prefs";
import type { VideoLite } from "./types";

export interface Signals {
  liked: ReadonlySet<string>;
  disliked: ReadonlySet<string>;
  watched: ReadonlySet<string>;
  unavailable: ReadonlySet<string>;
  /** How many times a video was shown in a feed without being opened. */
  impressions: ReadonlyMap<string, number>;
  /** Topic ids of liked / disliked videos, with multiplicity. */
  likedTopics: ReadonlyMap<string, number>;
  dislikedTopics: ReadonlyMap<string, number>;
}

export function emptySignals(): Signals {
  return {
    liked: new Set(), disliked: new Set(), watched: new Set(), unavailable: new Set(),
    impressions: new Map(), likedTopics: new Map(), dislikedTopics: new Map(),
  };
}

export interface RankContext {
  maxScore: number;
  maxRecommenders: number;
  topicArea: ReadonlyMap<string, string>;
  topicName: ReadonlyMap<string, string>;
}

export interface RankOptions {
  limit: number;
  includeWatched?: boolean;
}

export type ReasonKind = "interest" | "area" | "crowd" | "strong" | "quote" | "format" | "liked" | "serendipity" | "classic";

export interface Reason {
  kind: ReasonKind;
  text: string;
}

export interface Ranked {
  video: VideoLite;
  score: number;
  reasons: Reason[];
  slot: "match" | "serendipity" | "classic";
}

// Weights, documented in docs/RANKING.md. Changing one changes every feed.
export const W = {
  interest: 0.5,
  quality: 0.3,
  crowd: 0.18,
  recQuality: 0.06,
  area: 0.12,
  noTopicsInterest: 0.5,
  topicWeight: { 1: 0.6, 2: 0.85, 3: 1 } as Record<number, number>,
  topicPosition: [1, 0.6, 0.4],
  interestCap: 1,
  formatLike: 0.12,
  formatDislike: -0.22,
  depthMatch: 0.06,
  depthMiss: -0.05,
  dated: -0.03,
  newsIncluded: -0.1,
  likedTopic: 0.06,
  dislikedTopic: -0.08,
  feedbackCap: 3,
  impression: -0.05,
  impressionCap: 6,
  jitter: [0, 0.06, 0.12, 0.2],
  serendipityEvery: [0, 9, 6, 4],
  diversityTopic: 0.07,
  diversityTopicWindow: 6,
  diversityChannel: 0.15,
  diversityChannelWindow: 10,
  window: 80,
} as const;

interface Scored {
  v: VideoLite;
  base: number;
  interest: number;
  matched: string[];
  areaHit: string | null;
}

function interestOf(v: VideoLite, prefs: Prefs): { value: number; matched: string[] } {
  let value = 0;
  const matched: string[] = [];
  v.k.forEach((t, i) => {
    const w = prefs.topics[t];
    if (w) {
      value += (W.topicWeight[w] ?? 0) * (W.topicPosition[i] ?? 0.3);
      matched.push(t);
    }
  });
  return { value: Math.min(value, W.interestCap), matched };
}

export function scoreVideo(v: VideoLite, prefs: Prefs, sig: Signals, ctx: RankContext): Scored {
  const hasTopics = Object.keys(prefs.topics).length > 0;
  const { value: interestRaw, matched } = interestOf(v, prefs);
  let interest = hasTopics ? interestRaw : W.noTopicsInterest;

  let areaHit: string | null = null;
  if (hasTopics && interestRaw === 0) {
    const selectedAreas = new Set(Object.keys(prefs.topics).map((t) => ctx.topicArea.get(t)));
    for (const t of v.k) {
      const a = ctx.topicArea.get(t);
      if (a && selectedAreas.has(a)) { areaHit = t; break; }
    }
  }

  const quality = Math.log1p(v.s) / Math.log1p(Math.max(1, ctx.maxScore));
  const crowd = Math.log1p(v.r) / Math.log1p(Math.max(1, ctx.maxRecommenders));
  const recQuality = v.m > 0 ? Math.max(0, Math.min(1, (v.rc + 0.5 * v.sr - v.cr) / v.m)) : 0;

  let base = W.interest * interest + W.quality * quality + W.crowd * crowd + W.recQuality * recQuality;
  if (areaHit) base += W.area;

  const f = prefs.formats[v.ty];
  if (f === 1) base += W.formatLike;
  if (f === -1) base += W.formatDislike;

  if (prefs.depth === "intro") base += v.lv === "intro" || v.lv === "general" ? W.depthMatch : v.lv === "advanced" ? W.depthMiss : 0;
  if (prefs.depth === "deep") base += v.lv === "advanced" || v.lv === "intermediate" ? W.depthMatch : v.lv === "intro" ? W.depthMiss : 0;

  if (v.sl === "dated") base += W.dated;
  if (v.sl === "news") base += W.newsIncluded;

  let liked = 0;
  let disliked = 0;
  for (const t of v.k) {
    liked += sig.likedTopics.get(t) ?? 0;
    disliked += sig.dislikedTopics.get(t) ?? 0;
  }
  base += W.likedTopic * Math.min(W.feedbackCap, liked);
  base += W.dislikedTopic * Math.min(W.feedbackCap, disliked);

  base += W.impression * Math.min(W.impressionCap, sig.impressions.get(v.id) ?? 0);

  const jitter = W.jitter[prefs.serendipity] ?? 0;
  base += jitter * (hash01(prefs.seed, v.id) - 0.5) * 2;

  interest = Math.round(interest * 1e6) / 1e6;
  return { v, base: Math.round(base * 1e9) / 1e9, interest, matched, areaHit };
}

function eligible(v: VideoLite, prefs: Prefs, sig: Signals, opts: RankOptions): boolean {
  if (sig.disliked.has(v.id) || sig.unavailable.has(v.id)) return false;
  if (!opts.includeWatched && sig.watched.has(v.id)) return false;
  if (v.sl === "news" && !prefs.news) return false;
  return true;
}

function byBase(a: Scored, b: Scored): number {
  return b.base - a.base || (a.v.id < b.v.id ? -1 : a.v.id > b.v.id ? 1 : 0);
}

function reasonsFor(s: Scored, slot: Ranked["slot"], prefs: Prefs, sig: Signals, ctx: RankContext): Reason[] {
  const out: Reason[] = [];
  const name = (t: string) => ctx.topicName.get(t) ?? t;
  if (slot === "serendipity") {
    out.push({ kind: "serendipity", text: `Off your map: one of HN’s favourites in ${name(s.v.k[0] ?? "")}` });
  } else if (s.matched.length) {
    out.push({ kind: "interest", text: `Matches ${s.matched.map(name).join(" and ")}` });
  } else if (s.areaHit) {
    out.push({ kind: "area", text: `Next door to your picks: ${name(s.areaHit)}` });
  } else if (slot === "classic") {
    out.push({ kind: "classic", text: "An all-time HN classic" });
  }
  if (s.v.r > 0) {
    out.push({ kind: "crowd", text: `Recommended by ${s.v.r} HN commenter${s.v.r === 1 ? "" : "s"}` });
  }
  if (s.v.sr >= 2) out.push({ kind: "strong", text: `${s.v.sr} enthusiastic recommendations` });
  if (prefs.formats[s.v.ty] === 1) out.push({ kind: "format", text: `You asked for more ${s.v.ty}s` });
  let liked = 0;
  for (const t of s.v.k) liked += sig.likedTopics.get(t) ?? 0;
  if (liked > 0) out.push({ kind: "liked", text: "Similar topics to videos you liked" });
  return out;
}

/**
 * Ranks candidates into a feed.
 * 1. Score every eligible video (interest, quality, crowd, feedback, small seeded jitter).
 * 2. Fill slots greedily, penalising a topic or channel that just appeared (diversity).
 * 3. With serendipity on, every Nth slot goes to the best video outside your topics.
 */
export function rankFeed(candidates: readonly VideoLite[], prefs: Prefs, sig: Signals, ctx: RankContext, opts: RankOptions): Ranked[] {
  const seen = new Set<string>();
  const scored: Scored[] = [];
  for (const v of candidates) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    if (!eligible(v, prefs, sig, opts)) continue;
    scored.push(scoreVideo(v, prefs, sig, ctx));
  }
  const hasTopics = Object.keys(prefs.topics).length > 0;
  const main = scored.filter((s) => !hasTopics || s.interest > 0 || s.areaHit).sort(byBase);
  const outside = hasTopics
    ? scored.filter((s) => s.interest === 0 && !s.areaHit).sort((a, b) => {
        // Outside picks: quality first, seeded tie-breaks.
        const qa = a.v.s + (W.jitter[prefs.serendipity] ?? 0) * 20 * hash01(prefs.seed ^ 0x5bd1e995, a.v.id);
        const qb = b.v.s + (W.jitter[prefs.serendipity] ?? 0) * 20 * hash01(prefs.seed ^ 0x5bd1e995, b.v.id);
        return qb - qa || (a.v.id < b.v.id ? -1 : 1);
      })
    : [];

  const every = W.serendipityEvery[prefs.serendipity] ?? 0;
  const picked: Ranked[] = [];
  const recentTopics: string[] = [];
  const recentChannels: string[] = [];
  let outIdx = 0;

  // The feed ends when your topics run out; outside picks only fill serendipity slots.
  while (picked.length < opts.limit && main.length) {
    const slotNo = picked.length + 1;
    const wantOutside = hasTopics && every > 0 && slotNo % every === 0 && outIdx < outside.length;
    if (wantOutside) {
      const s = outside[outIdx++]!;
      picked.push({ video: s.v, score: s.base, reasons: reasonsFor(s, "serendipity", prefs, sig, ctx), slot: "serendipity" });
      recentTopics.push(s.v.k[0] ?? "");
      recentChannels.push(s.v.c);
      continue;
    }
    let bestI = 0;
    let bestScore = -Infinity;
    const tWin = recentTopics.slice(-W.diversityTopicWindow);
    const cWin = recentChannels.slice(-W.diversityChannelWindow);
    const n = Math.min(main.length, W.window);
    for (let i = 0; i < n; i++) {
      const s = main[i]!;
      const tPen = tWin.filter((t) => t === s.v.k[0]).length * W.diversityTopic;
      const cPen = cWin.filter((c) => c === s.v.c).length * W.diversityChannel;
      const adj = s.base - tPen - cPen;
      if (adj > bestScore + 1e-12) { bestScore = adj; bestI = i; }
    }
    const [s] = main.splice(bestI, 1);
    if (!s) break;
    const slot: Ranked["slot"] = hasTopics ? "match" : "classic";
    picked.push({ video: s.v, score: s.base, reasons: reasonsFor(s, slot, prefs, sig, ctx), slot });
    recentTopics.push(s.v.k[0] ?? "");
    recentChannels.push(s.v.c);
  }
  return picked;
}

/** Builds signals from local lists; liked/disliked topics come from saved snapshots. */
export function buildSignals(input: {
  liked?: Iterable<{ id: string; k?: string[] }>;
  disliked?: Iterable<{ id: string; k?: string[] }>;
  watched?: Iterable<string>;
  unavailable?: Iterable<string>;
  impressions?: Iterable<[string, number]>;
}): Signals {
  const sig = emptySignals() as {
    liked: Set<string>; disliked: Set<string>; watched: Set<string>; unavailable: Set<string>;
    impressions: Map<string, number>; likedTopics: Map<string, number>; dislikedTopics: Map<string, number>;
  };
  for (const v of input.liked ?? []) {
    sig.liked.add(v.id);
    for (const t of v.k ?? []) sig.likedTopics.set(t, (sig.likedTopics.get(t) ?? 0) + 1);
  }
  for (const v of input.disliked ?? []) {
    sig.disliked.add(v.id);
    for (const t of v.k ?? []) sig.dislikedTopics.set(t, (sig.dislikedTopics.get(t) ?? 0) + 1);
  }
  for (const id of input.watched ?? []) sig.watched.add(id);
  for (const id of input.unavailable ?? []) sig.unavailable.add(id);
  for (const [id, n] of input.impressions ?? []) sig.impressions.set(id, n);
  return sig;
}
