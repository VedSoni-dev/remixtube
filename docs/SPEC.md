# TubeRemix: tech spec and execution checklist

Written 2026-11-03, before and during the build. Updated as items were verified.

## Goal

"Make your own HackerTube." Anyone can build a personal, community-curated YouTube feed from
the HackerTube dataset in a few clicks: no login, questionnaire, API key or command line. Share
it as a link, remix other people's, export a working version.

## Verified sources (2026-11-03)

| Claim | Source | Status |
|---|---|---|
| Karpathy announced HackerTube on 2026-11-01 | X post 2116957135661945283 (via the public embed endpoint) | ✅ "had Claude filter down 43M comments over 20 years of HN to 6,454 videos" |
| Blog post with the build story | karpathy.bearblog.dev/hacker-tube (dated 31 Oct 2026) | ✅ 40K comments, 6,454 videos, 2007–2026, 150 topics, data export for remixing |
| Data download | https://hackertube.org/download/hackertube-data.zip | ✅ 17,842,799 bytes, sha256 `c61bd220…9892e`, exported 2026-10-31 |
| Schema | DATA.md inside the zip | ✅ videos.jsonl, mentions.jsonl, taxonomy.json, related.jsonl, embeddings.npy, embedding_ids.json |
| License | DATA.md | ✅ ODC-By 1.0; credit HackerTube + open-index/hacker-news |
| "~40k video-recommending comments" | mentions.jsonl | ⚠️ 39,834 labeled comments *link* videos; 16,184 are recommendations (`rec`/`strong_rec`). Copy says so. |
| HackerTube source code is open | — | ❌ Only the data is published. Never claim otherwise. |
| Existing community remixes | web search 2026-11-03 | none found |

## Architecture

```
hackertube-data.zip ──(scripts/import.ts: sha256 pin, zod strict schemas)──▶ src/pipeline/build.ts
   │  dedupe ids + duplicate uploads · quality filter · topic normalisation · provenance
   │  embeddings → 8 nearest neighbours per video (vectors not shipped)
   ▼
public/data/  index.json (taxonomy, stats) · staples.json · t/<topic>.json · a/<area>.json
              d/<bucket>.json (provenance, 1024 buckets) · manifest.json (hashes, per-video diff)
   ▼
Browser: fetch only the shards for chosen topics (~20 KB gz each) → src/core/rank.ts (deterministic)
Server:  /r/<slug>--<token> renders the same ranking (SSR) + OG card (next/og, real thumbnails)
```

- Share token = the Tube's config (topic codes, weights, formats, flags, seed, name, parent id,
  checksum). No database. Strictly decoded and validated; names rendered as text only.
- State: localStorage (`tuberemix:v1`). Nothing personal is sent to a server.
- Embeds: YouTube IFrame API on youtube-nocookie.com, created on click. Error 100 → "no longer on
  YouTube", hidden from future feeds; 101/150 → "watch on YouTube".
- Source adapters: `src/pipeline/sources.ts` `SourceAdapter`; only `hackertube` is registered.
- AI (optional): browser → provider with the user's key; OpenRouter OAuth PKCE; Sign in with
  ChatGPT plan usage only on local installs (`TUBEREMIX_LOCAL=1`, 127.0.0.1). See AI_PROVIDERS.md.
- Analytics: whitelisted events, random per-tab id, no content ids; GPC/DNT respected.

## Execution checklist

- [x] Verify the X post, blog, site, data URL, DATA.md, schema, license
- [x] New standalone repo; no shared code or branding with any other project
- [x] Deterministic import with strict validation, sha256 pin, dedupe, filters, provenance, manifest diff
- [x] Ranking: interest, quality, crowd, rec quality, diversity, formats, depth, serendipity, likes/dislikes, watched, repetition
- [x] Landing with live re-ranking preview from real data
- [x] Feed: Home, For You, Explore, Topics, Watch Later, Liked, History, Customize; keyboard shortcuts
- [x] Player with official embeds, lazy; removed/blocked video handling; missing thumbnail fallback
- [x] Provenance: real HN comments with links, "See why people recommended this"
- [x] Share links rendered server-side; Remix this Tube; lineage via parent id
- [x] OG/X share cards with real thumbnails, name, interests, "Made with TubeRemix"
- [x] Export: config, playlist (MD/CSV/JSON), YouTube queue, starter ZIP with config, Claude Code prompt
- [x] /build-your-own guide with tested snippets and attribution/independence statement
- [x] Bring-your-own AI via sanctioned routes only; core works without AI (ChatGPT/OpenRouter sign-in not verified end to end: needs the owner's accounts)
- [x] Privacy-conscious analytics + funnel report script
- [x] Unit tests (vitest) and e2e acceptance (Playwright, desktop + mobile)
- [x] Independent reviewer passes (product + growth, first-time user + developer, design + accessibility, data + security); all blockers and majors fixed and retested
- [x] Public GitHub repo: https://github.com/VedSoni-dev/remixtube (owner OK, 2026-11-03)
- [x] v0.1.0 release: https://github.com/VedSoni-dev/remixtube/releases/tag/v0.1.0
- [ ] Public deploy (needs owner OK + Vercel account)
- [ ] ~~Publik listing~~: off for now (owner, 2026-11-03)
- [ ] Post on X (owner)

## Limitations (honest)

- Video length isn't in the dataset (YouTube's terms forbid redistributing it), so there's no
  length preference. Self-hosters can add it with their own YouTube Data API key; not built yet.
- Video availability is learned when a video fails to play or its thumbnail is missing.
- Stances and summaries were written by an LLM upstream; expect a few percent of noise.
- Only one source (HackerTube). The adapter interface exists; no other source is wired.
