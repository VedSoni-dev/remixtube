"use client";
// The official YouTube embed on youtube-nocookie.com, created only when the player opens.
// We don't load YouTube's JavaScript into our own page (it would run with access to this
// origin's storage). The embed's own postMessage events tell us when it plays or fails.
import { useEffect, useRef } from "react";

export type EmbedError = "removed" | "no-embed" | "error";
const ORIGINS = new Set(["https://www.youtube-nocookie.com", "https://www.youtube.com"]);

export function YouTubeEmbed({ id, title, onPlay, onError }: {
  id: string;
  title: string;
  onPlay: () => void;
  onError: (kind: EmbedError) => void;
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const cb = useRef({ onPlay, onError });
  cb.current = { onPlay, onError };

  useEffect(() => {
    let heard = false;
    const onMessage = (e: MessageEvent) => {
      if (!ORIGINS.has(e.origin) || e.source !== frame.current?.contentWindow) return;
      let d: { event?: string; info?: unknown };
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (!d || typeof d !== "object") return;
      heard = true;
      if (d.event === "onError") {
        const code = Number(d.info);
        cb.current.onError(code === 100 ? "removed" : code === 101 || code === 150 || code === 153 ? "no-embed" : "error");
      } else if (d.event === "onStateChange" && d.info === 1) {
        cb.current.onPlay();
      } else if (d.event === "infoDelivery" && (d.info as { playerState?: number } | null)?.playerState === 1) {
        cb.current.onPlay();
      }
    };
    window.addEventListener("message", onMessage);
    // Ask the embed to send events; repeat until it answers (it may still be loading).
    let tries = 0;
    const timer = setInterval(() => {
      if (heard || ++tries > 20) { clearInterval(timer); return; }
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id, channel: "widget" }), "https://www.youtube-nocookie.com");
    }, 400);
    return () => { clearInterval(timer); window.removeEventListener("message", onMessage); };
  }, [id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <iframe
      ref={frame}
      src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="absolute inset-0 h-full w-full"
    />
  );
}
