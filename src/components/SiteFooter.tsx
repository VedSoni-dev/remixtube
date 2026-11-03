import Link from "next/link";
import { DISCLAIMER, SITE } from "@/lib/site";
import { Wordmark } from "./Wordmark";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-hair">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-[46ch] text-[0.8438rem] leading-relaxed text-muted">{DISCLAIMER}</p>
        </div>
        <div className="text-[0.8438rem] leading-relaxed text-ink-2">
          <p className="meta mb-2">Data</p>
          <p>
            Videos, topics and HN comments come from{" "}
            <a className="underline underline-offset-2" href={SITE.hackertube}>HackerTube</a> by Andrej Karpathy, released under{" "}
            <a className="underline underline-offset-2" href={SITE.license}>ODC-By 1.0</a> and derived from the{" "}
            <a className="underline underline-offset-2" href={SITE.hnArchive}>open-index/hacker-news</a> archive. Hacker News data is provided by Y Combinator; comments remain the work of their authors. Video titles and channel names belong to their creators.
          </p>
        </div>
        <div className="text-[0.8438rem] text-ink-2">
          <p className="meta mb-2">TubeRemix</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:underline" href="/#build">Build my Tube</Link></li>
            <li><Link className="hover:underline" href="/build-your-own">Build your own HackerTube</Link></li>
            <li><a className="hover:underline" href={SITE.repo}>Source code (MIT)</a></li>
            <li><Link className="hover:underline" href="/privacy">Privacy</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
