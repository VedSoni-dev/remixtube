# Demo storyboard

Recorded from the real running app (production build, 2026-11-03) with
`scripts/qa/record-demo.ts` (Playwright, 1280×720, a visible cursor dot added because recordings
don't show the OS pointer), then encoded with ffmpeg. No mockups and no edited data. Part B is a
separate, fresh browser context, so the "share link works" shot is a genuinely independent session.

| Time in `demo-full.mp4` | Shot | What it proves |
|---|---|---|
| 0–1.5 s | Landing: "Make your own HackerTube." | Context: the make-your-own layer for HackerTube |
| 1.5–8 s | Tap Machine learning, Functional programming, Fundamental physics; the grid re-ranks after each tap | The signature moment, from real data (437 matching videos) |
| 8–9 s | Make my Tube → Home with Top picks | A feed in seconds, no login |
| 9–15 s | Open a video: the official YouTube player, then scroll to "Recommended by the HN community" | Real provenance: comment excerpts with links |
| 15–19 s | Share & export: name it "Lambdas & Physics", copy the link | Shareable |
| 19–24 s | A fresh browser opens the link: same Tube, same feed | The share link works for someone else |

Edits, disclosed: part A plays at **1.2×** and the blank first frames of each part are trimmed,
to fit 24 seconds. The short cut is real time.

Outputs in `launch/media/`:

| File | What |
|---|---|
| `demo-full.mp4` | the storyboard above, 23.8 s, H.264 1280×720 |
| `demo-interests-to-feed.mp4` | 8.2 s, real time: three taps → re-rank → Make my Tube → feed |
| `screenshot-launch.png` | landing with three picks, 2880×1800 |
| `screenshot-feed.png` | Home after Make my Tube, 2880×1800 |
| `screenshot-mobile.png` | a shared Tube on a phone, 1170×2532 |
| `social-preview.png` | the generated share card for "Lambdas & Physics", 1200×630 |
| `readme-hero.png` | landing hero, 2880×1800 |
| `architecture.png` / `.svg` | data-flow diagram |

The URLs visible in the recordings are `127.0.0.1` because nothing is deployed yet. Re-record after
deploying with `npx tsx scripts/qa/record-demo.ts https://<your-domain> launch/media` and the
ffmpeg commands in `launch/CHECKLIST.md`.
