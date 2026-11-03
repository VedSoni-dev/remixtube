// npm run analytics:report [-- path/to/events.jsonl]
// Computes the launch funnel from the event log written by /api/e (TUBEREMIX_ANALYTICS=file),
// or from server logs: lines containing "[tuberemix-event] {...}".
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "analytics-events.jsonl";
const rows: { e: string; s: string; ms?: number; kind?: string }[] = [];
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const i = line.indexOf("{");
  if (i < 0) continue;
  try { rows.push(JSON.parse(line.slice(i))); } catch { /* skip */ }
}

const sessions = (e: string) => new Set(rows.filter((r) => r.e === e && r.s !== "anon").map((r) => r.s));
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
const landing = sessions("landing_view");
const feed = sessions("feed_generated");
const opened = sessions("video_opened");
const shared = sessions("share_created");
const sharedOpen = sessions("shared_remix_opened");
const remixed = sessions("remix_of_remix");
const exported = sessions("export");
const visitors = new Set([...landing, ...sharedOpen]);

const ttf = rows.filter((r) => r.e === "feed_generated" && typeof r.ms === "number" && r.ms > 0).map((r) => r.ms!).sort((a, b) => a - b);
const median = ttf.length ? ttf[Math.floor(ttf.length / 2)]! : null;

console.log(`events: ${rows.length}, tab sessions: ${new Set(rows.map((r) => r.s)).size}`);
console.log(`visitor -> feed:        ${feed.size}/${visitors.size} (${pct(feed.size, visitors.size)})`);
console.log(`median time-to-feed:    ${median === null ? "n/a" : `${(median / 1000).toFixed(1)} s`} (n=${ttf.length})`);
console.log(`feed -> video opened:   ${pct([...feed].filter((s) => opened.has(s)).length, feed.size)}`);
console.log(`feed -> share:          ${pct([...feed].filter((s) => shared.has(s)).length, feed.size)}`);
console.log(`shared opened -> remix: ${pct([...sharedOpen].filter((s) => remixed.has(s)).length, sharedOpen.size)}`);
console.log(`feed -> export:         ${pct([...feed].filter((s) => exported.has(s)).length, feed.size)}`);
const kinds = new Map<string, number>();
for (const r of rows) if (r.e === "export" && r.kind) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
console.log(`exports by kind:        ${[...kinds].map(([k, n]) => `${k}=${n}`).join(", ") || "none"}`);
