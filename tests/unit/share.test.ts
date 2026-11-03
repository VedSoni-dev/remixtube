import { describe, expect, it } from "vitest";
import { codeMap } from "../../src/core/catalog";
import { topicCode } from "../../src/core/hash";
import { cleanName, defaultPrefs, sanitizePrefs, type Prefs } from "../../src/core/prefs";
import { decodeShare, encodeShare, sharePath, slugify, splitShareSegment, tubeId } from "../../src/core/share";
import { hasData, index } from "./fixtures";

describe.skipIf(!hasData)("share links", () => {
  const idx = index();
  const codes = codeMap(idx);
  const ids = idx.topics.map((t) => t.id);

  it("topic codes are unique across the taxonomy", () => {
    expect(new Set(ids.map(topicCode)).size).toBe(ids.length);
  });

  it("round-trips many random Tubes", () => {
    let seed = 7;
    const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 0x100000000);
    for (let i = 0; i < 300; i++) {
      const p: Prefs = { ...defaultPrefs(), seed: Math.floor(rnd() * 0xffffffff), serendipity: Math.floor(rnd() * 4) as Prefs["serendipity"], depth: (["any", "intro", "deep"] as const)[Math.floor(rnd() * 3)]!, news: rnd() > 0.5 };
      for (let k = 0; k < 1 + Math.floor(rnd() * 16); k++) p.topics[ids[Math.floor(rnd() * ids.length)]!] = (1 + Math.floor(rnd() * 3)) as 1 | 2 | 3;
      if (rnd() > 0.5) p.formats.talk = 1;
      if (rnd() > 0.5) p.formats.comedy = -1;
      p.name = rnd() > 0.3 ? `Tube ${i} ✨ ünïcødé` : "";
      const parent = rnd() > 0.5 ? tubeId(`x${i}`) : null;
      const token = encodeShare({ prefs: p, parent });
      const back = decodeShare(token, codes);
      expect(back.ok).toBe(true);
      if (back.ok) {
        expect(back.config.prefs).toEqual(p);
        expect(back.config.parent).toBe(parent);
      }
    }
  });

  it("rejects tampering, unknown topics and junk", () => {
    const p = { ...defaultPrefs(), topics: { [ids[0]!]: 2 as const }, name: "Mine" };
    const token = encodeShare({ prefs: p, parent: null });
    const flipped = token.replace(/\.(\w{4})$/, (_, c: string) => `.${c[0] === "a" ? "b" : "a"}${c.slice(1)}`);
    expect(decodeShare(flipped, codes)).toEqual({ ok: false, error: "checksum" });
    expect(decodeShare("1.zzz2.-.a10.1.-.-.0000", codes).ok).toBe(false);
    expect(decodeShare("<script>alert(1)</script>", codes).ok).toBe(false);
    expect(decodeShare("x".repeat(5000), codes).ok).toBe(false);
    expect(decodeShare("", codes).ok).toBe(false);
    expect(splitShareSegment("%E0%A4%A")).toBeNull();
    expect(splitShareSegment("no-separator")).toBeNull();
  });

  it("treats names as untrusted text", () => {
    expect(cleanName("  <img src=x onerror=alert(1)>  ")).toBe("<img src=x onerror=alert(1)>"); // kept as text, React escapes it
    expect(cleanName("a‮evil\u0000​name")).toBe("aevilname");
    expect(cleanName("x".repeat(200)).length).toBe(48);
    expect(slugify("<b>Hi</b> there!!")).toBe("b-hi-b-there");
    expect(slugify("")).toBe("my-tube");
    const path = sharePath({ prefs: { ...defaultPrefs(), name: "Rust & Space--Stuff" }, parent: null });
    expect(path.startsWith("/r/rust-space-stuff--1.")).toBe(true);
    const seg = splitShareSegment(path.slice(3))!;
    expect(decodeShare(seg.token, codes).ok).toBe(true);
  });

  it("sanitizePrefs drops unknown topics and bad values", () => {
    const p = sanitizePrefs({ name: 5, topics: { nope: 2, [ids[1]!]: 9, [ids[2]!]: 3 }, formats: { talk: 2, comedy: -1, hack: 1 }, depth: "x", serendipity: 7, seed: -1 }, new Set(ids));
    expect(p.topics).toEqual({ [ids[2]!]: 3 });
    expect(p.formats).toEqual({ comedy: -1 });
    expect(p.depth).toBe("any");
    expect(p.serendipity).toBe(1);
    expect(p.seed).toBe(1);
  });
});
