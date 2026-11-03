import { CONTENT_TYPES, type ContentType } from "./types";

/** How strongly you want a topic: 1 = curious, 2 = into it, 3 = obsessed. */
export type TopicWeight = 1 | 2 | 3;
export type FormatPref = -1 | 1;
export type Depth = "any" | "intro" | "deep";
export type Serendipity = 0 | 1 | 2 | 3;

export interface Prefs {
  name: string;
  topics: Record<string, TopicWeight>;
  formats: Partial<Record<ContentType, FormatPref>>;
  depth: Depth;
  serendipity: Serendipity;
  news: boolean; // include videos that only mattered around one news event
  seed: number; // uint32; changes the tie-breaking and serendipity picks
}

export const MAX_TOPICS = 16;
export const MAX_NAME = 48;

export function defaultPrefs(): Prefs {
  return { name: "", topics: {}, formats: {}, depth: "any", serendipity: 1, news: false, seed: 1 };
}

/** Removes control, bidi-override and zero-width characters and trims to MAX_NAME. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const stripped = raw
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(stripped).slice(0, MAX_NAME).join("").trim();
}

/** Validates an untrusted prefs-like object against the known topic ids. */
export function sanitizePrefs(input: unknown, knownTopics: ReadonlySet<string>): Prefs {
  const p = defaultPrefs();
  if (!input || typeof input !== "object") return p;
  const o = input as Record<string, unknown>;
  p.name = cleanName(o.name);
  if (o.topics && typeof o.topics === "object") {
    for (const [id, w] of Object.entries(o.topics as Record<string, unknown>)) {
      if (Object.keys(p.topics).length >= MAX_TOPICS) break;
      if (knownTopics.has(id) && (w === 1 || w === 2 || w === 3)) p.topics[id] = w;
    }
  }
  if (o.formats && typeof o.formats === "object") {
    for (const [ty, v] of Object.entries(o.formats as Record<string, unknown>)) {
      if ((CONTENT_TYPES as readonly string[]).includes(ty) && (v === 1 || v === -1)) {
        p.formats[ty as ContentType] = v;
      }
    }
  }
  if (o.depth === "intro" || o.depth === "deep" || o.depth === "any") p.depth = o.depth;
  if (o.serendipity === 0 || o.serendipity === 1 || o.serendipity === 2 || o.serendipity === 3) {
    p.serendipity = o.serendipity;
  }
  p.news = o.news === true;
  if (typeof o.seed === "number" && Number.isInteger(o.seed) && o.seed >= 0 && o.seed <= 0xffffffff) {
    p.seed = o.seed;
  }
  return p;
}

export function selectedTopics(p: Prefs): string[] {
  return Object.keys(p.topics).sort();
}
