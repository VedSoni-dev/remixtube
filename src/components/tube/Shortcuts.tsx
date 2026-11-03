"use client";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useModal } from "@/lib/useModal";

const KEYS: [string, string][] = [
  ["j / k", "Move to the next / previous video (in the player too)"],
  ["Enter", "Play the focused video"],
  ["l", "Like"],
  ["w", "Watch later"],
  ["n", "Not for me (in the player)"],
  ["Esc", "Close the player"],
  ["g h · g f · g e · g t", "Go to Home, For You, Explore, Topics"],
  ["g l · g c", "Go to Watch Later, Customize"],
  ["?", "Show this list"],
];

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
}

/** Global shortcuts for feed pages. Card-level keys act on the focused card. */
export function Shortcuts({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const g = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-shortcuts])')) return; // the player handles its own keys
      if (e.key === "?") { e.preventDefault(); onOpenChange(!open); return; }
      if (open) return; // the dialog handles Escape; nothing else acts behind it
      const now = Date.now();
      if (e.key === "g") { g.current = now; return; }
      if (now - g.current < 900) {
        const to: Record<string, string> = { h: "/tube", f: "/tube/for-you", e: "/tube/explore", t: "/tube/topics", l: "/tube/later", c: "/tube/customize" };
        if (to[e.key]) { e.preventDefault(); router.push(to[e.key]!); g.current = 0; return; }
      }
      if (e.key === "j" || e.key === "k") {
        const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-card] > button:first-child"));
        if (!cards.length) return;
        const i = cards.findIndex((c) => c === document.activeElement);
        const next = cards[e.key === "j" ? Math.min(cards.length - 1, i + 1) : Math.max(0, i - 1)] ?? cards[0]!;
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return;
      }
      if (e.key === "l" || e.key === "w") {
        const card = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-card]");
        const btn = card?.querySelector<HTMLButtonElement>(e.key === "l" ? 'button[aria-label="Like"], button[aria-label="Unlike"]' : 'button[aria-label*="Watch later"]');
        if (btn) { e.preventDefault(); btn.click(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, router]);

  if (!open) return null;
  return createPortal(<ShortcutsDialog onClose={() => onOpenChange(false)} />, document.body);
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const ref = useModal<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" data-shortcuts aria-label="Keyboard shortcuts" className="fade-in w-full max-w-md rounded-[6px] bg-paper p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[1.75rem]">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-paper-2" aria-label="Close"><X size={18} /></button>
        </div>
        <dl className="mt-4 divide-y divide-hair">
          {KEYS.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-[0.875rem]">
              <dt><kbd className="rounded border border-line bg-card px-1.5 py-0.5 font-mono text-[0.75rem]">{k}</kbd></dt>
              <dd className="text-right text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
