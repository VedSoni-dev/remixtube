// Strict schemas for the HackerTube export (DATA.md, exported 2026-10-31).
// Unknown or missing fields fail the import instead of being guessed.
import { z } from "zod";
import { CONTENT_TYPES, LEVELS, SHELF_LIVES, STANCES } from "../core/types";

const vid = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const year = z.number().int().min(2005).max(2100);

export const UpstreamVideo = z.strictObject({
  vid,
  url: z.string().url(),
  title: z.string().min(1).max(500),
  channel: z.string().max(300),
  summary: z.string().max(4000),
  why_hn: z.string().max(4000),
  content_type: z.enum(CONTENT_TYPES),
  level: z.enum(LEVELS),
  shelf_life: z.enum(SHELF_LIVES),
  primary_topic: z.string().max(300),
  tags: z.array(z.string().max(200)).max(50),
  categories: z.array(z.strictObject({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    area: z.string().regex(/^[a-z0-9-]+$/),
    area_name: z.string(),
  })).max(5),
  quote: z.strictObject({
    text: z.string().max(4000),
    hn_comment_id: z.number().int().positive(),
    year: z.string().regex(/^\d{4}$/),
  }).nullable(),
  hn: z.strictObject({
    mentions: z.number().int().min(0).max(1000),
    recommenders: z.number().int().min(0),
    rec_months: z.number().int().min(0),
    strong_recs: z.number().int().min(0),
    stances: z.partialRecord(z.enum(STANCES), z.number().int().min(0)),
    first_year: year,
    last_year: year,
  }),
  score: z.number().min(0).max(1000),
});
export type UpstreamVideo = z.infer<typeof UpstreamVideo>;

export const UpstreamMention = z.strictObject({
  hn_comment_id: z.number().int().positive(),
  hn_url: z.string().url(),
  vid,
  author: z.string().max(100),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  story_title: z.string().max(1000),
  stance: z.enum(STANCES),
  why: z.string().max(1000),
  quote: z.string().max(4000),
  text: z.string().max(5000),
});
export type UpstreamMention = z.infer<typeof UpstreamMention>;

export const UpstreamRelated = z.strictObject({
  vid,
  related: z.array(z.strictObject({ vid, shared_recommenders: z.number().int().min(1) })).max(100),
});
export type UpstreamRelated = z.infer<typeof UpstreamRelated>;

export const UpstreamTaxonomy = z.strictObject({
  version: z.string(),
  areas: z.array(z.strictObject({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    categories: z.array(z.strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string(),
      description: z.string(),
    })),
  })),
});
export type UpstreamTaxonomy = z.infer<typeof UpstreamTaxonomy>;

export function parseJsonl<T>(text: string, schema: z.ZodType<T>, file: string): T[] {
  const out: T[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new Error(`${file}:${i + 1}: invalid JSON`);
    }
    const r = schema.safeParse(raw);
    if (!r.success) throw new Error(`${file}:${i + 1}: ${r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    out.push(r.data);
  }
  return out;
}
