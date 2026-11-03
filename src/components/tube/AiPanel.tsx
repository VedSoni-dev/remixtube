"use client";
import { Check, KeyRound, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useModal } from "@/lib/useModal";
import { finishOpenRouter, forgetProvider, loadProvider, PROVIDERS, saveProvider, startOpenRouter, type ProviderId } from "@/lib/ai";

export interface ChatGptStatus { local: boolean; connected: boolean; email: string; planUsage: boolean; manageUsage: string }

export function useAiConnections() {
  const [tick, setTick] = useState(0);
  const [gpt, setGpt] = useState<ChatGptStatus | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/ai/chatgpt/status").then((r) => r.json()).then((j: ChatGptStatus) => live && setGpt(j)).catch(() => {});
    return () => { live = false; };
  }, [tick]);
  const connected: ProviderId[] = (["openai", "anthropic", "openrouter"] as const).filter((p) => typeof window !== "undefined" && !!loadProvider(p)?.key);
  if (gpt?.connected && gpt.planUsage) connected.push("chatgpt");
  return { connected, gpt, refresh: () => setTick((t) => t + 1), tick };
}

export function AiPanel({ onChange }: { onChange: () => void }) {
  const { gpt, refresh, tick } = useAiConnections();
  const [msg, setMsg] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  // Return trips from OpenRouter / ChatGPT sign-in.
  useEffect(() => {
    const u = new URL(window.location.href);
    const code = u.searchParams.get("code");
    if (u.searchParams.get("ai") === "openrouter" && code) {
      finishOpenRouter(code).then(() => { setMsg("Connected to OpenRouter."); refresh(); onChange(); }).catch((e: Error) => setMsg(e.message));
    }
    if (u.searchParams.get("chatgpt") === "connected") {
      try { if (!localStorage.getItem("tuberemix:chatgpt:welcomed")) { setWelcome(true); localStorage.setItem("tuberemix:chatgpt:welcomed", "1"); } } catch { /* ignore */ }
      onChange();
    }
    if (u.searchParams.get("chatgpt") === "no-plan") setMsg("Signed in, but ChatGPT plan use wasn’t allowed, so TubeRemix won’t use it.");
    const err = u.searchParams.get("chatgpt_error");
    if (err) setMsg(err);
    if (u.searchParams.has("ai")) {
      ["ai", "code", "chatgpt", "chatgpt_error"].forEach((k) => u.searchParams.delete(k));
      window.history.replaceState(null, "", u);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chatgptSignIn = async () => {
    const r = await fetch("/api/ai/chatgpt/start", { method: "POST" });
    const j = (await r.json()) as { url?: string; error?: string };
    if (j.url) window.location.assign(j.url);
    else setMsg(j.error ?? "Couldn’t start sign-in.");
  };
  const chatgptSignOut = async () => {
    const r = await fetch("/api/ai/chatgpt/logout", { method: "POST" });
    const j = (await r.json()) as { revoked?: boolean };
    setMsg(j.revoked ? "Signed out of ChatGPT." : "Signed out here. Remote revocation wasn’t confirmed; you can disconnect TubeRemix in ChatGPT settings.");
    refresh(); onChange();
  };

  return (
    <div className="space-y-3" key={tick}>
      <p className="text-[0.875rem] leading-relaxed text-ink-2">
        Optional. TubeRemix works fully without AI. Connect a model only to turn a sentence into topics. Requests go straight from your browser to the provider; TubeRemix’s server never sees your key.
      </p>
      {msg && <p role="status" className="rounded-[4px] bg-paper-2 px-3 py-2 text-[0.8438rem]">{msg}</p>}

      <div className="rounded-[4px] border border-hair bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Use your ChatGPT plan</p>
            <p className="mt-0.5 text-[0.8125rem] text-ink-2">
              {gpt?.local
                ? "Eligible requests from this local TubeRemix use the usage included in your ChatGPT plan. Tokens stay in a private file on this computer."
                : "Available when you run TubeRemix on your own computer with TUBEREMIX_LOCAL=1 (OpenAI allows ChatGPT plan use for open-source apps only there). See Build your own."}
            </p>
            {gpt?.connected && <p className="mt-1 text-[0.8125rem]"><Check size={13} className="inline" /> Using ChatGPT plan{gpt.email ? ` (${gpt.email})` : ""} · <a className="underline" href={gpt.manageUsage} target="_blank" rel="noopener noreferrer">Manage usage</a></p>}
          </div>
          {gpt?.local && !gpt.connected && (
            <button type="button" onClick={chatgptSignIn} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#0d0d0d] px-4 text-[0.8438rem] font-semibold text-white">Continue with ChatGPT</button>
          )}
          {gpt?.connected && <button type="button" onClick={chatgptSignOut} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[0.8125rem]"><LogOut size={14} /> Sign out</button>}
        </div>
      </div>

      <div className="rounded-[4px] border border-hair bg-card p-4">
        <p className="font-semibold">Claude subscription (Pro or Max)</p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-2">
          Anthropic doesn’t allow third-party apps to use Claude subscription logins, so TubeRemix doesn’t offer it. Use an Anthropic API key below, or use your subscription the supported way: copy the Claude Code prompt from Share &amp; export and run it in Claude Code yourself.
        </p>
      </div>

      <KeyProvider id="openrouter" onChange={() => { refresh(); onChange(); }} extra={
        <button type="button" onClick={() => void startOpenRouter()} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[0.8438rem] font-semibold text-paper">Sign in with OpenRouter</button>
      } />
      <KeyProvider id="anthropic" onChange={() => { refresh(); onChange(); }} />
      <KeyProvider id="openai" onChange={() => { refresh(); onChange(); }} />

      {welcome && createPortal(<Welcome onClose={() => setWelcome(false)} />, document.body)}
    </div>
  );
}

function KeyProvider({ id, onChange, extra }: { id: "openai" | "anthropic" | "openrouter"; onChange: () => void; extra?: React.ReactNode }) {
  const info = PROVIDERS[id];
  const saved = typeof window !== "undefined" ? loadProvider(id) : null;
  const [key, setKey] = useState("");
  const [model, setModel] = useState(saved?.model ?? info.defaultModel);
  const [remember, setRemember] = useState(saved?.remember ?? false);
  return (
    <div className="rounded-[4px] border border-hair bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{info.name}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2">{info.route}. <a className="underline" href={info.keyUrl} target="_blank" rel="noopener noreferrer">Get a key</a></p>
          {saved && <p className="mt-1 text-[0.8125rem]"><Check size={13} className="inline" /> Connected · model {saved.model}</p>}
        </div>
        {!saved && extra}
        {saved && <button type="button" onClick={() => { forgetProvider(id); onChange(); }} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[0.8125rem]"><LogOut size={14} /> Forget key</button>}
      </div>
      {!saved && (
        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!key.trim()) return; saveProvider(id, { key: key.trim(), model: model.trim() || info.defaultModel, remember }); setKey(""); onChange(); }}>
          <label className="sr-only" htmlFor={`k-${id}`}>{info.name}</label>
          <input id={`k-${id}`} type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder={info.keyHint} className="h-10 min-w-0 flex-1 rounded-[4px] border border-line bg-paper px-3 font-mono text-[0.8125rem]" />
          <label className="sr-only" htmlFor={`m-${id}`}>Model</label>
          <input id={`m-${id}`} value={model} onChange={(e) => setModel(e.target.value)} className="h-10 w-44 rounded-[4px] border border-hair bg-paper px-3 font-mono text-[0.7812rem]" aria-label="Model" />
          <label className="flex items-center gap-1.5 text-[0.7812rem] text-ink-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember on this device</label>
          <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink px-4 text-[0.8438rem] font-semibold"><KeyRound size={14} /> Save key</button>
        </form>
      )}
    </div>
  );
}

function Welcome({ onClose }: { onClose: () => void }) {
  const ref = useModal<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="gpt-welcome" className="w-full max-w-sm rounded-[8px] bg-paper p-6 text-center shadow-2xl">
        <p id="gpt-welcome" className="font-serif text-[1.75rem] leading-tight">You’re using your ChatGPT plan</p>
        <p className="mt-2 text-[0.875rem] text-ink-2">Eligible AI requests in TubeRemix now use the usage included in your ChatGPT plan. You can manage this in ChatGPT settings.</p>
        <button type="button" onClick={onClose} className="mt-5 h-10 rounded-full bg-ink px-6 font-semibold text-paper">Got it</button>
      </div>
    </div>
  );
}
