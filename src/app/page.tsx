import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadDetail, rankContext, starterChips } from "@/core/catalog";
import { defaultPrefs } from "@/core/prefs";
import { emptySignals, rankFeed, W } from "@/core/rank";
import type { Shard } from "@/core/types";
import { LiveBuilder } from "@/components/landing/LiveBuilder";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { readIndex, readJson } from "@/lib/server-data";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

const n = (x: number) => x.toLocaleString("en-US");

export default async function Landing() {
  const index = await readIndex();
  const s = index.stats;
  // A real example of provenance: "Simple Made Easy" if present, else the best-scored staple.
  // A real example of provenance (the DATA.md example video).
  const example = (await loadDetail(readJson, "fNk_zzaMoSs")) ?? null;
  const recs = example?.mentions.filter((m) => m.st === "strong_rec" || m.st === "rec").slice(0, 2) ?? [];
  const staples = await readJson<Shard>("staples.json");
  const initial = {
    items: rankFeed(staples.videos, { ...defaultPrefs(), serendipity: 0 }, emptySignals(), rankContext(index), { limit: 12 }),
    chips: starterChips(index),
    chipCount: s.chips,
  };

  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-[1280px] px-4 pb-10 pt-8 sm:px-8 sm:pt-14">
          <p className="meta">An independent remix of the open HackerTube data · {n(s.videos)} videos · {n(s.recommenders)} HN recommenders · {s.first_year}–{s.last_year}</p>
          <h1 className="mt-4 max-w-[14ch] font-serif text-[3.5rem] leading-[0.94] tracking-[-0.025em] sm:text-[5.5rem] lg:text-[7rem]">
            Make your own <span className="italic"><span className="marked">HackerTube.</span></span>
          </h1>
          <p className="mt-6 max-w-[52ch] text-[1.125rem] leading-relaxed text-ink-2 sm:text-[1.25rem]">
            Karpathy built a better YouTube from community recommendations. Now make one for your interests.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#build" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[0.9375rem] font-semibold text-paper">
              Build my Tube <ArrowRight size={17} />
            </a>
            <a href="#how" className="inline-flex h-12 items-center rounded-full border border-ink/25 px-6 text-[0.9375rem] font-semibold hover:border-ink">
              See how it works
            </a>
            <span className="text-[0.8438rem] text-muted">No login, no questionnaire, no API key.</span>
          </div>
        </section>

        <section id="build" aria-label="Build your Tube" className="scroll-mt-4 border-y border-hair bg-paper-2/45">
          <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8 sm:py-14">
            <LiveBuilder initial={initial} />
          </div>
        </section>

        <section id="how" className="mx-auto max-w-[1280px] scroll-mt-4 px-4 pt-20 sm:px-8">
          <p className="meta">How it works</p>
          <h2 className="mt-2 max-w-[22ch] font-serif text-[2.75rem] leading-[1] tracking-[-0.015em] sm:text-[3.5rem]">
            A feed built from what people actually told each other to watch.
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            <li className="border-t border-ink pt-4">
              <p className="font-mono text-[0.75rem]">01</p>
              <h3 className="mt-2 text-[1.1875rem] font-semibold">Hacker News did the curating.</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
                Karpathy had Claude filter 43M HN comments from 20 years down to the {n(s.source_videos)} YouTube videos HN kept linking to, and label what each comment was doing. He{" "}
                <a className="underline underline-offset-2" href={SITE.karpathyPost}>published the data</a> for anyone to build on.
              </p>
            </li>
            <li className="border-t border-ink pt-4">
              <p className="font-mono text-[0.75rem]">02</p>
              <h3 className="mt-2 text-[1.1875rem] font-semibold">You pick what you’re into.</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
                {index.stats.chips} topics big enough for a feed ({index.stats.topics} in all), from compilers to ships at sea. TubeRemix keeps the {n(s.videos)} videos that at least one HN commenter genuinely recommended, and drops jokes, pile-ons and duplicate uploads.
              </p>
            </li>
            <li className="border-t border-ink pt-4">
              <p className="font-mono text-[0.75rem]">03</p>
              <h3 className="mt-2 text-[1.1875rem] font-semibold">Your browser ranks it.</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
                A small, deterministic scorer runs on your device: the same picks give the same starting feed. Your likes and history then tune it, and never leave this browser.
              </p>
            </li>
          </ol>
        </section>

        <section id="ranking" className="mx-auto grid max-w-[1280px] scroll-mt-4 gap-10 px-4 pt-20 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="meta">Ranking, in plain words</p>
            <h2 className="mt-2 font-serif text-[2.5rem] leading-[1.02]">No black box.</h2>
            <dl className="mt-6 divide-y divide-hair border-y border-hair text-[0.9375rem]">
              {[
                ["Interest match", `Half the score. A video’s first topic counts fully, its second ${W.topicPosition[1]}×, its third ${W.topicPosition[2]}×.`],
                ["Lasting recommendation", "HackerTube’s score: how many separate months HN recommended it, with extra weight for enthusiastic ones."],
                ["Distinct recommenders", "How many different people recommended it, not how many times it was linked."],
                ["Variety", "The same topic or channel twice in a row costs points, so one obsession doesn’t take over."],
                ["Your feedback", "Likes lift their topics, “Not for me” hides a video and lowers its topics, watched videos step aside."],
                ["A little serendipity", "Optional: every few slots, one of HN’s favourites from outside your picks."],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
                  <dt className="font-semibold">{k}</dt>
                  <dd className="text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[0.8125rem] text-muted">The full formula and every weight are in the <a className="underline underline-offset-2" href={`${SITE.repo}#how-ranking-works`}>README</a>. It runs without any AI.</p>
          </div>

          {example && (
            <figure className="self-start rounded-[6px] border border-hair bg-card p-6 shadow-[var(--shadow)]">
              <p className="meta">Every video shows its receipts</p>
              <p className="mt-3 font-serif text-[1.875rem] leading-[1.05]">{example.v.t}</p>
              <p className="meta mt-1">{example.v.c} · recommended by {example.v.r} people on HN</p>
              <ul className="mt-5 space-y-4">
                {recs.map((m) => (
                  <li key={m.id} className="border-l-2 border-ink pl-4">
                    <p className="text-[0.9375rem] leading-relaxed text-ink-2">“{m.x.replace(/\[VIDEO\]/g, "(this video)").replace(/\[LINK\]/g, "(link)")}”</p>
                    <a className="mt-1 inline-block text-[0.7812rem] text-muted underline underline-offset-2" href={`https://news.ycombinator.com/item?id=${m.id}`} rel="noopener noreferrer">
                      {m.a} on Hacker News, {m.mo}
                    </a>
                  </li>
                ))}
              </ul>
            </figure>
          )}
        </section>

        <section className="mx-auto max-w-[1280px] px-4 pt-20 sm:px-8">
          <div className="grid gap-6 border-t border-ink pt-8 md:grid-cols-3">
            <div>
              <h3 className="text-[1.1875rem] font-semibold">Share it.</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">Every Tube gets a link that opens the same feed for anyone, in any browser. The link is the recipe, so nothing is stored on a server.</p>
            </div>
            <div>
              <h3 className="text-[1.1875rem] font-semibold">Remix a remix.</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">Open someone’s Tube, press Remix this Tube, and change anything. Their version stays as it was.</p>
            </div>
            <div>
              <h3 className="text-[1.1875rem] font-semibold">Take it with you.</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
                Export your config and playlist, or download a starter project that rebuilds your feed from the source data.{" "}
                <Link className="underline underline-offset-2" href="/build-your-own">Build your own</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
