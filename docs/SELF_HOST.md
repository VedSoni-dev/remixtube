# Self-hosting TubeRemix

Two ways, from simplest to fullest.

## A. The starter (static page, no dependencies)

Download `tuberemix-starter.zip` from any TubeRemix site (`/download/tuberemix-starter.zip`, or
Share & export → Starter project for one with your own config inside), then:

```bash
cd my-tube
node build.mjs     # downloads the data once (~18 MB), verifies sha256, ranks, writes dist/
node serve.mjs     # http://127.0.0.1:4173/  (busy port? node serve.mjs --port 4180)
```

`dist/` is static: host it anywhere.

## B. The full app

Requirements: Node 20.11+ (tested on 24), npm, ~200 MB disk, internet for the first data download.

```bash
git clone https://github.com/VedSoni-dev/remixtube.git tuberemix
cd tuberemix
npm ci
npm run build      # = data:import (download + validate + write public/data) + starter:build + next build
npm start          # http://127.0.0.1:3000  (another port: npx next start -H 127.0.0.1 -p 3001)
```

For development: `npm run data:import && npm run starter:build && npm run dev`.

### Environment (all optional; see `.env.example`)

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your public origin, for canonical links and share-card URLs |
| `TUBEREMIX_ANALYTICS=file` | Append events to `./analytics-events.jsonl`; `npm run analytics:report` summarises them |
| `TUBEREMIX_LOCAL=1` | Enables Sign in with ChatGPT. Only honoured when the server is bound to 127.0.0.1 (`npm start` does that) and requests come straight from this machine |
| `HACKERTUBE_DATA_URL` | Mirror URL for the dataset zip (the sha256 pin still applies) |

### Deploy

- **Vercel:** import the repo; build command `npm run build`, output is the Next.js default. Set
  `NEXT_PUBLIC_SITE_URL`. The build downloads the dataset (pinned by sha256).
- **Any Node host:** `npm run build && npm run start:public` (Next listens on `PORT`, default 3000,
  on all interfaces). Put it behind HTTPS. Don't set `TUBEREMIX_LOCAL` on a public server.
- **Updating the data:** when hackertube.org publishes a new export the import stops with a sha256
  mismatch. Review it, then `npm run data:import -- --update-lock` (always re-downloads); the run
  prints added/removed/changed videos and `data/import-report.json` records the new counts.
- **Keeping builds working if upstream changes:** host a copy of the pinned zip (ODC-By allows
  it, with attribution), e.g. as a GitHub release asset, and list it under `mirrors` in
  `data/source.lock.json`. Mirrors are tried first and must match the pinned sha256.

### Windows notes

- Use PowerShell, Command Prompt or Git Bash; every npm script works in all three.
- Set env vars in PowerShell with `$env:NAME="value"` before the command, e.g.
  `$env:TUBEREMIX_LOCAL=1; npm start`.

## Tests

```bash
npm test             # unit tests, including a full run of the starter against the cached data
npx playwright install chromium
npm run build && npm run test:e2e   # desktop + mobile acceptance tests on port 3917
```
