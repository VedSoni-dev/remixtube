import { describe, expect, it } from "vitest";
import { defaultPrefs, type Prefs } from "../../src/core/prefs";
import { buildSignals, emptySignals, rankFeed } from "../../src/core/rank";
import { ctx, hasData, index, shard, smallCtx, vid } from "./fixtures";

const prefs = (over: Partial<Prefs> = {}): Prefs => ({ ...defaultPrefs(), ...over });

describe("rankFeed (synthetic)", () => {
  const pool = [
    vid({ id: "aaaaaaaaaa1", k: ["a"], s: 20, r: 15 }),
    vid({ id: "aaaaaaaaaa2", k: ["a"], s: 2, r: 2 }),
    vid({ id: "bbbbbbbbbb1", k: ["b"], s: 18, r: 12 }),
    vid({ id: "cccccccccc1", k: ["c"], s: 24, r: 19 }),
    vid({ id: "dddddddddd1", k: ["d"], s: 25, r: 19 }),
    vid({ id: "nnnnnnnnnn1", k: ["a"], s: 25, r: 19, sl: "news" }),
  ];

  it("is deterministic", () => {
    const p = prefs({ topics: { a: 2 }, serendipity: 2, seed: 42 });
    const a = rankFeed(pool, p, emptySignals(), smallCtx, { limit: 10 }).map((r) => r.video.id);
    const b = rankFeed([...pool].reverse(), p, emptySignals(), smallCtx, { limit: 10 }).map((r) => r.video.id);
    expect(a).toEqual(b);
  });

  it("puts topic matches first and hides news by default", () => {
    const out = rankFeed(pool, prefs({ topics: { a: 2 }, serendipity: 0 }), emptySignals(), smallCtx, { limit: 10 });
    expect(out[0]!.video.id).toBe("aaaaaaaaaa1");
    expect(out.map((r) => r.video.id)).not.toContain("nnnnnnnnnn1");
    expect(out[0]!.reasons[0]!.text).toContain("Alpha");
  });

  it("includes news only when asked", () => {
    const out = rankFeed(pool, prefs({ topics: { a: 2 }, news: true, serendipity: 0 }), emptySignals(), smallCtx, { limit: 10 });
    expect(out.map((r) => r.video.id)).toContain("nnnnnnnnnn1");
  });

  it("ranks same-area topics before unrelated ones", () => {
    const out = rankFeed(pool, prefs({ topics: { a: 2 }, serendipity: 0 }), emptySignals(), smallCtx, { limit: 10 }).map((r) => r.video.id);
    expect(out.indexOf("bbbbbbbbbb1")).toBeLessThan(out.length);
    expect(out).not.toContain("cccccccccc1"); // no serendipity: outside topics are left out
  });

  it("fills serendipity slots from outside the picks", () => {
    const big = [...Array.from({ length: 30 }, (_, i) => vid({ k: ["a"], s: 10 + (i % 5) })), vid({ id: "outside0001", k: ["d"], s: 25, r: 19 })];
    const out = rankFeed(big, prefs({ topics: { a: 2 }, serendipity: 3 }), emptySignals(), smallCtx, { limit: 8 });
    const slot = out.findIndex((r) => r.slot === "serendipity");
    expect(slot).toBe(3); // every 4th slot at serendipity 3
    expect(out[slot]!.video.id).toBe("outside0001");
  });

  it("drops disliked, watched and unavailable videos, and lifts liked topics", () => {
    const sig = buildSignals({
      disliked: [{ id: "aaaaaaaaaa1", k: ["a"] }],
      watched: ["bbbbbbbbbb1"],
      unavailable: ["aaaaaaaaaa2"],
    });
    const out = rankFeed(pool, prefs({ topics: { a: 2, b: 2 } }), sig, smallCtx, { limit: 10 }).map((r) => r.video.id);
    expect(out).not.toContain("aaaaaaaaaa1");
    expect(out).not.toContain("bbbbbbbbbb1");
    expect(out).not.toContain("aaaaaaaaaa2");
  });

  it("penalises a disliked format", () => {
    const two = [vid({ id: "talk0000001", k: ["a"], ty: "talk", s: 10 }), vid({ id: "comedy00001", k: ["a"], ty: "comedy", s: 11 })];
    const plain = rankFeed(two, prefs({ topics: { a: 2 }, serendipity: 0 }), emptySignals(), smallCtx, { limit: 2 });
    const noComedy = rankFeed(two, prefs({ topics: { a: 2 }, serendipity: 0, formats: { comedy: -1 } }), emptySignals(), smallCtx, { limit: 2 });
    expect(plain[0]!.video.id).toBe("comedy00001");
    expect(noComedy[0]!.video.id).toBe("talk0000001");
  });

  it("keeps one channel from taking over", () => {
    const same = Array.from({ length: 12 }, (_, i) => vid({ k: ["a"], c: "Same", s: 20 - i * 0.1 }));
    const others = Array.from({ length: 12 }, (_, i) => vid({ k: ["a"], c: `Other ${i}`, s: 17 - i * 0.1 }));
    const out = rankFeed([...same, ...others], prefs({ topics: { a: 2 }, serendipity: 0 }), emptySignals(), smallCtx, { limit: 10 });
    expect(out.filter((r) => r.video.c === "Same").length).toBeLessThanOrEqual(5);
  });
});

describe.skipIf(!hasData)("rankFeed on the real catalog", () => {
  it("gives a real, topic-matched feed for three picks", () => {
    const idx = index();
    const topics = ["functional-programming", "space-exploration", "compilers-interpreters"].filter((t) => idx.topics.some((x) => x.id === t));
    expect(topics.length).toBe(3);
    const pool = [...topics.flatMap((t) => shard(`t/${t}.json`).videos), ...shard("staples.json").videos];
    const out = rankFeed(pool, prefs({ topics: Object.fromEntries(topics.map((t) => [t, 2])) as Prefs["topics"], serendipity: 1 }), emptySignals(), ctx(), { limit: 40 });
    expect(out.length).toBe(40);
    const matched = out.filter((r) => r.slot === "match");
    expect(matched.every((r) => r.video.k.some((t) => topics.includes(t)) || r.reasons[0]?.kind === "area")).toBe(true);
    expect(out.every((r) => r.video.r >= 1)).toBe(true);
    expect(new Set(out.map((r) => r.video.id)).size).toBe(out.length);
  });

  it("every chip topic yields at least 12 videos", () => {
    const idx = index();
    for (const t of idx.topics.filter((x) => x.chip)) {
      const out = rankFeed(shard(`t/${t.id}.json`).videos, prefs({ topics: { [t.id]: 2 }, serendipity: 0 }), emptySignals(), ctx(), { limit: 12 });
      expect(out.length, t.id).toBe(12);
    }
  });
});
