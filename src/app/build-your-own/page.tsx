import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "@/components/CopyBlock";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { claudeCodePrompt, type TubeConfig } from "@/core/exporters";
import { readIndex } from "@/lib/server-data";
import { DISCLAIMER, SITE, siteUrl } from "@/lib/site";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Build your own HackerTube",
  description: "Karpathy built HackerTube. Here’s how to build yours: the data, the ranking, a starter project and a Claude Code prompt.",
};

const n = (x: number) => x.toLocaleString("en-US");

function Step({ no, title, children, id }: { no: string; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-4 border-t border-hair py-10 md:grid-cols-[180px_1fr] md:gap-10">
      <div>
        <p className="font-mono text-[12px]">{no}</p>
        <h2 className="mt-1 font-serif text-[30px] leading-[1.02]">{title}</h2>
      </div>
      <div className="min-w-0 max-w-[72ch] space-y-3 text-[15.5px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default async function BuildYourOwn() {
  const index = await readIndex();
  const s = index.stats;
  const [inspect, download, starterBuild] = await Promise.all([
    readFile(join(process.cwd(), "src/snippets/inspect.mjs"), "utf8"),
    readFile(join(process.cwd(), "src/snippets/download.sh"), "utf8"),
    readFile(join(process.cwd(), "starter/tuberemix.config.json"), "utf8"),
  ]);
  const example = JSON.parse(starterBuild) as TubeConfig;
  const prompt = claudeCodePrompt(example, siteUrl());

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 sm:px-8">
        <header className="pb-6 pt-10">
          <p className="meta">Build your own</p>
          <h1 className="mt-3 font-serif text-[48px] leading-[0.96] tracking-[-0.02em] sm:text-[76px]">
            Karpathy built HackerTube. Here’s how to build <span className="marked italic">yours</span>.
          </h1>
          <p className="mt-5 max-w-[60ch] text-[18px] leading-relaxed text-ink-2">
            Everything below uses the public data he released. The commands were run while writing this page; the starter project is the same code that ranks TubeRemix.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2 text-[14px]">
            {[["#what", "What he built"], ["#data", "The data"], ["#download", "Download"], ["#rank", "Filter & rank"], ["#run", "Run it"], ["#deploy", "Deploy"], ["#claude", "Claude Code prompt"]].map(([h, l]) => (
              <li key={h}><a className="inline-block rounded-full border border-hair px-3 py-1 hover:border-ink" href={h}>{l}</a></li>
            ))}
          </ul>
        </header>

        <Step no="01" title="What he built" id="what">
          <p>
            On 31 October 2026 Andrej Karpathy <a className="underline" href={SITE.karpathyPost}>wrote</a> that he was tired of YouTube’s recommendations, so he had Claude build a YouTube of only the videos Hacker News kept recommending. In his <a className="underline" href={SITE.karpathyTweet}>post on X</a> he describes filtering 43M HN comments from 20 years down to {n(s.source_videos)} videos, in about two hours with Opus 5.5.
          </p>
          <p>
            The result is <a className="underline" href={SITE.hackertube}>hackertube.org</a>: frame thumbnails instead of clickbait, a For You feed kept in your browser, keyboard shortcuts, and the HN comments behind every video. He also published the site’s data for anyone to build their own version. The site’s source code isn’t published; the data is.
          </p>
        </Step>

        <Step no="02" title="Where the data comes from" id="data">
          <p>From the export’s DATA.md, in short:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Every HN comment from 2007 to 2026 (the open-index/hacker-news archive) was scanned for YouTube links with at least 100 characters of real text.</li>
            <li>A video stays if at least 3 different people mentioned it in at least 3 different months.</li>
            <li>Claude Sonnet labeled each comment’s stance (strong rec, rec, reference, joke, critical) and wrote a card per video; videos were sorted into 150 topics in 16 areas.</li>
          </ol>
          <p>
            The export has {n(s.source_videos)} videos and {n(s.source_mentions)} labeled comments, of which {n(s.source_recommendations)} are actual recommendations. It ships embeddings for “similar videos” and a co-recommendation graph. YouTube’s own metadata (durations, view counts) is not included, because YouTube’s terms don’t allow redistributing it.
          </p>
          <p>
            License: <a className="underline" href={SITE.license}>ODC-By 1.0</a>. Credit HackerTube and the open-index/hacker-news dataset; comments remain their authors’ work.
          </p>
        </Step>

        <Step no="03" title="Download and inspect" id="download">
          <p>About 18 MB. The sha256 of the 31 October export is <code className="break-all font-mono text-[12.5px]">{index.source.zip_sha256}</code>.</p>
          <CopyBlock code={download.trim()} lang="shell" />
          <p>Then look inside with a few lines of Node (no packages needed):</p>
          <CopyBlock code={inspect.trim()} label="inspect.mjs" />
        </Step>

        <Step no="04" title="Choose your interests">
          <p>
            The fastest way is the <Link className="underline" href="/#build">builder on the home page</Link>: tap a few of the {s.chips} topics and press Make my Tube. Then Share &amp; export gives you a config file. Or write one by hand; topic ids come from <code className="font-mono text-[13px]">taxonomy.json</code>:
          </p>
          <CopyBlock code={starterBuild.trim()} label="tuberemix.config.json" />
        </Step>

        <Step no="05" title="Filter and rank" id="rank">
          <p>TubeRemix keeps {n(s.videos)} of the {n(s.source_videos)} videos:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>at least one comment genuinely recommends it ({n(s.source_videos - s.videos)} videos dropped in total, mostly ones that were only cited);</li>
            <li>recommendations outnumber jokes and criticism;</li>
            <li>duplicate uploads of the same talk collapse into the better-scored one;</li>
            <li>“news of the day” videos are hidden unless you ask for them.</li>
          </ul>
          <p>
            Ranking is deterministic and runs without AI: topic match (half the score), HackerTube’s lasting-recommendation score, how many distinct people recommended it, a variety penalty for repeating a topic or channel, your likes and “not for me”, and optional serendipity. The <a className="underline" href={`${SITE.repo}#ranking`}>README</a> lists every weight.
          </p>
        </Step>

        <Step no="06" title="Run it locally" id="run">
          <p><b className="text-ink">Option A: the starter (2 minutes).</b> A zero-dependency Node project. It downloads the data, checks the sha256, ranks with your config and writes a static page.</p>
          <p>
            <a className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-semibold text-paper" href="/download/tuberemix-starter.zip">Download the starter (.zip)</a>
          </p>
          <CopyBlock code={"cd my-tube\nnode build.mjs\nnode serve.mjs"} lang="shell" />
          <p>
            To use your own Tube instead of the example, export your config from Share &amp; export (or download the starter from there: it comes with your config inside).
          </p>
          <p><b className="text-ink">Option B: all of TubeRemix.</b> The full app (Next.js) runs on your machine too, and that’s where Sign in with ChatGPT works:</p>
          <CopyBlock code={`git clone ${SITE.repo}.git tuberemix\ncd tuberemix\nnpm ci\nnpm run data:import\nnpm run starter:build\nnpm run dev`} lang="shell" />
        </Step>

        <Step no="07" title="Customize">
          <ul className="list-disc space-y-1 pl-5">
            <li><b className="text-ink">Taste:</b> topics (1 to 3), formats (more or less talks, lectures, documentaries…), depth, serendipity, news.</li>
            <li><b className="text-ink">Look:</b> the starter’s page is one template in <code className="font-mono text-[13px]">template.mjs</code>.</li>
            <li><b className="text-ink">Ranking:</b> override any weight, e.g. <code className="font-mono text-[13px]">WEIGHTS.crowd = 0.3</code> in <code className="font-mono text-[13px]">build.mjs</code>.</li>
            <li><b className="text-ink">Similar videos:</b> the export’s embeddings (bge-small, 384-d) give you “more like this” with a dot product; TubeRemix precomputes the nearest 8 per video.</li>
          </ul>
        </Step>

        <Step no="08" title="Deploy and share" id="deploy">
          <p>The starter’s <code className="font-mono text-[13px]">dist/</code> is a static folder: GitHub Pages, Netlify, Cloudflare Pages or any web server. There are no secrets to protect.</p>
          <p>The full TubeRemix app deploys to Vercel or any Node host (<code className="font-mono text-[13px]">npm run build &amp;&amp; npm start</code>). Share links need no database: the link is the config.</p>
        </Step>

        <Step no="09" title="Or let Claude Code do it" id="claude">
          <p>Paste this into Claude Code (or another coding agent). It uses the example config; the Share &amp; export dialog gives you the same prompt with your own Tube in it.</p>
          <CopyBlock code={prompt} label="Claude Code prompt" trackKind="prompt" />
        </Step>

        <Step no="10" title="Credit where it’s due">
          <p>
            Data: <a className="underline" href={SITE.hackertube}>HackerTube</a> by Andrej Karpathy (ODC-By 1.0), from the <a className="underline" href={SITE.hnArchive}>open-index/hacker-news</a> archive. Hacker News data is provided by Y Combinator; comments remain the work of their authors. Videos play through YouTube’s official embed.
          </p>
          <p className="text-ink">{DISCLAIMER}</p>
        </Step>
      </main>
      <SiteFooter />
    </>
  );
}
