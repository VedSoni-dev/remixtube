"use client";
// Browser data access: small static JSON files, fetched on demand and memoised.
import { loadCandidates as loadCandidatesWith, loadDetail as loadDetailWith, type JsonLoader } from "@/core/catalog";
import type { Prefs } from "@/core/prefs";
import type { DataIndex, Shard, VideoDetail, VideoLite } from "@/core/types";

const cache = new Map<string, Promise<unknown>>();

export const fetchJson: JsonLoader = <T,>(path: string) => {
  if (!/^[a-z0-9/_.-]+\.json$/.test(path) || path.includes("..")) return Promise.reject(new Error("bad path"));
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`/data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
};

export const loadIndex = () => fetchJson<DataIndex>("index.json");
export const loadStaples = () => fetchJson<Shard>("staples.json");
export const loadTopicShard = (id: string) => fetchJson<Shard>(`t/${id}.json`);
export const loadAreaShard = (id: string) => fetchJson<Shard>(`a/${id}.json`);

export async function loadCandidates(prefs: Prefs): Promise<VideoLite[]> {
  return loadCandidatesWith(fetchJson, await loadIndex(), prefs);
}

export function loadDetail(id: string): Promise<VideoDetail | null> {
  return loadDetailWith(fetchJson, id);
}
