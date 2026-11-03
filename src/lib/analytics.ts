"use client";
// Minimal, privacy-conscious product events. No video ids, titles, topics, names or
// viewing history leave the browser. A random per-tab session id lets us compute
// funnels (visitor -> feed -> share) without identifying anyone. Honors GPC and DNT.

export const EVENTS = [
  "landing_view", "builder_started", "interests_selected", "feed_generated", "video_opened",
  "share_created", "shared_remix_opened", "remix_of_remix", "export",
] as const;
export type EventName = (typeof EVENTS)[number];

type Props = Partial<{ source: string; kind: string; n: number; ms: number }>;

function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("tuberemix:sid");
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem("tuberemix:sid", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

const once = new Set<string>();

export function track(name: EventName, props: Props = {}, opts: { oncePerTab?: boolean } = {}): void {
  if (optedOut()) return;
  if (opts.oncePerTab) {
    const k = `tuberemix:once:${name}`;
    try {
      if (once.has(k) || sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch { /* ignore */ }
    once.add(k);
  }
  const body = JSON.stringify({ e: name, s: sessionId(), p: props });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/e", new Blob([body], { type: "application/json" }));
    else void fetch("/api/e", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  } catch { /* analytics must never break the app */ }
}

/** Milliseconds since this tab first opened TubeRemix (for time-to-feed). */
export function sinceStart(): number {
  try {
    const k = "tuberemix:t0";
    const v = sessionStorage.getItem(k);
    if (v) return Math.max(0, Date.now() - Number(v));
    sessionStorage.setItem(k, String(Date.now()));
  } catch { /* ignore */ }
  return 0;
}
