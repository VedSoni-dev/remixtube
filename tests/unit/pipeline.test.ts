import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { writeZip } from "../../src/core/zip";
import { buildCatalog } from "../../src/pipeline/build";
import { readNpy } from "../../src/pipeline/npy";
import { parseJsonl, UpstreamVideo } from "../../src/pipeline/schema";
import { hackertube } from "../../src/pipeline/sources";
import { readZip } from "../../src/pipeline/unzip";
import { hasZip, ZIP } from "./fixtures";

describe("zip + npy readers", () => {
  it("round-trips the zip writer through the reader", () => {
    const files = [{ name: "a/b.txt", data: "hello ✓" }, { name: "c.json", data: JSON.stringify({ x: 1 }) }];
    const back = readZip(Buffer.from(writeZip(files)));
    expect(back.map((e) => [e.name, e.data.toString("utf8")])).toEqual(files.map((f) => [f.name, f.data]));
  });

  it("refuses path traversal in archives", () => {
    expect(() => readZip(Buffer.from(writeZip([{ name: "../evil.txt", data: "x" }])))).toThrow(/unsafe/);
  });

  it("reads a float16 npy matrix", () => {
    const header = "{'descr': '<f2', 'fortran_order': False, 'shape': (2, 2), }";
    const pad = 64 - ((10 + header.length + 1) % 64);
    const h = Buffer.from(header + " ".repeat(pad) + "\n", "latin1");
    const pre = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, h.length & 0xff, h.length >> 8]);
    const body = Buffer.alloc(8);
    [0x3c00, 0xbc00, 0x3800, 0x0000].forEach((v, i) => body.writeUInt16LE(v, i * 2)); // 1, -1, 0.5, 0
    const m = readNpy(Buffer.concat([pre, h, body]));
    expect([m.rows, m.cols, ...m.data]).toEqual([2, 2, 1, -1, 0.5, 0]);
  });
});

describe("schema", () => {
  it("rejects unknown fields and bad ids", () => {
    const good = '{"vid":"fNk_zzaMoSs","url":"https://www.youtube.com/watch?v=fNk_zzaMoSs","title":"T","channel":"C","summary":"","why_hn":"","content_type":"talk","level":"general","shelf_life":"evergreen","primary_topic":"x","tags":[],"categories":[],"quote":null,"hn":{"mentions":1,"recommenders":1,"rec_months":1,"strong_recs":0,"stances":{"rec":1},"first_year":2010,"last_year":2011},"score":1}';
    expect(parseJsonl(good, UpstreamVideo, "v")).toHaveLength(1);
    expect(() => parseJsonl(good.replace('"score":1', '"score":1,"extra":2'), UpstreamVideo, "v")).toThrow(/v:1/);
    expect(() => parseJsonl(good.replace("fNk_zzaMoSs\",\"url", "bad id\",\"url"), UpstreamVideo, "v")).toThrow();
    expect(() => parseJsonl("{not json", UpstreamVideo, "v")).toThrow(/invalid JSON/);
  });
});

describe.skipIf(!hasZip)("import of the real HackerTube export", () => {
  const raw = readFileSync(ZIP);
  const sha = createHash("sha256").update(raw).digest("hex");
  const bundle = hackertube.parse(raw);
  const noEmb = { ...bundle, embeddings: null };
  const a = buildCatalog(noEmb, hackertube, sha);

  it("matches the published counts", () => {
    expect(bundle.videos).toHaveLength(6454);
    expect(bundle.mentions).toHaveLength(39834);
    expect(bundle.taxonomy.areas).toHaveLength(16);
    expect(a.index.stats.source_recommendations).toBe(16184);
    expect(a.report.dropped.no_recommenders).toBe(1658);
  });

  it("is deterministic (byte-identical output)", () => {
    const b = buildCatalog(noEmb, hackertube, sha);
    expect([...b.files.entries()]).toEqual([...a.files.entries()]);
  });

  it("keeps provenance real and complete", () => {
    const mentionIds = new Set(bundle.mentions.map((m) => `${m.hn_comment_id}:${m.vid}`));
    for (const [p, body] of a.files) {
      if (!p.startsWith("d/")) continue;
      for (const [id, d] of Object.entries(JSON.parse(body) as Record<string, { mentions: { id: number }[]; v: { r: number } }>)) {
        expect(d.v.r).toBeGreaterThanOrEqual(1);
        expect(d.mentions.length).toBeGreaterThan(0);
        for (const m of d.mentions) expect(mentionIds.has(`${m.id}:${id}`)).toBe(true);
      }
    }
  });

  it("dedupes ids and duplicate uploads", () => {
    const ids = a.videos.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.report.duplicate_title_examples.some((x) => /Inventing on Principle/.test(x.title))).toBe(true);
  });
});
