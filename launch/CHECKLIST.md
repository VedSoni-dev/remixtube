# Launch checklist: what's left, in order

Everything below is outward-facing, so none of it has been done. Each step says exactly what to run
or click.

## 1. Public repo ✅ and v0.1.0 release ✅ (both 2026-11-03)

`VedSoni-dev/remixtube` is public; https://github.com/VedSoni-dev/remixtube/releases/tag/v0.1.0 is
the latest release (tag at `13cc863`).

Optional, not done: attach the pinned dataset as a mirror (ODC-By allows redistribution
with attribution), then add its URL to `mirrors` in `data/source.lock.json`:

```bash
gh release upload v0.1.0 .cache/hackertube-data.zip --repo VedSoni-dev/remixtube
```

## 2. Deploy

Vercel (no secrets needed):

```bash
npx vercel link
npx vercel deploy --prod
```

Build command `npm run build` (default). Set `NEXT_PUBLIC_SITE_URL=https://<your-domain>` if you use
a custom domain; otherwise the Vercel production URL is used for share cards automatically.

Then check on the live URL: landing → three picks → Make my Tube → play a video → Share & export →
open the link in a private window → paste the link into https://cards-dev.twitter.com/validator or
an X draft to see the card.

## 3. Re-record the demo on the live URL (optional, the local recording is real but shows 127.0.0.1)

```bash
npx tsx scripts/qa/record-demo.ts https://<your-domain> launch/media
cd launch/media
ffmpeg -y -ss 0.3 -i .rec/a.webm -ss 0.5 -i .rec/b.webm -filter_complex "[0:v]setpts=(PTS-STARTPTS)/1.2,fps=30,scale=1280:720:flags=lanczos,format=yuv420p[a];[1:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720:flags=lanczos,format=yuv420p[b];[a][b]concat=n=2:v=1:a=0[v]" -map "[v]" -c:v libx264 -preset slow -crf 20 -movflags +faststart demo-full.mp4
```

## 4. publik (see `launch/PUBLIK_PLAN.md`)

After step 1, tell Claude "go ahead with publik". It will derive the listing, show you the
checklist, and ask you to approve one device code in your browser at publikhq.com before anything
is published.

## 5. Post on X

Copy from `launch/POSTS.md`:

1. Main post: #5 with `launch/media/demo-interests-to-feed.mp4`, `[LINK]` → your live URL.
2. Thread: posts 2–5 under it.
3. Reply under https://x.com/karpathy/status/2116957135661945283 with the reply text and the same clip.

## Not verified yet (needs you)

- Sign in with ChatGPT end to end: run `TUBEREMIX_LOCAL=1 npm start` locally, Customize → AI →
  Continue with ChatGPT, sign in in your browser. Everything up to OpenAI's sign-in page was tested.
- Sign in with OpenRouter end to end (needs an OpenRouter account).
- Your own OpenAI/Anthropic keys in Describe it (needs a key; nothing was called).
