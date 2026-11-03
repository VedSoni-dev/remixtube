// Share links: /r/<slug>--<token>. The token *is* the Tube's config, so two different
// Tubes can never collide, and no server storage is needed. Everything decoded is untrusted.

import { checksum, fnv1a, topicCode } from "./hash";
import { cleanName, defaultPrefs, MAX_TOPICS, type Prefs, type TopicWeight } from "./prefs";
import { CONTENT_TYPES, type ContentType } from "./types";

const FORMAT_LETTER: Record<ContentType, string> = {
  talk: "t", lecture: "l", course: "o", documentary: "d", explainer: "e", interview: "i",
  podcast: "p", tutorial: "u", demo: "m", news: "n", commentary: "c", comedy: "y", music: "s", other: "x",
};
const LETTER_FORMAT = Object.fromEntries(Object.entries(FORMAT_LETTER).map(([k, v]) => [v, k])) as Record<string, ContentType>;
const DEPTH = { any: "a", intro: "i", deep: "d" } as const;
const DEPTH_BACK: Record<string, Prefs["depth"]> = { a: "any", i: "intro", d: "deep" };

export const MAX_TOKEN = 360;

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** A stable short id for a token, used to record remix lineage without storing anything. */
export function tubeId(token: string): string {
  return (fnv1a(token) % 2176782336).toString(36).padStart(6, "0");
}

export function slugify(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s || "my-tube";
}

export interface ShareConfig {
  prefs: Prefs;
  parent: string | null; // tubeId of the Tube this was remixed from
}

export function encodeShare(cfg: ShareConfig): string {
  const p = cfg.prefs;
  const topics = Object.entries(p.topics)
    .map(([id, w]) => `${topicCode(id)}${w}`)
    .sort()
    .join("");
  const formats = (Object.entries(p.formats) as [ContentType, number][])
    .filter(([, v]) => v === 1 || v === -1)
    .map(([ty, v]) => (v === 1 ? FORMAT_LETTER[ty].toUpperCase() : FORMAT_LETTER[ty]))
    .sort()
    .join("");
  const body = [
    "1",
    topics || "-",
    formats || "-",
    `${DEPTH[p.depth]}${p.serendipity}${p.news ? 1 : 0}`,
    (p.seed >>> 0).toString(36),
    b64urlEncode(cleanName(p.name)) || "-",
    cfg.parent && /^[0-9a-z]{6}$/.test(cfg.parent) ? cfg.parent : "-",
  ].join(".");
  return `${body}.${checksum(body)}`;
}

export type DecodeResult = { ok: true; config: ShareConfig } | { ok: false; error: string };

/** Strictly decodes a token. `codeToTopic` maps 3-char codes to known topic ids. */
export function decodeShare(token: string, codeToTopic: ReadonlyMap<string, string>): DecodeResult {
  if (typeof token !== "string" || token.length < 12 || token.length > MAX_TOKEN) return { ok: false, error: "length" };
  if (!/^[A-Za-z0-9._-]+$/.test(token)) return { ok: false, error: "charset" };
  const parts = token.split(".");
  if (parts.length !== 8) return { ok: false, error: "shape" };
  const [ver, topics, formats, flags, seed, name, parent, check] = parts as [string, string, string, string, string, string, string, string];
  if (ver !== "1") return { ok: false, error: "version" };
  if (checksum(parts.slice(0, 7).join(".")) !== check) return { ok: false, error: "checksum" };

  const prefs = defaultPrefs();
  if (topics !== "-") {
    if (!/^([0-9a-z]{3}[123])+$/.test(topics) || topics.length / 4 > MAX_TOPICS) return { ok: false, error: "topics" };
    for (let i = 0; i < topics.length; i += 4) {
      const id = codeToTopic.get(topics.slice(i, i + 3));
      if (!id) return { ok: false, error: "unknown-topic" };
      prefs.topics[id] = Number(topics[i + 3]) as TopicWeight;
    }
  }
  if (formats !== "-") {
    if (!/^[A-Za-z]{1,14}$/.test(formats)) return { ok: false, error: "formats" };
    for (const ch of formats) {
      const ty = LETTER_FORMAT[ch.toLowerCase()];
      if (!ty || !(CONTENT_TYPES as readonly string[]).includes(ty)) return { ok: false, error: "formats" };
      prefs.formats[ty] = ch === ch.toUpperCase() ? 1 : -1;
    }
  }
  const fm = /^([aid])([0-3])([01])$/.exec(flags);
  if (!fm) return { ok: false, error: "flags" };
  prefs.depth = DEPTH_BACK[fm[1]!]!;
  prefs.serendipity = Number(fm[2]) as Prefs["serendipity"];
  prefs.news = fm[3] === "1";
  if (!/^[0-9a-z]{1,7}$/.test(seed)) return { ok: false, error: "seed" };
  const seedNum = parseInt(seed, 36);
  if (!Number.isFinite(seedNum) || seedNum > 0xffffffff) return { ok: false, error: "seed" };
  prefs.seed = seedNum;
  if (name !== "-") {
    const decoded = b64urlDecode(name);
    if (decoded === null) return { ok: false, error: "name" };
    prefs.name = cleanName(decoded);
  }
  if (parent !== "-" && !/^[0-9a-z]{6}$/.test(parent)) return { ok: false, error: "parent" };
  return { ok: true, config: { prefs, parent: parent === "-" ? null : parent } };
}

/** Splits the /r/ path segment into slug and token. Slugs never contain "--". */
export function splitShareSegment(segment: string): { slug: string; token: string } | null {
  let s = segment;
  try {
    s = decodeURIComponent(segment);
  } catch {
    return null;
  }
  const i = s.indexOf("--");
  if (i <= 0) return null;
  return { slug: s.slice(0, i), token: s.slice(i + 2) };
}

export function sharePath(cfg: ShareConfig): string {
  const token = encodeShare(cfg);
  return `/r/${slugify(cfg.prefs.name)}--${token}`;
}
