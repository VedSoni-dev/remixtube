export const SITE = {
  name: "TubeRemix",
  tagline: "Make your own HackerTube.",
  description:
    "Karpathy built a better YouTube from community recommendations. Now make one for your interests.",
  repo: "https://github.com/VedSoni-dev/remixtube",
  hackertube: "https://hackertube.org",
  hackertubeData: "https://hackertube.org/download/hackertube-data.zip",
  karpathyPost: "https://karpathy.bearblog.dev/hacker-tube/",
  karpathyTweet: "https://x.com/karpathy/status/2116957135661945283",
  hnArchive: "https://huggingface.co/datasets/open-index/hacker-news",
  license: "https://opendatacommons.org/licenses/by/1-0/",
};

/** Public origin for canonical links and share cards: NEXT_PUBLIC_SITE_URL, else Vercel's production URL, else local. */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel && /^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel}`;
  return "http://127.0.0.1:3000";
}

export const DISCLAIMER =
  "TubeRemix is an independent community project. It is not affiliated with or endorsed by Andrej Karpathy, HackerTube, YouTube, Google, Hacker News or Y Combinator.";
