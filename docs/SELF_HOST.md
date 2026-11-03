# Self-hosting TubeRemix

Two ways, from simplest to fullest.

## A. The starter (static page, no dependencies)

Download `tuberemix-starter.zip` from any TubeRemix site (`/download/tuberemix-starter.zip`, or
Share & export → Starter project for one with your own config inside), then:

```bash
cd my-tube
node build.mjs     # downloads the data once (~18 MB), verifies sha256, ranks, writes dist/
node serve.mjs     # http://127.0.0.1:4173/
```

`dist/` is static: host it anywhere.

## B. The full app

Requirements: Node 20.11+ (tested on 24), npm, ~200 MB disk, internet for the first data download.

```bash
git clone https://github.com/VedSoni-dev/remixtube.git tuberemix
cd tuberemix
npm ci
npm run build      # = data:import (download + validate + write public/data) + starter:build + next build
npm start          # http://127.0.0.1:3000
```

For development: `npm run data:import && npm run starter:build && npm run dev`.

### Environment (all optional; see `.env.example`)

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your public origin, for canonical links and share-card URLs |
| `TUBEREMIX_ANALYTICS=file` | Append events to `./analytics-events.jsonl`; `npm run analytics:report` summarises them |
| `TUBEREMIX_LOCAL=1` | Enables Sign in with ChatGPT (only on 127.0.0.1) |
| `HACKERTUBE_DATA_URL` | Mirror URL for the dataset zip (the sha256 pin still applies) |

### Deploy

- **Vercel:** import the repo; build command `npm run build`, output is the Next.js default. Set
  `NEXT_PUBLIC_SITE_URL`. The build downloads the dataset (pinned by sha256).
- **Any Node host:** `npm run build && npm run start:public` (listens on `$PORT`, all interfaces).
  Put it behind HTTPS.
- **Updating the data:** when hackertube.org publishes a new export the import stops with a sha256
  mismatch. Review it, then `npm run data:import -- --update-lock`; the report in
  `data/import-report.json` shows added/removed/changed videos.

### Windows notes

- Use PowerShell or Git Bash. `npm run build` works in both.
- Set env vars in PowerShell with `$env:NAME="value"` before the command.

## Tests

```bash
npm test             # unit tests, including a full run of the starter against the cached data
npx playwright install chromium
npm run build && npm run test:e2e   # desktop + mobile acceptance tests on port 3917
```
