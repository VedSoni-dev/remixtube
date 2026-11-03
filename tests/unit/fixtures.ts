import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { rankContext } from "../../src/core/catalog";
import type { DataIndex, Shard, VideoLite } from "../../src/core/types";

export const ROOT = resolve(import.meta.dirname, "../..");
export const DATA = join(ROOT, "public/data");
export const ZIP = join(ROOT, ".cache/hackertube-data.zip");
export const hasData = existsSync(join(DATA, "index.json"));
export const hasZip = existsSync(ZIP);

export const index = (): DataIndex => JSON.parse(readFileSync(join(DATA, "index.json"), "utf8"));
export const shard = (p: string): Shard => JSON.parse(readFileSync(join(DATA, p), "utf8"));
export const ctx = () => rankContext(index());

let n = 0;
export function vid(over: Partial<VideoLite> = {}): VideoLite {
  n++;
  const id = (over.id ?? `v${String(n).padStart(10, "0")}`).slice(0, 11).padEnd(11, "x");
  return { id, t: `Video ${n}`, c: `Channel ${n % 7}`, k: ["a"], ty: "talk", lv: "general", sl: "evergreen", s: 5, r: 5, m: 8, rc: 6, sr: 2, cr: 0, y0: 2015, y1: 2020, ...over };
}

export const smallCtx = {
  maxScore: 25,
  maxRecommenders: 19,
  topicArea: new Map([["a", "x"], ["b", "x"], ["c", "y"], ["d", "z"]]),
  topicName: new Map([["a", "Alpha"], ["b", "Beta"], ["c", "Gamma"], ["d", "Delta"]]),
};
