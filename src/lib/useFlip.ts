"use client";
// FLIP: when the order of keyed children changes, animate each from its old box to its new one.
// The order itself always comes from the real ranking; this only animates the move.
import { useLayoutEffect, useRef } from "react";

export function useFlip<T extends HTMLElement>(keys: string[]) {
  const container = useRef<T | null>(null);
  const boxes = useRef(new Map<string, { left: number; top: number }>());
  const sig = keys.join("|");

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, { left: number; top: number }>();
    const origin = el.getBoundingClientRect();
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    for (const item of items) {
      const r = item.getBoundingClientRect();
      next.set(item.dataset.flip!, { left: r.left - origin.left, top: r.top - origin.top });
    }
    if (!reduce) {
      items.forEach((item, i) => {
        const key = item.dataset.flip!;
        const prev = boxes.current.get(key);
        const now = next.get(key)!;
        if (prev) {
          const dx = prev.left - now.left;
          const dy = prev.top - now.top;
          if (dx || dy) {
            item.style.zIndex = "1";
            item.animate(
              [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
              { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", delay: Math.min(i * 10, 120) },
            ).onfinish = () => { item.style.zIndex = ""; };
          }
        } else if (boxes.current.size) {
          item.animate(
            [{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "scale(1)" }],
            { duration: 260, easing: "ease-out", delay: Math.min(i * 12, 140), fill: "backwards" },
          );
        }
      });
    }
    boxes.current = next;
  }, [sig]);

  return container;
}
