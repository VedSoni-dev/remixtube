// npm run data:import [-- --zip path/to/hackertube-data.zip] [--update-lock] [--check] [--out dir]
// Downloads (or reads) the pinned HackerTube export, verifies its sha256, validates every
// record, and writes the static catalog the app serves. Deterministic: same zip, same bytes.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildCatalog, diffManifests } from "../src/pipeline/build";
import { hackertube } from "../src/pipeline/sources";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const lockPath = join(root, "data/source.lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8")) as { url: string; sha256: string; bytes: number; exported: string };
const outDir = resolve(root, opt("--out") ?? "public/data");
const cachePath = join(root, ".cache/hackertube-data.zip");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function getZip(): Promise<Buffer> {
  const local = opt("--zip");
  if (local) return readFileSync(resolve(local));
  if (existsSync(cachePath)) {
    const b = readFileSync(cachePath);
    if (sha(b) === lock.sha256 || flag("--update-lock")) return b;
  }
  const url = process.env.HACKERTUBE_DATA_URL || lock.url;
  console.log(`downloading ${url}`);
  const res = await fetch(url, { headers: { "user-agent": "tuberemix-import (+https://github.com/VedSoni-dev/remixtube)" } });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const b = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, b);
  return b;
}

const zip = await getZip();
const digest = sha(zip);
if (digest !== lock.sha256) {
  if (!flag("--update-lock")) {
    console.error(`sha256 mismatch: expected ${lock.sha256}, got ${digest}.`);
    console.error("Upstream published a new export. Review it, then run: npm run data:import -- --update-lock");
    process.exit(2);
  }
}

const t0 = Date.now();
const bundle = hackertube.parse(zip);
const result = buildCatalog(bundle, hackertube, digest);

const prevManifestPath = join(outDir, "manifest.json");
const prev = existsSync(prevManifestPath) ? JSON.parse(readFileSync(prevManifestPath, "utf8")) : null;
const nextManifest = JSON.parse(result.files.get("manifest.json")!);

if (flag("--check")) {
  let bad = 0;
  for (const [p, body] of result.files) {
    const f = join(outDir, p);
    if (!existsSync(f) || readFileSync(f, "utf8") !== body) { bad++; if (bad < 10) console.error(`differs: ${p}`); }
  }
  console.log(bad ? `check failed: ${bad} files differ` : `check ok: ${result.files.size} files match`);
  process.exit(bad ? 1 : 0);
}

for (const sub of ["t", "a", "d"]) rmSync(join(outDir, sub), { recursive: true, force: true });
for (const [p, body] of result.files) {
  const f = join(outDir, p);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, body);
}
if (flag("--update-lock")) {
  writeFileSync(lockPath, JSON.stringify({ ...lock, bytes: zip.length, sha256: digest, exported: bundle.exported, checked: new Date().toISOString().slice(0, 10) }, null, 2) + "\n");
}
const diff = diffManifests(prev, nextManifest);
writeFileSync(join(root, "data/import-report.json"), JSON.stringify({ ...result.report, diff: { added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length } }, null, 2) + "\n");
console.log(JSON.stringify(result.report, null, 2));
console.log(`diff vs previous: +${diff.added.length} -${diff.removed.length} ~${diff.changed.length}`);
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${outDir}`);
