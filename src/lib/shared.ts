import "server-only";
import { codeMap, rankContext } from "@/core/catalog";
import { emptySignals, rankFeed, type Ranked } from "@/core/rank";
import { decodeShare, splitShareSegment, slugify, type ShareConfig } from "@/core/share";
import type { DataIndex } from "@/core/types";
import { readCandidates, readIndex } from "./server-data";

export type SharedTube =
  | { ok: true; index: DataIndex; config: ShareConfig; token: string; slug: string; canonical: string; items: Ranked[]; pool: number; topicNames: string[] }
  | { ok: false; reason: string };

/** Decodes and ranks a shared Tube on the server, so a fresh browser sees the real feed. */
export async function resolveShared(segment: string, limit = 36): Promise<SharedTube> {
  const parts = splitShareSegment(segment);
  if (!parts) return { ok: false, reason: "shape" };
  const index = await readIndex();
  const decoded = decodeShare(parts.token, codeMap(index));
  if (!decoded.ok) return { ok: false, reason: decoded.error };
  const prefs = decoded.config.prefs;
  const cands = await readCandidates(prefs);
  const items = rankFeed(cands, prefs, emptySignals(), rankContext(index), { limit });
  const sel = new Set(Object.keys(prefs.topics));
  const pool = sel.size ? cands.filter((v) => v.k.some((t) => sel.has(t)) && (prefs.news || v.sl !== "news")).length : index.stats.videos;
  const names = new Map(index.topics.map((t) => [t.id, t.name]));
  const topicNames = Object.entries(prefs.topics).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => names.get(t) ?? t);
  const slug = slugify(prefs.name);
  return { ok: true, index, config: decoded.config, token: parts.token, slug, canonical: `/r/${slug}--${parts.token}`, items, pool, topicNames };
}
