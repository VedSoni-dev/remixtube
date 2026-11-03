"use client";
// Bring-your-own AI. Every request goes from this browser straight to the provider the user
// picked (or, for ChatGPT plan usage, to their own local TubeRemix server). TubeRemix's hosted
// server never sees a key. Keys live in sessionStorage unless the user asks to remember them.
import { aiPrompt, parseAiSuggestion, type Suggestion } from "@/core/describe";
import type { DataIndex } from "@/core/types";

export type ProviderId = "openai" | "anthropic" | "openrouter" | "chatgpt";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  route: string; // what kind of sanctioned access this is
  defaultModel: string;
  keyHint?: string;
  keyUrl?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: { id: "openai", name: "OpenAI API key", route: "Your own API key, sent only to api.openai.com", defaultModel: "gpt-5-mini", keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys" },
  anthropic: { id: "anthropic", name: "Anthropic API key", route: "Your own API key, sent only to api.anthropic.com", defaultModel: "claude-haiku-5-5", keyHint: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys" },
  openrouter: { id: "openrouter", name: "OpenRouter", route: "Sign in with OpenRouter (official OAuth PKCE), or paste a key", defaultModel: "openrouter/auto", keyHint: "sk-or-…", keyUrl: "https://openrouter.ai/settings/keys" },
  chatgpt: { id: "chatgpt", name: "ChatGPT plan", route: "Sign in with ChatGPT (official), only when TubeRemix runs on your own computer", defaultModel: "" },
};

interface Saved { key: string; model: string; remember: boolean }
const K = (p: ProviderId) => `tuberemix:ai:${p}`;

export function loadProvider(p: ProviderId): Saved | null {
  try {
    const raw = sessionStorage.getItem(K(p)) ?? localStorage.getItem(K(p));
    if (!raw) return null;
    const o = JSON.parse(raw) as Saved;
    return typeof o.key === "string" && typeof o.model === "string" ? o : null;
  } catch {
    return null;
  }
}

export function saveProvider(p: ProviderId, s: Saved): void {
  try {
    const body = JSON.stringify(s);
    sessionStorage.setItem(K(p), body);
    if (s.remember) localStorage.setItem(K(p), body);
    else localStorage.removeItem(K(p));
  } catch { /* storage blocked */ }
}

export function forgetProvider(p: ProviderId): void {
  try { sessionStorage.removeItem(K(p)); localStorage.removeItem(K(p)); } catch { /* ignore */ }
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    const m = typeof j.error === "string" ? j.error : j.error?.message;
    return m ? `${res.status}: ${m}` : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** One round trip to the chosen provider. Returns raw model text. */
export async function complete(p: ProviderId, system: string, user: string, signal?: AbortSignal): Promise<string> {
  if (p === "chatgpt") {
    const res = await fetch("/api/ai/chatgpt/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system, user }), signal });
    if (!res.ok) throw new Error(await errorText(res));
    return ((await res.json()) as { text: string }).text;
  }
  const saved = loadProvider(p);
  if (!saved?.key) throw new Error("Not connected");
  if (p === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": saved.key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: saved.model || PROVIDERS.anthropic.defaultModel, max_tokens: 600, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    const j = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  }
  const url = p === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${saved.key}` };
  if (p === "openrouter") { headers["x-title"] = "TubeRemix"; headers["http-referer"] = window.location.origin; }
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers,
    body: JSON.stringify({ model: saved.model || PROVIDERS[p].defaultModel, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? "";
}

export async function describeWithAi(p: ProviderId, text: string, index: DataIndex, signal?: AbortSignal): Promise<Suggestion> {
  const { system, user } = aiPrompt(text, index);
  const raw = await complete(p, system, user, signal);
  const s = parseAiSuggestion(raw, index);
  if (!s) throw new Error("The model’s answer didn’t name any real topics. Try rephrasing, or use keywords.");
  return s;
}

// --- OpenRouter OAuth PKCE (https://openrouter.ai/docs/guides/overview/auth/oauth) ---

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function startOpenRouter(): Promise<void> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem("tuberemix:or:verifier", verifier);
  const cb = `${window.location.origin}/tube/customize?ai=openrouter`;
  window.location.assign(`https://openrouter.ai/auth?callback_url=${encodeURIComponent(cb)}&code_challenge=${challenge}&code_challenge_method=S256`);
}

export async function finishOpenRouter(code: string): Promise<void> {
  const verifier = sessionStorage.getItem("tuberemix:or:verifier");
  if (!verifier) throw new Error("Sign-in expired. Try again.");
  sessionStorage.removeItem("tuberemix:or:verifier");
  const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  const j = (await res.json()) as { key?: string };
  if (!j.key) throw new Error("OpenRouter didn’t return a key.");
  saveProvider("openrouter", { key: j.key, model: PROVIDERS.openrouter.defaultModel, remember: false });
}
