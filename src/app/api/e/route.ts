// Analytics intake. Accepts only whitelisted event names and coarse numeric/enum props.
// No IP addresses, user agents or identifiers beyond a random per-tab session id are kept.
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

const EVENTS = new Set([
  "landing_view", "builder_started", "interests_selected", "feed_generated", "video_opened",
  "share_created", "shared_remix_opened", "remix_created", "remix_of_remix", "export",
]);
const SOURCES = new Set(["landing", "builder", "share", "tube", "customize", "describe"]);
const KINDS = new Set(["config", "playlist-json", "playlist-md", "playlist-csv", "starter", "prompt", "link", "youtube"]);
const MAX_BODY = 2048;

// Coarse flood guard per server instance: at most this many events per minute in total.
const PER_MINUTE = 1200;
let windowStart = 0;
let windowCount = 0;

/** Reads at most MAX_BODY bytes, whatever Content-Length claims. */
async function readCapped(req: Request): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function POST(req: Request): Promise<Response> {
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY) return new Response(null, { status: 413 });
  // Only our own pages may report: a foreign Origin is refused (sendBeacon sends Origin).
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return new Response(null, { status: 403 });
  const now = Date.now();
  if (now - windowStart > 60_000) { windowStart = now; windowCount = 0; }
  if (++windowCount > PER_MINUTE) return new Response(null, { status: 429 });

  const text = await readCapped(req);
  if (text === null) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  const b = body as { e?: unknown; s?: unknown; p?: Record<string, unknown> };
  if (typeof b.e !== "string" || !EVENTS.has(b.e)) return new Response(null, { status: 400 });
  const sid = typeof b.s === "string" && /^[0-9a-f]{16}$/.test(b.s) ? b.s : "anon";
  const p = b.p && typeof b.p === "object" ? b.p : {};
  const props: Record<string, string | number> = {};
  if (typeof p.source === "string" && SOURCES.has(p.source)) props.source = p.source;
  if (typeof p.kind === "string" && KINDS.has(p.kind)) props.kind = p.kind;
  if (typeof p.n === "number" && Number.isFinite(p.n)) props.n = Math.max(0, Math.min(50, Math.round(p.n)));
  // Durations are bucketed to the nearest 250 ms and capped at 10 minutes.
  if (typeof p.ms === "number" && Number.isFinite(p.ms)) props.ms = Math.min(600000, Math.max(0, Math.round(p.ms / 250) * 250));
  const line = JSON.stringify({ t: new Date().toISOString().slice(0, 16), e: b.e, s: sid, ...props });
  if (process.env.TUBEREMIX_ANALYTICS === "file") {
    try {
      await appendFile(join(process.cwd(), "analytics-events.jsonl"), line + "\n");
    } catch { /* read-only filesystem: fall through to the log */ }
  }
  console.log(`[tuberemix-event] ${line}`);
  return new Response(null, { status: 204 });
}
