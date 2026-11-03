"use client";
import { Check, Copy, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { poolLine } from "@/core/catalog";
import type { Prefs } from "@/core/prefs";
import type { Ranked } from "@/core/rank";
import { track } from "@/lib/analytics";
import { actions, useStore } from "@/lib/store";
import { PlayerProvider, usePlayer } from "../player/PlayerProvider";
import { VideoCard } from "../VideoCard";

export function SharedTubeView(props: { prefs: Prefs; parent: string | null; id: string; items: Ranked[]; pool: number; topicNames: string[]; path: string }) {
  return (
    <PlayerProvider source="share">
      <View {...props} />
    </PlayerProvider>
  );
}

function View({ prefs, parent, id, items, pool, topicNames, path }: { prefs: Prefs; parent: string | null; id: string; items: Ranked[]; pool: number; topicNames: string[]; path: string }) {
  const router = useRouter();
  const player = usePlayer();
  const s = useStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => { track("shared_remix_opened", { source: "share", n: topicNames.length }, { oncePerTab: true }); }, [topicNames.length]);

  // Your current Tube is kept under "Your Tubes" (Customize), never overwritten.
  const remix = () => {
    const base = prefs.name.replace(/(\s*\(remix\))+$/i, "").slice(0, 40);
    actions.setPrefs({ ...prefs, name: base ? `${base} (remix)` : "" }, { parent: id, archive: true });
    track("remix_created", { source: "share", n: topicNames.length });
    if (parent) track("remix_of_remix", { source: "share", n: topicNames.length });
    router.push("/tube/customize");
  };
  const watchAsIs = () => {
    actions.setPrefs(prefs, { parent: id, archive: true });
    router.push("/tube");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
    track("share_created", { kind: "link", source: "share" });
  };

  return (
    <div className="pt-6">
      <p className="meta">A Tube someone made{parent ? ", remixed from another Tube" : ""} · made with TubeRemix, an independent project</p>
      <h1 className="mt-2 max-w-[18ch] font-serif text-[3.25rem] leading-[0.95] tracking-[-0.02em] sm:text-[5rem]">{prefs.name || "An untitled Tube"}</h1>
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Interests">
        {topicNames.map((t) => <li key={t} className="rounded-full bg-ink px-3.5 py-1.5 text-[0.8438rem] text-paper">{t}</li>)}
        {topicNames.length === 0 && <li className="text-[0.875rem] text-ink-2">HN’s all-time favourites, no topic filter</li>}
      </ul>
      <p className="mt-4 max-w-[62ch] text-[0.9375rem] text-ink-2">
        {poolLine(items.length, pool, topicNames.length)} Ranked by TubeRemix; open any video to see the HN comments behind it.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={remix} className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[0.9375rem] font-semibold text-paper">
          <Shuffle size={16} aria-hidden /> Remix this Tube
        </button>
        <button type="button" onClick={watchAsIs} className="inline-flex h-12 items-center rounded-full border border-ink px-5 text-[0.9375rem] font-semibold">Make it my Tube</button>
        <button type="button" onClick={copy} className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-[0.875rem] font-medium hover:bg-paper-2">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Link copied" : "Copy link"}
        </button>
      </div>
      {s.hasTube && (
        <p className="mt-3 max-w-[60ch] text-[0.8125rem] text-muted">Your own Tube stays safe: it moves to “Your Tubes” in Customize.</p>
      )}

      <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
        {items.map((r, i) => (
          <VideoCard key={r.video.id} video={r.video} reasons={r.reasons} rank={i + 1} priority={i < 3} onOpen={(v) => player.open(v, { queue: items.map((x) => x.video), reasons: r.reasons })} />
        ))}
      </div>
    </div>
  );
}
