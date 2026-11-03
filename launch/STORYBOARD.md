# Demo storyboard

Recorded from the real running app with `scripts/qa/record-demo.ts` (Playwright, 1280×720), then
cut with ffmpeg. No mockups, no edited data. Part B is a separate, fresh browser context, so the
"share link works" shot is a genuinely independent session.

| Time | Shot | What it proves |
|---|---|---|
| 0–3 s | Landing: "Make your own HackerTube." | Context: this is the make-your-own layer for HackerTube |
| 3–10 s | Tap Functional programming, Distributed systems, Space exploration; the grid re-ranks after each tap | The signature moment, from real data |
| 10–12 s | Make my Tube → Home with Top picks | A feed in seconds, no login |
| 12–17 s | Open a video: official YouTube player, then scroll to "Recommended by the HN community" | Real provenance: verbatim comments with links |
| 17–19 s | Share & export: name it, copy the link | Shareable |
| 19–23 s | A fresh browser opens the link: same Tube, same feed | The share link works for someone else |

Outputs in `launch/media/`:

- `demo-full.mp4`: the whole storyboard (target 15–25 s)
- `demo-interests-to-feed.mp4`: the short cut (taps → re-rank → feed)
- `screenshot-launch.png`, `screenshot-mobile.png`, `social-preview.png`, `readme-hero.png`,
  `screenshot-feed.png`, `architecture.png`
