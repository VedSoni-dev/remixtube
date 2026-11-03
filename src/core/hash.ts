// Small, dependency-free hashing used for deterministic choices (no Math.random).

/** 32-bit FNV-1a over the UTF-16 code units of a string. */
export function fnv1a(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic value in [0, 1) for a (seed, key) pair. */
export function hash01(seed: number, key: string): number {
  // Mix the seed in first so different seeds reorder keys independently.
  let h = fnv1a(key, (0x811c9dc5 ^ Math.imul(seed >>> 0, 0x9e3779b1)) >>> 0);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 0x100000000;
}

/** Stable 3-character base36 code for a topic id (used in share links). */
export function topicCode(id: string): string {
  return (fnv1a(id) % 46656).toString(36).padStart(3, "0");
}

/** Provenance shard bucket for a video id. Ids are case-sensitive, so files are named by bucket, not id. */
export const DETAIL_BUCKETS = 1024;
export function detailBucket(videoId: string): number {
  return fnv1a(videoId) % DETAIL_BUCKETS;
}

/** Short checksum for share tokens. */
export function checksum(input: string): string {
  return (fnv1a(input, 0x2545f491) % 1679616).toString(36).padStart(4, "0");
}
