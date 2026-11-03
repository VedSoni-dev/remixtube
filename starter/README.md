# My own HackerTube (TubeRemix starter)

A tiny project that turns a TubeRemix config into your own static video page, built from the
public [HackerTube](https://hackertube.org) dataset: YouTube videos that Hacker News commenters
kept recommending, with the comments behind each one.

No accounts, no API keys, no `npm install`. You need [Node.js 20 or newer](https://nodejs.org).

## Run it

```bash
node build.mjs
node serve.mjs
```

Open the printed URL (http://127.0.0.1:4173/).

`build.mjs` does this:

1. Downloads `hackertube-data.zip` (about 18 MB) from hackertube.org once, into `.cache/`.
2. Checks its sha256 against the one in your config, so your feed matches what you exported. If the
   dataset was updated upstream, it stops and tells you; add `--accept-new-data` to use the new one.
3. Validates every record, drops videos nobody actually recommended, duplicates and pile-ons.
4. Ranks the videos with your config, using the same code as the TubeRemix site.
5. Writes `dist/index.html` (your page) and `dist/feed.json` (the ranked list).

Options: `--limit 120` for more videos, `--data path/to/hackertube-data.zip` to use a file you
already downloaded.

## Make it yours

- **Topics and taste:** edit `tuberemix.config.json`. `topics` maps topic ids to 1 (curious),
  2 (into it) or 3 (obsessed). Topic ids are listed in the dataset's `taxonomy.json`; TubeRemix's
  Topics page shows them too. `formats` takes `1` (more) or `-1` (less) for `talk`, `lecture`,
  `documentary`, `comedy`, `music`, and so on. `serendipity` is 0 to 3.
- **Look:** edit `template.mjs`. It's one HTML template string with inline CSS.
- **Ranking:** every weight is in the `WEIGHTS` object from `lib/tuberemix.mjs` (generated from the
  TubeRemix source, so don't edit that file). Override them in `build.mjs` before ranking, for example
  `WEIGHTS.crowd = 0.3`. The formula is explained in the TubeRemix README.

Rebuild after each change with `node build.mjs`.

## Deploy

`dist/` is a plain static folder. Drop it on any static host (GitHub Pages, Netlify, Cloudflare
Pages, Vercel, an S3 bucket). There's no server code and no secrets.

## Licenses and attribution

- Code in this starter: MIT (see `LICENSE`).
- Data: HackerTube by Andrej Karpathy, released under the
  [Open Data Commons Attribution License v1.0](https://opendatacommons.org/licenses/by/1-0/), derived
  from the [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news) archive.
  Keep the attribution footer. Hacker News comments remain the work of their authors; video titles
  and channel names belong to their creators.
- Videos play through YouTube's official embed (youtube-nocookie.com).

TubeRemix is an independent community project, not affiliated with or endorsed by Andrej
Karpathy, HackerTube, YouTube, Google, Hacker News or Y Combinator.
