"use client";
// Official YouTube IFrame Player API on youtube-nocookie.com. Created only when the
// player opens (lazy). Error codes tell us when a video was removed or blocks embedding.
import { useEffect, useRef } from "react";

interface YTPlayer { destroy(): void }
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YTNamespace | null> | null = null;
function loadApi(): Promise<YTNamespace | null> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT ?? null); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => { apiPromise = null; resolve(null); };
    document.head.appendChild(s);
    setTimeout(() => resolve(window.YT?.Player ? window.YT : null), 8000);
  });
  return apiPromise;
}

export type EmbedError = "removed" | "no-embed" | "error";

export function YouTubeEmbed({ id, title, onPlay, onError }: {
  id: string;
  title: string;
  onPlay: () => void;
  onError: (kind: EmbedError) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const cb = useRef({ onPlay, onError });
  cb.current = { onPlay, onError };

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
    const el = host.current;
    if (!el) return;
    el.innerHTML = "";
    const mount = document.createElement("div");
    el.appendChild(mount);
    loadApi().then((YT) => {
      if (cancelled) return;
      if (!YT) {
        // API blocked: fall back to a plain official embed.
        const f = document.createElement("iframe");
        f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
        f.title = title;
        f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        f.allowFullscreen = true;
        f.referrerPolicy = "strict-origin-when-cross-origin";
        f.className = "h-full w-full";
        el.replaceChildren(f);
        cb.current.onPlay();
        return;
      }
      player = new YT.Player(mount, {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: (e: { target: { getIframe?: () => HTMLIFrameElement } }) => {
            const f = e.target.getIframe?.();
            if (f) { f.title = title; f.className = "h-full w-full"; }
          },
          onStateChange: (e: { data: number }) => { if (e.data === 1) cb.current.onPlay(); },
          onError: (e: { data: number }) => {
            cb.current.onError(e.data === 100 ? "removed" : e.data === 101 || e.data === 150 || e.data === 153 ? "no-embed" : "error");
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try { player?.destroy(); } catch { /* already gone */ }
    };
  }, [id, title]);

  return <div ref={host} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />;
}
