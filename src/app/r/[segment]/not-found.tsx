import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function SharedNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-4 py-24 text-center sm:px-8">
        <p className="meta">Broken link</p>
        <h1 className="mt-2 font-serif text-[48px] leading-none sm:text-[64px]">This Tube link doesn’t work.</h1>
        <p className="mx-auto mt-4 max-w-[48ch] text-[16px] text-ink-2">
          It may have been cut off when it was copied, or changed by hand. Ask whoever sent it for the full link, or make your own in a few clicks.
        </p>
        <Link href="/#build" className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper">Build my Tube</Link>
      </main>
      <SiteFooter />
    </>
  );
}
