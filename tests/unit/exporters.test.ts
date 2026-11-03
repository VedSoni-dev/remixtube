import { describe, expect, it } from "vitest";
import { describeWithKeywords, parseAiSuggestion } from "../../src/core/describe";
import { claudeCodePrompt, configToPrefsInput, playlistCsv, playlistMarkdown, toConfig, youtubeQueueUrl } from "../../src/core/exporters";
import { defaultPrefs, sanitizePrefs } from "../../src/core/prefs";
import type { Ranked } from "../../src/core/rank";
import { hasData, index, vid } from "./fixtures";

const items: Ranked[] = [
  { video: vid({ id: "AAAAAAAAAAA", t: "=HYPERLINK(\"evil\")", c: "Chan, \"quoted\"" }), score: 1, reasons: [], slot: "match" },
  { video: vid({ id: "BBBBBBBBBBB", t: "A *bold* [title](x)" }), score: 1, reasons: [], slot: "match" },
];

describe("exporters", () => {
  it("neutralises spreadsheet formulas and quotes CSV", () => {
    const csv = playlistCsv(items);
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(csv).toContain(`"Chan, ""quoted"""`);
  });

  it("escapes Markdown in titles", () => {
    expect(playlistMarkdown("Mine", items, "https://x")).toContain("A \\*bold\\* \\[title\\]\\(x\\)");
  });

  it("builds a YouTube queue of at most 50", () => {
    const many = Array.from({ length: 70 }, () => items[0]!);
    expect(youtubeQueueUrl(many).split(",").length).toBe(50);
  });

  it.skipIf(!hasData)("config round-trips into prefs and the prompt embeds it", () => {
    const idx = index();
    const p = { ...defaultPrefs(), name: "Mine", topics: { [idx.topics[0]!.id]: 3 as const }, formats: { talk: 1 as const } };
    const cfg = toConfig(p, null, "https://example/r/mine--1", idx);
    expect(sanitizePrefs(configToPrefsInput(JSON.parse(JSON.stringify(cfg))), new Set(idx.topics.map((t) => t.id)))).toEqual(p);
    const prompt = claudeCodePrompt(cfg, "https://example");
    expect(prompt).toContain("https://example/download/tuberemix-starter.zip");
    expect(prompt).toContain(JSON.stringify(cfg, null, 2));
  });
});

describe.skipIf(!hasData)("describe your Tube", () => {
  const idx = index();
  it("maps plain words to real topics", () => {
    const s = describeWithKeywords("deep technical talks on databases and distributed systems, plus space history. no comedy", idx);
    expect(Object.keys(s.topics)).toEqual(expect.arrayContaining(["distributed-systems", "databases-storage"]));
    expect(s.formats.comedy).toBe(-1);
    expect(s.formats.talk).toBe(1);
    expect(s.depth).toBe("deep");
  });
  it("returns nothing for gibberish", () => {
    expect(Object.keys(describeWithKeywords("qwxz vbnm", idx).topics)).toHaveLength(0);
  });
  it("drops topic ids a model invents", () => {
    const s = parseAiSuggestion('Sure! {"topics":[{"id":"distributed-systems","weight":3},{"id":"made-up","weight":2}],"name":"x"}', idx);
    expect(s?.topics).toEqual({ "distributed-systems": 3 });
    expect(parseAiSuggestion('{"topics":[{"id":"nope"}]}', idx)).toBeNull();
    expect(parseAiSuggestion("no json here", idx)).toBeNull();
  });
});
