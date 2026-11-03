import Link from "next/link";
import { SITE } from "@/lib/site";
import { Wordmark } from "./Wordmark";

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
      <Wordmark />
      <nav aria-label="Site" className="flex items-center gap-1 text-[14px] sm:gap-2">
        <Link href="/#how" className="hidden rounded-full px-3 py-2 text-ink-2 hover:text-ink sm:inline">How it works</Link>
        <Link href="/build-your-own" className="hidden rounded-full px-3 py-2 text-ink-2 hover:text-ink md:inline">Build your own</Link>
        <a href={SITE.repo} className="hidden rounded-full px-3 py-2 text-ink-2 hover:text-ink md:inline" rel="noopener noreferrer">Source</a>
        {cta && <Link href="/#build" className="rounded-full bg-ink px-4 py-2 font-semibold text-paper">Build my Tube</Link>}
      </nav>
    </header>
  );
}
