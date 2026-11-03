import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCandidates as loadCandidatesWith, type JsonLoader } from "@/core/catalog";
import type { Prefs } from "@/core/prefs";
import type { DataIndex, VideoLite } from "@/core/types";

const dir = join(process.cwd(), "public", "data");
const cache = new Map<string, Promise<unknown>>();

export const readJson: JsonLoader = <T,>(path: string) => {
  if (!/^[a-z0-9/_.-]+\.json$/.test(path) || path.includes("..")) return Promise.reject(new Error("bad path"));
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = readFile(join(dir, path), "utf8").then((s) => JSON.parse(s) as T);
    p.catch(() => cache.delete(path));
    if (process.env.NODE_ENV === "production") cache.set(path, p);
  }
  return p;
};

export const readIndex = () => readJson<DataIndex>("index.json");

export async function readCandidates(prefs: Prefs): Promise<VideoLite[]> {
  return loadCandidatesWith(readJson, await readIndex(), prefs);
}
