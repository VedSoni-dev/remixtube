"use client";
// Dialog behaviour: focus moves in, Tab stays inside, Escape closes, the page behind can't
// scroll or be reached, and focus returns to whatever opened the dialog.
import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

export function useModal<T extends HTMLElement>(onClose: () => void, opts: { initialFocus?: () => HTMLElement | null } = {}) {
  const ref = useRef<T | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const initial = useRef(opts.initialFocus);
  initial.current = opts.initialFocus;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Make everything outside the dialog inert.
    const siblings = Array.from(document.body.children).filter((el) => root && !el.contains(root)) as HTMLElement[];
    const wasInert = siblings.map((el) => el.inert);
    siblings.forEach((el) => { el.inert = true; });
    (initial.current?.() ?? root?.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab" || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      siblings.forEach((el, i) => { el.inert = wasInert[i]!; });
      if (opener && document.contains(opener)) setTimeout(() => opener.focus(), 0);
    };
  }, []);

  return ref;
}
