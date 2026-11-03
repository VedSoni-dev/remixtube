"use client";
import { Bookmark, Compass, History, Home, LayoutGrid, SlidersHorizontal, Sparkles, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { PlayerProvider } from "../player/PlayerProvider";
import { Wordmark } from "../Wordmark";
import { ShareButton } from "./ShareDialog";
import { Shortcuts } from "./Shortcuts";

const NAV = [
  { href: "/tube", label: "Home", icon: Home },
  { href: "/tube/for-you", label: "For You", icon: Sparkles },
  { href: "/tube/explore", label: "Explore", icon: Compass },
  { href: "/tube/topics", label: "Topics", icon: LayoutGrid },
  { href: "/tube/later", label: "Watch Later", icon: Bookmark },
  { href: "/tube/liked", label: "Liked", icon: ThumbsUp },
  { href: "/tube/history", label: "History", icon: History },
  { href: "/tube/customize", label: "Customize", icon: SlidersHorizontal },
] as const;

const MOBILE = ["/tube", "/tube/for-you", "/tube/explore", "/tube/later", "/tube/customize"];

export function TubeShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const s = useStore();
  const hydrated = useHydrated();
  const [help, setHelp] = useState(false);
  const counts: Record<string, number> = {
    "/tube/later": Object.keys(s.later).length,
    "/tube/liked": Object.keys(s.liked).length,
    "/tube/history": s.history.length,
  };
  const isActive = (href: string) => (href === "/tube" ? path === "/tube" : path.startsWith(href));
  const name = s.prefs.name || "Your Tube";

  return (
    <PlayerProvider source="tube">
      <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hair px-4 py-5 lg:flex">
          <Wordmark />
          <nav aria-label="Your Tube" className="mt-8 flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className="group flex h-10 items-center gap-3 rounded-[4px] px-3 text-[14.5px] text-ink-2 hover:bg-paper-2 hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper"
              >
                <Icon size={17} aria-hidden />
                <span className="flex-1">{label}</span>
                {hydrated && counts[href] ? <span className="font-mono text-[11px] tabular-nums opacity-70">{counts[href]}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-3 text-[12.5px] text-muted">
            <button type="button" onClick={() => setHelp(true)} className="flex items-center gap-2 hover:text-ink">
              <kbd className="rounded border border-hair px-1.5 font-mono text-[11px]">?</kbd> Keyboard shortcuts
            </button>
            <p>Data: <a className="underline underline-offset-2" href="https://hackertube.org">HackerTube</a> (ODC-By). Not affiliated with HackerTube or YouTube.</p>
          </div>
        </aside>

        <div className="min-w-0 pb-24 lg:pb-10">
          <header className="sticky top-0 z-30 border-b border-hair bg-paper/92 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="lg:hidden"><Wordmark /></span>
                <span className="hidden truncate font-serif text-[22px] italic leading-none lg:inline">{hydrated ? name : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShareButton />
              </div>
            </div>
          </header>
          <main id="main" className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">{children}</main>
        </div>

        <nav aria-label="Your Tube" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hair bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {NAV.filter((n) => MOBILE.includes(n.href)).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] text-muted aria-[current=page]:text-ink">
              <Icon size={19} aria-hidden />
              {label === "Watch Later" ? "Later" : label}
            </Link>
          ))}
        </nav>
      </div>
      <Shortcuts open={help} onOpenChange={setHelp} />
    </PlayerProvider>
  );
}
