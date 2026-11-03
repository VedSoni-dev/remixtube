"use client";
import { Bookmark, Compass, History, Home, LayoutGrid, Menu, SlidersHorizontal, Sparkles, ThumbsUp, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useModal } from "@/lib/useModal";
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

const MOBILE = ["/tube", "/tube/for-you", "/tube/explore", "/tube/later"];

export function TubeShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const s = useStore();
  const hydrated = useHydrated();
  const [help, setHelp] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const counts: Record<string, number> = {
    "/tube/later": Object.keys(s.later).length,
    "/tube/liked": Object.keys(s.liked).length,
    "/tube/history": s.history.length,
  };
  const isActive = (href: string) => (href === "/tube" ? path === "/tube" : path.startsWith(href));
  const name = s.prefs.name || "Your Tube";

  return (
    <PlayerProvider source="tube">
      <a href="#main" className="sr-only z-[80] rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-3">Skip to videos</a>
      <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hair px-4 py-5 lg:flex">
          <Wordmark />
          <nav aria-label="Your Tube" className="mt-8 flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className="group flex h-10 items-center gap-3 rounded-[4px] px-3 text-[0.9062rem] text-ink-2 hover:bg-paper-2 hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper"
              >
                <Icon size={17} aria-hidden />
                <span className="flex-1">{label}</span>
                {hydrated && counts[href] ? <span className="font-mono text-[0.6875rem] tabular-nums opacity-70">{counts[href]}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-3 text-[0.7812rem] text-muted">
            <button type="button" onClick={() => setHelp(true)} className="flex items-center gap-2 hover:text-ink">
              <kbd className="rounded border border-hair px-1.5 font-mono text-[0.6875rem]">?</kbd> Keyboard shortcuts
            </button>
            <p>Data: <a className="underline underline-offset-2" href="https://hackertube.org">HackerTube</a> (ODC-By). Not affiliated with HackerTube or YouTube.</p>
          </div>
        </aside>

        <div className="min-w-0 pb-24 lg:pb-10">
          <header className="sticky top-0 z-30 border-b border-hair bg-paper/92 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="lg:hidden"><Wordmark /></span>
                {hydrated && s.prefs.name && <span className="hidden truncate font-serif text-[1.375rem] italic leading-none lg:inline">{name}</span>}
              </div>
              <div className="flex items-center gap-2">
                <ShareButton />
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="mx-auto max-w-[1400px] px-4 pt-6 outline-none sm:px-6">{children}</main>
        </div>

        <nav aria-label="Your Tube" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hair bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {NAV.filter((n) => MOBILE.includes(n.href)).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className="flex flex-col items-center gap-0.5 py-2 text-[0.6562rem] text-muted aria-[current=page]:text-ink">
              <Icon size={19} aria-hidden />
              {label === "Watch Later" ? "Later" : label}
            </Link>
          ))}
          <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className="flex flex-col items-center gap-0.5 py-2 text-[0.6562rem] text-muted">
            <Menu size={19} aria-hidden />
            More
          </button>
        </nav>
        {more && createPortal(<MoreSheet onClose={() => setMore(false)} counts={hydrated ? counts : {}} onHelp={() => { setMore(false); setHelp(true); }} isActive={isActive} />, document.body)}
      </div>
      <Shortcuts open={help} onOpenChange={setHelp} />
    </PlayerProvider>
  );
}

function MoreSheet({ onClose, counts, onHelp, isActive }: { onClose: () => void; counts: Record<string, number>; onHelp: () => void; isActive: (h: string) => boolean }) {
  const ref = useModal<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/50 lg:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="All sections" className="fade-in w-full rounded-t-[10px] bg-paper p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="flex items-center justify-between">
          <p className="meta">Your Tube</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full hover:bg-paper-2"><X size={18} /></button>
        </div>
        <nav aria-label="All sections" className="mt-1 grid grid-cols-2 gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className="flex h-12 items-center gap-3 rounded-[4px] px-3 text-[0.9375rem] hover:bg-paper-2 aria-[current=page]:bg-ink aria-[current=page]:text-paper">
              <Icon size={18} aria-hidden />
              <span className="flex-1">{label}</span>
              {counts[href] ? <span className="font-mono text-[0.6875rem] opacity-70">{counts[href]}</span> : null}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={onHelp} className="mt-2 h-11 w-full rounded-[4px] text-left text-[0.875rem] text-muted hover:bg-paper-2 px-3">Keyboard shortcuts</button>
      </div>
    </div>
  );
}
