import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { VideoLite } from "@/core/types";

export const OG_SIZE = { width: 1200, height: 630 };

const fontDir = join(process.cwd(), "src", "assets", "fonts");
let fonts: Promise<{ name: string; data: Buffer; style: "normal" | "italic"; weight: 400 | 500 }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(fontDir, "InstrumentSerif-Regular.ttf")).then((data) => ({ name: "Serif", data, style: "normal" as const, weight: 400 as const })),
    readFile(join(fontDir, "InstrumentSerif-Italic.ttf")).then((data) => ({ name: "Serif", data, style: "italic" as const, weight: 400 as const })),
    readFile(join(fontDir, "JetBrainsMono-Medium.ttf")).then((data) => ({ name: "Mono", data, style: "normal" as const, weight: 500 as const })),
    // next/og's bundled sans; passing custom fonts would otherwise drop it.
    readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")).then((data) => ({ name: "Geist", data, style: "normal" as const, weight: 400 as const })),
  ]);
  return fonts;
}

const thumbCache = new Map<string, Promise<string | null>>();

/** Fetches a real YouTube thumbnail (the public i.ytimg.com image) as a data URI; null when missing or slow. */
function thumb(id: string): Promise<string | null> {
  let p = thumbCache.get(id);
  if (!p) {
    p = fetchThumb(id);
    thumbCache.set(id, p);
    if (thumbCache.size > 500) thumbCache.delete(thumbCache.keys().next().value!);
  }
  return p;
}

async function fetchThumb(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return null; // placeholder image
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const PAPER = "#f4f1ea";
const INK = "#15130f";
const MUTED = "#6d695f";
const MARKER = "#f1e05a";

export async function renderCard(opts: { kicker: string; title: string; topics: string[]; videos: VideoLite[]; footnote: string }) {
  const vids = opts.videos.slice(0, 4);
  const thumbs = await Promise.all(vids.map((v) => thumb(v.id)));
  const title = opts.title.length > 60 ? `${opts.title.slice(0, 58).trimEnd()}…` : opts.title;
  const titleSize = title.length <= 18 ? 84 : title.length <= 30 ? 66 : 52;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK, padding: 56, fontFamily: "Geist" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 520, paddingRight: 36 }}>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 30 }}>
            <span style={{ fontFamily: "Serif", fontStyle: "italic" }}>Tube</span>
            <span style={{ fontWeight: 700, letterSpacing: -1, backgroundImage: `linear-gradient(transparent 55%, ${MARKER} 55%)` }}>Remix</span>
          </div>
          <div style={{ display: "flex", marginTop: 46, fontFamily: "Mono", fontSize: 17, letterSpacing: 1.5, color: MUTED, textTransform: "uppercase" }}>{opts.kicker}</div>
          <div style={{ display: "flex", marginTop: 12, fontFamily: "Serif", fontSize: titleSize, lineHeight: 0.98, letterSpacing: -1.5 }}>{title}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
            {opts.topics.slice(0, 4).map((t) => (
              <div key={t} style={{ display: "flex", fontSize: 18, padding: "6px 14px", borderRadius: 999, background: INK, color: PAPER }}>{t}</div>
            ))}
            {opts.topics.length > 4 && <div style={{ display: "flex", fontSize: 20, padding: "7px 4px", color: MUTED }}>+{opts.topics.length - 4} more</div>}
          </div>
          <div style={{ display: "flex", marginTop: "auto", paddingTop: 18, fontSize: 17, color: MUTED, lineHeight: 1.35 }}>{opts.footnote}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 568, gap: 16, alignContent: "flex-start" }}>
          {vids.map((v, i) => (
            <div key={v.id} style={{ display: "flex", flexDirection: "column", width: 276 }}>
              {thumbs[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbs[i]!} width={276} height={155} style={{ borderRadius: 4, objectFit: "cover" }} alt="" />
              ) : (
                <div style={{ display: "flex", width: 276, height: 155, borderRadius: 4, border: `1px solid #d9d4c7`, padding: 14, fontFamily: "Serif", fontSize: 24, lineHeight: 1.05 }}>{v.t.slice(0, 60)}</div>
              )}
              <div style={{ display: "flex", marginTop: 9, fontSize: 18, fontWeight: 600, lineHeight: 1.2, height: 44, overflow: "hidden" }}>{v.t.length > 58 ? `${v.t.slice(0, 56)}…` : v.t}</div>
              <div style={{ display: "flex", marginTop: 3, fontFamily: "Mono", fontSize: 13, color: MUTED, textTransform: "uppercase" }}>{`${v.c.slice(0, 18)} · ${v.r} recommenders`}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: await loadFonts(),
      // A token always renders the same card, so it can be cached hard.
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
    },
  );
}
