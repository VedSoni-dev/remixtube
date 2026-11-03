"use client";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, ExternalLink, Link2, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { youtubeUrl } from "@/core/catalog";
import type { Reason } from "@/core/rank";
import type { RelatedRef, VideoDetail, VideoLite } from "@/core/types";
import { track } from "@/lib/analytics";
import { loadDetail } from "@/lib/data";
import { actions, useStore } from "@/lib/store";
import { Thumb } from "../Thumb";
import { Provenance } from "./Provenance";
import { YouTubeEmbed, type EmbedError } from "./YouTubeEmbed";

interface OpenOpts { queue?: VideoLite[]; reasons?: Reason[] }
interface Ctx {
  open: (v: VideoLite, opts?: OpenOpts) => void;
  openId: (id: string) => void;
  close: () => void;
  current: string | null;
}
const PlayerCtx = createContext<Ctx | null>(null);

export function usePlayer(): Ctx {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("usePlayer outside PlayerProvider");
  return c;
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
}

export function PlayerProvider({ children, source = "tube" }: { children: React.ReactNode; source?: string }) {
  const [video, setVideo] = useState<VideoLite | null>(null);
  const [queue, setQueue] = useState<VideoLite[]>([]);
  const [reasons, setReasons] = useState<Reason[] | undefined>();
  const lastFocus = useRef<HTMLElement | null>(null);

  const setUrl = (id: string | null, push: boolean) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("v", id);
    else url.searchParams.delete("v");
    if (push) window.history.pushState({ v: id }, "", url);
    else window.history.replaceState({ v: id }, "", url);
  };

  const show = useCallback((v: VideoLite, opts: OpenOpts = {}, push = true) => {
    if (!video) lastFocus.current = document.activeElement as HTMLElement | null;
    setVideo(v);
    if (opts.queue) setQueue(opts.queue);
    setReasons(opts.reasons);
    // Push a history entry only when opening from a closed player; switching videos replaces it.
    setUrl(v.id, push && !new URL(window.location.href).searchParams.get("v"));
    track("video_opened", { source });
  }, [video, source]);

  const openId = useCallback((id: string) => {
    void loadDetail(id).then((d) => { if (d) show(d.v, {}, false); });
  }, [show]);

  const close = useCallback(() => {
    setVideo(null);
    setUrl(null, false);
    setTimeout(() => lastFocus.current?.focus?.(), 0);
  }, []);

  // Deep links (?v=) and the back button.
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("v");
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) openId(id);
    const onPop = () => {
      const v = new URL(window.location.href).searchParams.get("v");
      if (!v) setVideo(null);
      else if (/^[A-Za-z0-9_-]{11}$/.test(v)) openId(v);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    if (!video || !queue.length) return;
    const i = queue.findIndex((q) => q.id === video.id);
    const next = queue[i + dir];
    if (next) show(next, {}, false);
  }, [video, queue, show]);

  const value = useMemo<Ctx>(() => ({ open: show, openId, close, current: video?.id ?? null }), [show, openId, close, video]);

  return (
    <PlayerCtx.Provider value={value}>
      {children}
      {video && <PlayerSheet key={video.id} video={video} reasons={reasons} queue={queue} onClose={close} onStep={step} onOpen={(v) => show(v, {}, false)} />}
    </PlayerCtx.Provider>
  );
}

