# publik setup plan (setup.md step 2 checklist, waiting for a yes)

Source of the procedure: `https://publikhq.com/skills/setup.md`, `publish.md`, `api.md`, fetched
raw with curl on 2026-11-03 and read in full before anything was run. **Nothing has been run against
publik yet.** No account, token, listing or call exists.

## Step 1 findings (read the repo)

- **What it is:** TubeRemix, an open-source Next.js web app ("Make your own HackerTube").
- **How a release is built:** `npm ci && npm run build`, run with `npm start` (a local web app on
  127.0.0.1:3000) or deployed as a server. A release produces a Node server build, plus the static
  starter `public/download/tuberemix-starter.zip`. There is no dmg/exe/AppImage.
- **Outside services it calls:**
  - YouTube embeds and thumbnails (not covered by publik)
  - hackertube.org dataset download at build time (not covered)
  - Optional AI chat for "Describe it" (Customize): OpenAI / Anthropic / OpenRouter with the user's
    key, or ChatGPT plan usage on local installs. **publik covers this: `ai.chat`.**
  - No embeddings, speech, image or search calls.

## Blockers before publish.md step 1 can even start

1. ✅ `VedSoni-dev/remixtube` is public and `v0.1.0` is its latest release (2026-11-03). The release
   has no attached binaries (it's a web app), so publik will list it as install-from-source.
2. You need `https://publikhq.com/submit` open, signed in with GitHub, to approve the device-flow
   code in the browser (one approval, lasts an hour).

## The plan (repo public, release out)

1. `publish.md` step 2: `POST https://publikhq.com/api/submit/derive {"repo":"VedSoni-dev/remixtube"}`
   (no sign-in) and show you the derived manifest: name (≤18 chars, likely "TubeRemix"), summary
   (≤80, no URLs, e.g. "Make your own HackerTube: a personal feed of videos HN recommends"),
   category, alternativeTo (YouTube?), license MIT, platforms (web), artifacts, run commands, with
   every inferred/default field marked.
2. Set `publikApi.enabled: true`, `products: ["ai.chat"]` (publik would give users keyless AI for
   Describe it; their own keys keep working as the fallback).
3. `publish.md` step 4: device flow → you open the URL, check the code, click Approve.
4. `publish.md` step 5: publish → **public listing** (or `held_for_review`).
5. `api.md` steps 2–5 for the returned slug: mint the app token (`publik-app-token.txt`; committed,
   public by design, it only mints capped per-install keys), add the TS module from
   `https://publikhq.com/sdk/publik.ts.md` as a provider option after the user's own key, first-run
   disclosure card, 402 message, AGENTS.md block, one real `publik-fast` test call.
6. setup.md step 6: build the release (`npm run build`), run `PUBLIK_SELF_TEST=1 npm start`, expect
   `publik self-test: ok <slug> <version>`.

## What I need from you

- **Yes/no:** publish a public publik listing with publik API (`ai.chat`) enabled.
- One browser approval on publik when the device code appears.

Rules I'll keep: never read `.env*`, never print `pat_`/`pk_`/`pbt_` values, never commit a `pk_`
key, remove the temporary work dir when done.
