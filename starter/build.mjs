#!/usr/bin/env node
// Build your own HackerTube-style page from tuberemix.config.json.
// Usage: node build.mjs [--data path/to/hackertube-data.zip] [--limit 60] [--accept-new-data]
// No dependencies: Node 20+ only.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCatalog, configToPrefsInput, emptySignals, hackertube, rankContext, rankFeed, sanitizePrefs, WEIGHTS,
} from "./lib/tuberemix.mjs";
import { renderPage } from "./template.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const limit = Math.max(1, Math.min(500, Number(opt("--limit") ?? 60)));

const config = JSON.parse(readFileSync(join(here, "tuberemix.config.json"), "utf8"));
if (config.tuberemix !== 1) throw new Error("tuberemix.config.json: expected \"tuberemix\": 1");
const source = config.source ?? {};
// Only an https URL from the config is used; anything else falls back to HackerTube itself.
const dataUrl = /^https:\/\//i.test(source.data_url ?? "") ? source.data_url : hackertube.dataUrl;

async function getZip() {
  const local = opt("--data");
  if (local) return readFileSync(resolve(local));
  const cache = join(here, ".cache", "hackertube-data.zip");
  if (existsSync(cache)) return readFileSync(cache);
  console.log(`Downloading ${dataUrl} (about 18 MB)…`);
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, buf);
  return buf;
}

const zip = await getZip();
const sha = createHash("sha256").update(zip).digest("hex");
if (!source.zip_sha256) console.warn(`No zip_sha256 in your config, so the data isn't pinned. This download's sha256: ${sha}`);
if (source.zip_sha256 && sha !== source.zip_sha256) {
  const msg = `The dataset changed upstream (sha256 ${sha.slice(0, 12)}…, your config expects ${source.zip_sha256.slice(0, 12)}…).`;
  if (!args.includes("--accept-new-data")) {
    console.error(`${msg}\nYour feed may differ from the one you exported. Re-run with --accept-new-data to use it anyway.`);
    process.exit(2);
  }
  console.warn(`${msg} Continuing because of --accept-new-data.`);
}

console.log("Validating and normalising the data…");
const bundle = hackertube.parse(zip);
bundle.embeddings = null; // "similar videos" is not needed for a static page; skipping saves ~10 s
const catalog = buildCatalog(bundle, hackertube, sha);
const index = catalog.index;
const known = new Set(index.topics.map((t) => t.id));
const prefs = sanitizePrefs(configToPrefsInput(config), known);
const dropped = Object.keys(config.topics ?? {}).filter((t) => !known.has(t));
if (dropped.length) console.warn(`Ignoring unknown topics: ${dropped.join(", ")}`);

// Tune the ranking here if you like, e.g. care more about how many people recommended a video:
// WEIGHTS.crowd = 0.3;   WEIGHTS.quality = 0.4;   (all weights: see WEIGHTS in lib/tuberemix.mjs)
void WEIGHTS;

// Same candidate pool as the site: your topics plus the all-time staples.
const staples = JSON.parse(catalog.files.get("staples.json")).videos;
const pool = new Map();
for (const t of Object.keys(prefs.topics)) for (const v of JSON.parse(catalog.files.get(`t/${t}.json`)).videos) pool.set(v.id, v);
for (const v of staples) if (!pool.has(v.id)) pool.set(v.id, v);
const items = rankFeed([...pool.values()], prefs, emptySignals(), rankContext(index), { limit });

// Provenance for each video (the HN comments behind it).
const details = {};
for (const [path, body] of catalog.files) {
  if (!path.startsWith("d/")) continue;
  const bucket = JSON.parse(body);
  for (const r of items) if (bucket[r.video.id]) details[r.video.id] = bucket[r.video.id];
}

mkdirSync(join(here, "dist"), { recursive: true });
const html = renderPage({ config, prefs, index, items, details });
writeFileSync(join(here, "dist", "index.html"), html);
writeFileSync(join(here, "dist", "feed.json"), JSON.stringify(items.map((r, i) => ({ position: i + 1, id: r.video.id, title: r.video.t, channel: r.video.c, reasons: r.reasons.map((x) => x.text) })), null, 2));
console.log(`Wrote dist/index.html with ${items.length} videos for ${Object.keys(prefs.topics).length} topics. Run: node serve.mjs`);
