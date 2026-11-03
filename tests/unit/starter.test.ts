// Downloads nothing: runs the packed starter ZIP and the guide's snippet against the cached export.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { configToPrefsInput } from "../../src/core/exporters";
import { sanitizePrefs } from "../../src/core/prefs";
import { emptySignals, rankFeed } from "../../src/core/rank";
import { readZip } from "../../src/pipeline/unzip";
import { ctx, hasData, hasZip, index, ROOT, shard, ZIP } from "./fixtures";

const STARTER_ZIP = join(ROOT, "public/download/tuberemix-starter.zip");
const ready = hasZip && hasData && existsSync(STARTER_ZIP);
const tmp = mkdtempSync(join(tmpdir(), "tuberemix-starter-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function unzipTo(zip: string, dir: string) {
  for (const e of readZip(readFileSync(zip))) {
    const p = join(dir, e.name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, e.data);
  }
}

describe.skipIf(!ready)("starter project", () => {
  it("builds the same feed as the site from a fresh unzip, with no npm install", () => {
    unzipTo(STARTER_ZIP, tmp);
    const dir = join(tmp, "my-tube");
    const out = execFileSync(process.execPath, ["build.mjs", "--data", ZIP, "--limit", "30"], { cwd: dir, encoding: "utf8" });
    expect(out).toMatch(/Wrote dist\/index.html with 30 videos/);
    const html = readFileSync(join(dir, "dist/index.html"), "utf8");
    const feed = JSON.parse(readFileSync(join(dir, "dist/feed.json"), "utf8")) as { id: string }[];

    const cfg = JSON.parse(readFileSync(join(dir, "tuberemix.config.json"), "utf8"));
    const idx = index();
    const prefs = sanitizePrefs(configToPrefsInput(cfg), new Set(idx.topics.map((t) => t.id)));
    const pool = [...Object.keys(prefs.topics).flatMap((t) => shard(`t/${t}.json`).videos), ...shard("staples.json").videos];
    const site = rankFeed(pool, prefs, emptySignals(), ctx(), { limit: 30 }).map((r) => r.video.id);
    expect(feed.map((f) => f.id)).toEqual(site);

    expect(html).toContain("news.ycombinator.com/item?id=");
    expect(html).toContain("ODC-By 1.0");
    expect(html).toContain(`data-id="${site[0]}"`);
    expect(html.match(/<script>/g)?.length).toBe(1); // only the template's own click handler
  });

  it("stops when the dataset checksum differs, unless told to continue", () => {
    const dir = join(tmp, "my-tube");
    const cfgPath = join(dir, "tuberemix.config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    writeFileSync(cfgPath, JSON.stringify({ ...cfg, source: { ...cfg.source, zip_sha256: "0".repeat(64) } }));
    expect(() => execFileSync(process.execPath, ["build.mjs", "--data", ZIP], { cwd: dir, stdio: "pipe" })).toThrow();
    const ok = execFileSync(process.execPath, ["build.mjs", "--data", ZIP, "--accept-new-data"], { cwd: dir, encoding: "utf8", stdio: "pipe" });
    expect(ok).toMatch(/Wrote dist/);
  });

  it("runs the guide's inspect snippet", () => {
    const data = join(tmp, "data");
    unzipTo(ZIP, data);
    const out = execFileSync(process.execPath, [join(ROOT, "src/snippets/inspect.mjs"), join(data, "hackertube-data")], { encoding: "utf8" });
    expect(out).toContain("6454 videos, 4796 recommended by at least one HN commenter");
    expect(out).toContain("39834 labeled comments");
  });
});
