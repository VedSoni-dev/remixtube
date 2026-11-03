"use client";
import { X } from "lucide-react";
import Link from "next/link";
import { actions, useHydrated, useStore, type Snap } from "@/lib/store";
import { usePlayer } from "../player/PlayerProvider";
import { Thumb } from "../Thumb";
import { Empty, PageHead } from "./Feed";

const COPY = {
  later: { kicker: "Watch Later", title: "Saved for later.", empty: "Nothing saved yet.", hint: "Press the bookmark on any video, or w while it’s focused." },
  liked: { kicker: "Liked", title: "Things you liked.", empty: "No likes yet.", hint: "Likes lift similar topics in your feed. Press l on a focused video." },
  history: { kicker: "History", title: "What you’ve watched.", empty: "Nothing watched yet.", hint: "Videos you play show up here and step aside in your feed." },
} as const;

export function SavedList({ list }: { list: keyof typeof COPY }) {
  const hydrated = useHydrated();
  const s = useStore();
  const player = usePlayer();
  const c = COPY[list];
  const items: Snap[] = list === "history" ? s.history : Object.values(list === "later" ? s.later : s.liked).sort((a, b) => b.at - a.at);
  const remove = (x: Snap) => (list === "history" ? actions.removeHistory(x.id) : list === "later" ? actions.toggleLater(x) : actions.toggleLike(x));
  return (
    <div>
      <PageHead kicker={c.kicker} title={c.title}>Stored only in this browser.</PageHead>
      {hydrated && !items.length && (
        <Empty title={c.empty} action={<Link href="/tube" className="rounded-full bg-ink px-5 py-2.5 font-semibold text-paper">Back to your Tube</Link>}>{c.hint}</Empty>
      )}
      {items.length > 0 && (
        <>
          <ol className="divide-y divide-hair border-y border-hair">
            {items.map((x) => (
              <li key={x.id} className="flex items-center gap-4 py-3" data-card={x.id}>
                <button type="button" onClick={() => player.openId(x.id)} className="group flex min-w-0 flex-1 items-center gap-4 text-left">
                  <div className="w-36 shrink-0 sm:w-44"><Thumb id={x.id} title={x.t} channel={x.c} style={s.thumbs} /></div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[0.9375rem] font-semibold group-hover:underline">{x.t}</p>
                    <p className="meta mt-1 truncate">{x.c} · {new Date(x.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                </button>
                <button type="button" onClick={() => remove(x)} aria-label={`Remove ${x.t}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-paper-2">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => { if (window.confirm(`Clear all of ${c.kicker}?`)) actions.clear(list); }}
            className="mt-6 text-[0.8438rem] text-muted underline underline-offset-4 hover:text-ink"
          >
            Clear {c.kicker}
          </button>
        </>
      )}
    </div>
  );
}