function RelatedRail({ title, items, onPick }: { title: string; items: RelatedRef[]; onPick: (r: RelatedRef) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h3 className="meta mb-3">{title}</h3>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.slice(0, 6).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onPick(r)} className="group flex w-full gap-3 text-left">
              <div className="w-32 shrink-0"><Thumb id={r.id} title={r.t} channel={r.c} /></div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug group-hover:underline">{r.t}</p>
                <p className="meta mt-1 truncate">{r.c}</p>
                {r.n ? <p className="mt-0.5 text-[12px] text-muted">{r.n} shared recommender{r.n === 1 ? "" : "s"}</p> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayerSheet({ video, reasons, queue, onClose, onStep, onOpen }: {
  video: VideoLite;
  reasons?: Reason[];
  queue: VideoLite[];
  onClose: () => void;
  onStep: (d: 1 | -1) => void;
  onOpen: (v: VideoLite) => void;
}) {
  const s = useStore();
  const [detail, setDetail] = useState<VideoDetail | null | "loading">("loading");
  const [err, setErr] = useState<EmbedError | null>(null);
  const [copied, setCopied] = useState(false);
  const closeBtn = useRef<HTMLButtonElement | null>(null);
  const marked = useRef(false);

  useEffect(() => {
    let live = true;
    loadDetail(video.id).then((d) => live && setDetail(d)).catch(() => live && setDetail(null));
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { live = false; document.body.style.overflow = prev; };
  }, [video.id]);

  const liked = !!s.liked[video.id];
  const disliked = !!s.disliked[video.id];
  const later = !!s.later[video.id];
  const idx = queue.findIndex((q) => q.id === video.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "j" || e.key === "ArrowRight" && e.shiftKey) onStep(1);
      else if (e.key === "k" || e.key === "ArrowLeft" && e.shiftKey) onStep(-1);
      else if (e.key === "l") actions.toggleLike(video);
      else if (e.key === "w") actions.toggleLater(video);
      else if (e.key === "n") actions.toggleDislike(video);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [video, onClose, onStep]);

  const onPlay = useCallback(() => {
    if (marked.current) return;
    marked.current = true;
    actions.watched(video);
  }, [video]);
  const onError = useCallback((kind: EmbedError) => {
    setErr(kind);
    if (kind === "removed") actions.markUnavailable(video.id);
  }, [video.id]);

  const copy = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", video.id);
    try { await navigator.clipboard.writeText(url.toString()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };

  const pickRef = (r: RelatedRef) => {
    void loadDetail(r.id).then((d) => { if (d) onOpen(d.v); });
  };

  const iconBtn = "inline-flex h-10 items-center gap-2 rounded-full border border-hair px-3.5 text-[13.5px] font-medium hover:bg-paper-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper";

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-ink/55 backdrop-blur-[2px] sm:items-start sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={video.t} className="fade-in relative flex h-full w-full max-w-[1080px] flex-col overflow-y-auto bg-paper shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:rounded-[6px]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-hair bg-paper/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onStep(-1)} disabled={idx <= 0} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper-2 disabled:opacity-30" aria-label="Previous video (k)" title="Previous (k)"><ArrowLeft size={18} /></button>
            <button type="button" onClick={() => onStep(1)} disabled={idx < 0 || idx >= queue.length - 1} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper-2 disabled:opacity-30" aria-label="Next video (j)" title="Next (j)"><ArrowRight size={18} /></button>
            {idx >= 0 && <span className="meta ml-1 tabular-nums">{idx + 1} / {queue.length}</span>}
          </div>
          <button ref={closeBtn} type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper-2" aria-label="Close player (Esc)" title="Close (Esc)"><X size={20} /></button>
        </div>

        <div className="relative aspect-video w-full bg-black">
          {err ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-paper">
              <p className="font-serif text-[26px]">{err === "removed" ? "This video is no longer on YouTube." : err === "no-embed" ? "The uploader doesn’t allow playback on other sites." : "YouTube couldn’t play this here."}</p>
              {err !== "removed" && <a className="inline-flex items-center gap-1.5 rounded-full bg-paper px-4 py-2 text-[14px] font-semibold text-ink" href={youtubeUrl(video.id)} target="_blank" rel="noopener noreferrer">Watch on YouTube <ExternalLink size={14} /></a>}
              {err === "removed" && <p className="text-[14px] opacity-80">We’ll keep it out of your feed. The HN discussion is still below.</p>}
            </div>
          ) : (
            <YouTubeEmbed id={video.id} title={video.t} onPlay={onPlay} onError={onError} />
          )}
        </div>

        <div className="px-4 pb-10 pt-5 sm:px-8">
          <h2 className="font-serif text-[30px] leading-[1.08] tracking-[-0.01em] sm:text-[36px]">{video.t}</h2>
          <p className="meta mt-2">{video.c} · {video.ty} · on HN {video.y0 === video.y1 ? video.y0 : `${video.y0}–${video.y1}`}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={iconBtn} aria-pressed={liked} onClick={() => actions.toggleLike(video)} title="Like (l)"><ThumbsUp size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Liked" : "Like"}</button>
            <button type="button" className={iconBtn} aria-pressed={later} onClick={() => actions.toggleLater(video)} title="Watch later (w)">{later ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {later ? "Saved" : "Watch later"}</button>
            <button type="button" className={iconBtn} aria-pressed={disliked} onClick={() => actions.toggleDislike(video)} title="Not for me (n)"><ThumbsDown size={16} /> {disliked ? "Hidden from feed" : "Not for me"}</button>
            <button type="button" className={iconBtn} onClick={copy}>{copied ? <Check size={16} /> : <Link2 size={16} />} {copied ? "Copied" : "Copy link"}</button>
            <a className={iconBtn} href={youtubeUrl(video.id)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> YouTube</a>
          </div>

          {reasons && reasons.length > 0 && (
            <div className="mt-6">
              <h3 className="meta mb-2">Why it’s in your feed</h3>
              <ul className="flex flex-wrap gap-2">
                {reasons.map((r) => <li key={r.text} className="rounded-full bg-paper-2 px-3 py-1 text-[13px] text-ink-2">{r.text}</li>)}
              </ul>
            </div>
          )}

          {video.q && (
            <blockquote className="mt-6 border-l-2 border-ink pl-4 font-serif text-[22px] italic leading-snug text-ink">
              “{video.q}”
            </blockquote>
          )}

          {detail === "loading" && <div className="mt-8 space-y-3" aria-busy="true"><div className="skeleton h-6 w-2/3 rounded" /><div className="skeleton h-24 w-full rounded" /><div className="skeleton h-24 w-full rounded" /></div>}
          {detail && detail !== "loading" && (
            <>
              <Provenance id={video.id} detail={detail} />
              <RelatedRail title="HN people who recommended this also recommend" items={detail.corec} onPick={pickRef} />
              <RelatedRail title="Similar videos" items={detail.similar} onPick={pickRef} />
            </>
          )}
          {detail === null && <p className="mt-8 text-[14px] text-muted">The HN discussion for this video couldn’t be loaded. Check your connection and reopen it.</p>}
        </div>
      </div>
    </div>
  );
}
