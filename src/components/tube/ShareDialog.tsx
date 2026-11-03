"use client";
import { Check, Copy, Download, ExternalLink, FileJson, FileText, Package, Share2, Sheet, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { claudeCodePrompt, playlistCsv, playlistJson, playlistMarkdown, toConfig, youtubeQueueUrl } from "@/core/exporters";
import { cleanName } from "@/core/prefs";
import { sharePath } from "@/core/share";
import { writeZip } from "@/core/zip";
import { track } from "@/lib/analytics";
import { actions, signalsFrom, useStore } from "@/lib/store";
import { useFeed } from "@/lib/useFeed";

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ShareButton() {
  const [open, setOpen] = useState(false);
  const s = useStore();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!s.hasTube}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-paper disabled:opacity-40"
      >
        <Share2 size={15} aria-hidden /> Share &amp; export
      </button>
      {/* Portal: the sticky header's backdrop-filter would otherwise trap position: fixed. */}
      {open && createPortal(<ShareDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ShareDialog({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const signals = useMemo(() => signalsFrom(s), [s]);
  const feed = useFeed(s.prefs, signals, 50);
  const [name, setName] = useState(s.prefs.name);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const prefs = useMemo(() => ({ ...s.prefs, name: cleanName(name) }), [s.prefs, name]);
  const path = sharePath({ prefs, parent: s.parent });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}${path}`;
  const items = feed.status === "ready" ? feed.items : [];
  const config = feed.status === "ready" ? toConfig(prefs, s.parent, url, feed.index) : null;
  const fileBase = path.split("/r/")[1]?.split("--")[0] ?? "my-tube";

  const saveName = () => { if (prefs.name !== s.prefs.name) actions.setPrefs(prefs); };
  const flash = (k: string) => { setCopied(k); setTimeout(() => setCopied(null), 1600); };

  const copyLink = async () => {
    saveName();
    try { await navigator.clipboard.writeText(url); flash("link"); } catch { /* ignore */ }
    track("share_created", { kind: "link" });
  };
  const nativeShare = async () => {
    saveName();
    try {
      await navigator.share({ title: prefs.name || "My Tube", text: "My HackerTube remix, made with TubeRemix", url });
      track("share_created", { kind: "link" });
    } catch { /* cancelled */ }
  };
  const copyPrompt = async () => {
    if (!config) return;
    try { await navigator.clipboard.writeText(claudeCodePrompt(config, origin)); flash("prompt"); } catch { /* ignore */ }
    track("export", { kind: "prompt" });
  };
  const starter = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const res = await fetch("/download/starter-files.json");
      if (!res.ok) throw new Error("starter files missing");
      const files = (await res.json()) as Record<string, string>;
      const entries = Object.entries(files)
        .filter(([n]) => n !== "tuberemix.config.json")
        .map(([n, d]) => ({ name: `${fileBase}/${n}`, data: d }));
      entries.push({ name: `${fileBase}/tuberemix.config.json`, data: JSON.stringify(config, null, 2) + "\n" });
      download(`${fileBase}-starter.zip`, writeZip(entries) as BlobPart, "application/zip");
      track("export", { kind: "starter" });
    } finally {
      setBusy(false);
    }
  };

  const row = "flex w-full items-center gap-3 rounded-[4px] border border-hair bg-card px-3.5 py-3 text-left text-[14px] hover:border-ink/40 disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="fade-in max-h-[92dvh] w-full max-w-[720px] overflow-y-auto rounded-t-[10px] bg-paper p-5 shadow-2xl sm:rounded-[8px] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="meta">Share &amp; export</p>
            <h2 id="share-title" className="mt-1 font-serif text-[34px] leading-none">Send your Tube anywhere.</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-paper-2"><X size={18} /></button>
        </div>

        <label className="mt-6 block text-[13px] font-semibold" htmlFor="tube-name">Name</label>
        <input
          id="tube-name"
          value={name}
          maxLength={48}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          placeholder="My Tube"
          className="mt-1.5 h-11 w-full rounded-[4px] border border-hair bg-card px-3 text-[15px] outline-none focus:border-ink"
        />

        <p className="mt-5 text-[13px] font-semibold">Link</p>
        <div className="mt-1.5 flex gap-2">
          <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="h-11 min-w-0 flex-1 rounded-[4px] border border-hair bg-paper-2 px-3 font-mono text-[12px] text-ink-2" />
          <button type="button" onClick={copyLink} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-paper">
            {copied === "link" ? <Check size={16} /> : <Copy size={16} />} {copied === "link" ? "Copied" : "Copy"}
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button type="button" onClick={nativeShare} aria-label="Share with another app" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hair"><Share2 size={16} /></button>
          )}
        </div>
        <p className="mt-2 text-[12.5px] text-muted">The link is the recipe: anyone who opens it gets this exact feed, nothing is stored on a server. Your likes and history are not included.</p>

        <div className="mt-5 overflow-hidden rounded-[4px] border border-hair">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${path}/opengraph-image`} alt="Preview of the card people see when you post the link" className="block aspect-[1200/630] w-full bg-paper-2 object-cover" loading="lazy" />
        </div>

        <h3 className="mt-8 font-serif text-[24px]">Export</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" className={row} disabled={!config} onClick={() => { download(`${fileBase}.tuberemix.json`, JSON.stringify(config, null, 2) + "\n", "application/json"); track("export", { kind: "config" }); }}>
            <FileJson size={18} aria-hidden /> <span><b className="font-semibold">Config</b><br /><span className="text-muted">tuberemix.config.json</span></span>
          </button>
          <button type="button" className={row} disabled={!config || busy} onClick={starter}>
            <Package size={18} aria-hidden /> <span><b className="font-semibold">{busy ? "Packing…" : "Starter project"}</b><br /><span className="text-muted">ZIP with your config, runs on Node</span></span>
          </button>
          <button type="button" className={row} disabled={!items.length} onClick={() => { download(`${fileBase}-playlist.md`, playlistMarkdown(prefs.name, items, url), "text/markdown"); track("export", { kind: "playlist-md" }); }}>
            <FileText size={18} aria-hidden /> <span><b className="font-semibold">Playlist</b><br /><span className="text-muted">Top {items.length || 50} as Markdown</span></span>
          </button>
          <button type="button" className={row} disabled={!items.length} onClick={() => { download(`${fileBase}-playlist.csv`, playlistCsv(items), "text/csv"); track("export", { kind: "playlist-csv" }); }}>
            <Sheet size={18} aria-hidden /> <span><b className="font-semibold">Playlist</b><br /><span className="text-muted">CSV for spreadsheets</span></span>
          </button>
          <button type="button" className={row} disabled={!items.length} onClick={() => { download(`${fileBase}-playlist.json`, playlistJson(prefs.name, items, url), "application/json"); track("export", { kind: "playlist-json" }); }}>
            <Download size={18} aria-hidden /> <span><b className="font-semibold">Playlist</b><br /><span className="text-muted">JSON with the reasons</span></span>
          </button>
          <a className={row} aria-disabled={!items.length} href={items.length ? youtubeQueueUrl(items) : undefined} target="_blank" rel="noopener noreferrer" onClick={() => track("export", { kind: "youtube" })}>
            <ExternalLink size={18} aria-hidden /> <span><b className="font-semibold">Open on YouTube</b><br /><span className="text-muted">First 50 as a temporary queue</span></span>
          </a>
        </div>

        <div className="mt-3 rounded-[4px] border border-ink p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[14.5px] font-semibold"><Terminal size={17} aria-hidden /> Copy a Claude Code prompt</p>
              <p className="mt-1 text-[13px] text-ink-2">Paste it into Claude Code (or any coding agent) and it builds your own site from this config, on your machine.</p>
            </div>
            <button type="button" onClick={copyPrompt} disabled={!config} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-paper disabled:opacity-40">
              {copied === "prompt" ? <Check size={15} /> : <Copy size={15} />} {copied === "prompt" ? "Copied" : "Copy prompt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
