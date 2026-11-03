"use client";
import { useEffect, useMemo, useState } from "react";
import { knownTopics, rankContext } from "@/core/catalog";
import type { Prefs } from "@/core/prefs";
import { rankFeed, type Ranked, type Signals } from "@/core/rank";
import type { DataIndex, VideoLite } from "@/core/types";
import { loadCandidates, loadIndex } from "./data";
import { setKnownTopics } from "./store";

export function useIndex(): DataIndex | null {
  const [index, setIndex] = useState<DataIndex | null>(null);
  useEffect(() => {
    let live = true;
    loadIndex().then((i) => {
      if (!live) return;
      setKnownTopics(knownTopics(i));
      setIndex(i);
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  return index;
}

export type FeedState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: Ranked[]; pool: number; index: DataIndex; candidates: VideoLite[] };

/** Loads the candidate pool for these prefs and ranks it. Pure function of its inputs. */
export function useFeed(prefs: Prefs, signals: Signals, limit: number, opts: { includeWatched?: boolean } = {}): FeedState {
  const index = useIndex();
  const topicKey = Object.keys(prefs.topics).sort().join(",");
  const [cands, setCands] = useState<{ key: string; list: VideoLite[]; prefs: Prefs } | { key: string; error: string } | null>(null);

  useEffect(() => {
    if (!index) return;
    let live = true;
    loadCandidates(prefs)
      .then((list) => live && setCands({ key: topicKey, list, prefs }))
      .catch((e: unknown) => live && setCands({ key: topicKey, error: e instanceof Error ? e.message : "failed" }));
    return () => { live = false; };
    // prefs.topics is captured via topicKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, topicKey]);

  return useMemo<FeedState>(() => {
    if (!index || !cands) return { status: "loading" };
    if ("error" in cands) return { status: "error", message: cands.error };
    const ctx = rankContext(index);
    // While a new topic's shard is loading, keep ranking the previous pool with its own prefs,
    // so the grid moves once, straight to the real result.
    const usePrefs = cands.key === topicKey ? prefs : cands.prefs;
    const items = rankFeed(cands.list, usePrefs, signals, ctx, { limit, includeWatched: opts.includeWatched });
    const sel = new Set(Object.keys(usePrefs.topics));
    const pool = sel.size ? cands.list.filter((v) => v.k.some((t) => sel.has(t)) && (usePrefs.news || v.sl !== "news")).length : index.stats.videos;
    return { status: "ready", items, pool, index, candidates: cands.list };
  }, [index, cands, prefs, topicKey, signals, limit, opts.includeWatched]);
}
