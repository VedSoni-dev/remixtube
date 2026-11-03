import "server-only";
// Sign in with ChatGPT, plan usage for open-source apps on the user's own computer.
// Follows https://developers.openai.com/siwc/token-sharing-open-source step by step.
// Only active when TUBEREMIX_LOCAL=1 and the request comes to a 127.0.0.1 host.
// Tokens are stored in a 0600 file in the user's config dir, never in the browser.
import { createHash, createPublicKey, randomBytes, randomUUID, verify, type JsonWebKey } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const ISSUER = "https://auth.openai.com";
const AUTHORIZE = "https://auth.openai.com/api/accounts/authorize";
const TOKEN = "https://auth.openai.com/api/accounts/oauth/token";
const DISCOVERY = "https://auth.openai.com/.well-known/openid-configuration";
const RESOURCE = "https://api.openai.com/v1";
const SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
export const AGENT_NAME = "TubeRemix";
export const MANAGE_USAGE = "https://chatgpt.com/settings/usage";

const dir = () => process.env.TUBEREMIX_CONFIG_DIR || join(homedir(), ".config", "tuberemix");
const file = (n: string) => join(dir(), n);

async function readJsonFile<T>(name: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file(name), "utf8")) as T; } catch { return null; }
}

async function writeJsonFile(name: string, data: unknown): Promise<void> {
  await mkdir(dir(), { recursive: true, mode: 0o700 });
  const tmp = file(`${name}.${randomBytes(4).toString("hex")}.tmp`);
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(tmp, file(name));
}

export interface Credential {
  email: string;
  issuer: string;
  subject: string;
  client_id: string;
  ext_agent_host_id: string;
  id_token: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scopes: string[];
  saved_at: string;
  model?: string;
}

interface Pending { state: string; nonce: string; verifier: string; redirectUri: string; clientId: string; createdAt: number }

const LOOPBACK = /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/;

/**
 * Local-only guard. Returns the loopback origin, or null when this server isn't a local install.
 * Headers alone can be forged, so this also requires that Next itself was started bound to
 * 127.0.0.1 (`next start -H 127.0.0.1`, as `npm start` does). It fails closed.
 */
export function localOrigin(req: Request, opts: { post?: boolean } = {}): string | null {
  if (process.env.TUBEREMIX_LOCAL !== "1") return null;
  const bound = process.env.__NEXT_PRIVATE_ORIGIN ?? "";
  if (!/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(bound)) return null;
  const h = req.headers;
  if (`http://${h.get("host") ?? ""}` !== bound) return null;
  // Anything a reverse proxy adds means this request didn't come straight from this machine.
  if (h.get("forwarded") || h.get("via") || h.get("x-real-ip")) return null;
  const xff = (h.get("x-forwarded-for") ?? "127.0.0.1").split(",").map((x) => x.trim());
  if (!xff.every((x) => LOOPBACK.test(x))) return null;
  if (opts.post) {
    // CSRF: state-changing calls must come from this same local origin.
    if (h.get("origin") !== bound) return null;
    const site = h.get("sec-fetch-site");
    if (site && site !== "same-origin") return null;
  }
  return bound;
}

export async function hostId(): Promise<string> {
  const saved = await readJsonFile<{ ext_agent_host_id: string }>("host.json");
  if (saved?.ext_agent_host_id?.startsWith("urn:uuid:")) return saved.ext_agent_host_id;
  const id = `urn:uuid:${randomUUID()}`;
  await writeJsonFile("host.json", { ext_agent_host_id: id });
  return id;
}

export const loadCredential = () => readJsonFile<Credential>("chatgpt.json");

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function startAuthorization(origin: string): Promise<string> {
  const prev = await loadCredential();
  const clientId = prev?.client_id ?? "dynamic_agent_client";
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const redirectUri = `${origin}/auth/callback`;
  const pending: Pending = { state, nonce, verifier, redirectUri, clientId, createdAt: Date.now() };
  await writeJsonFile("pending.json", pending);
  const q = new URLSearchParams({
    client_id: clientId,
    ext_agent_host_id: await hostId(),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    resource: RESOURCE,
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  if (clientId === "dynamic_agent_client") q.set("agent_name_hint", AGENT_NAME);
  else {
    if (prev?.id_token) q.set("id_token_hint", prev.id_token);
    if (prev?.email) q.set("login_hint", prev.email);
  }
  return `${AUTHORIZE}?${q.toString()}`;
}

function decodePart<T>(s: string): T {
  return JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as T;
}

async function verifyIdToken(idToken: string, clientId: string, nonce: string): Promise<{ sub: string; email: string }> {
  const [h, p, sig] = idToken.split(".");
  if (!h || !p || !sig) throw new Error("malformed id_token");
  const header = decodePart<{ alg: string; kid?: string }>(h);
  const claims = decodePart<{ iss: string; aud: string | string[]; exp: number; nonce?: string; sub: string; email?: string }>(p);
  const disc = (await (await fetch(DISCOVERY)).json()) as { jwks_uri: string; issuer: string };
  const jwks = (await (await fetch(disc.jwks_uri)).json()) as { keys: (JsonWebKey & { kid?: string })[] };
  const jwk = jwks.keys.find((k) => k.kid === header.kid) ?? (jwks.keys.length === 1 ? jwks.keys[0] : undefined);
  if (!jwk) throw new Error("signing key not found");
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const data = Buffer.from(`${h}.${p}`);
  const signature = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  let ok = false;
  if (header.alg === "RS256") ok = verify("RSA-SHA256", data, key, signature);
  else if (header.alg === "ES256") ok = verify("SHA256", data, { key, dsaEncoding: "ieee-p1363" }, signature);
  else throw new Error(`unsupported alg ${header.alg}`);
  if (!ok) throw new Error("id_token signature invalid");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== disc.issuer && claims.iss !== ISSUER) throw new Error("issuer mismatch");
  if (!aud.includes(clientId)) throw new Error("audience mismatch");
  if (claims.exp * 1000 < Date.now()) throw new Error("id_token expired");
  if (claims.nonce !== nonce) throw new Error("nonce mismatch");
  return { sub: claims.sub, email: claims.email ?? "" };
}

export type CallbackResult = { ok: true; planUsage: boolean } | { ok: false; error: string };

export async function handleCallback(params: URLSearchParams): Promise<CallbackResult> {
  const pending = await readJsonFile<Pending>("pending.json");
  if (!pending || Date.now() - pending.createdAt > 10 * 60_000) return { ok: false, error: "Sign-in expired. Start again." };
  // A stray request with the wrong state must not cancel a sign-in in progress.
  if (params.get("state") !== pending.state) return { ok: false, error: "State mismatch; sign-in ignored." };
  await rm(file("pending.json"), { force: true });
  if (params.get("error")) return { ok: false, error: params.get("error") === "access_denied" ? "You declined, so TubeRemix won’t use your ChatGPT plan." : `Sign-in failed: ${params.get("error")}` };
  const code = params.get("code");
  if (!code) return { ok: false, error: "No authorization code returned." };
  let clientId = pending.clientId;
  const returned = params.get("client_id");
  if (clientId === "dynamic_agent_client") {
    if (!returned) return { ok: false, error: "Registration incomplete (no client id returned)." };
    clientId = returned;
  } else if (returned && returned !== clientId) {
    return { ok: false, error: "A different client id came back; sign-in rejected." };
  }
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: pending.verifier, redirect_uri: pending.redirectUri, resource: RESOURCE }),
  });
  if (!res.ok) return { ok: false, error: `Token exchange failed (HTTP ${res.status}).` };
  const t = (await res.json()) as { access_token: string; refresh_token: string; id_token: string; token_type: string; expires_in: number; scope: string };
  let ident: { sub: string; email: string };
  try {
    ident = await verifyIdToken(t.id_token, clientId, pending.nonce);
  } catch (e) {
    return { ok: false, error: `Couldn’t verify the sign-in: ${e instanceof Error ? e.message : "unknown"}` };
  }
  const prev = await loadCredential();
  if (prev && prev.client_id === clientId && prev.subject !== ident.sub) return { ok: false, error: "That’s a different account than the one registered here." };
  const scopes = (t.scope ?? "").split(/\s+/).filter(Boolean).sort();
  await writeJsonFile("chatgpt.json", {
    email: ident.email, issuer: ISSUER, subject: ident.sub, client_id: clientId, ext_agent_host_id: await hostId(),
    id_token: t.id_token, access_token: t.access_token, refresh_token: t.refresh_token, token_type: t.token_type,
    expires_in: t.expires_in, scopes, saved_at: new Date().toISOString(),
  } satisfies Credential);
  return { ok: true, planUsage: scopes.includes("chatgpt.tokens.use.direct") };
}

let refreshing: Promise<Credential> | null = null;
async function freshCredential(): Promise<Credential> {
  const first = await loadCredential();
  if (!first?.refresh_token) throw Object.assign(new Error("Not signed in with ChatGPT."), { status: 401 });
  if (Date.parse(first.saved_at) + first.expires_in * 1000 - Date.now() > 120_000) return first;
  // Single flight; re-read inside it so a rotated refresh token is never reused.
  refreshing ??= (async () => {
    try {
      const c = (await loadCredential())!;
      if (Date.parse(c.saved_at) + c.expires_in * 1000 - Date.now() > 120_000) return c;
      const res = await fetch(TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", client_id: c.client_id, refresh_token: c.refresh_token, resource: RESOURCE }),
      });
      if (res.status >= 500) throw Object.assign(new Error("ChatGPT sign-in is temporarily unavailable. Try again shortly."), { status: 503 });
      if (!res.ok) {
        // invalid_grant and friends are terminal: forget the tokens so the UI shows signed out.
        await writeJsonFile("chatgpt.json", { ...c, access_token: "", refresh_token: "", expires_in: 0 });
        throw Object.assign(new Error("Your ChatGPT session ended. Sign in again."), { status: 401 });
      }
      const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
      const next: Credential = { ...c, access_token: t.access_token, refresh_token: t.refresh_token || c.refresh_token, expires_in: t.expires_in, scopes: t.scope ? t.scope.split(/\s+/).sort() : c.scopes, saved_at: new Date().toISOString() };
      await writeJsonFile("chatgpt.json", next);
      return next;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function pickModel(c: Credential): Promise<string> {
  if (process.env.TUBEREMIX_CHATGPT_MODEL) return process.env.TUBEREMIX_CHATGPT_MODEL;
  if (c.model) return c.model;
  const res = await fetch(`${RESOURCE}/models`, { headers: { authorization: `Bearer ${c.access_token}` } });
  if (!res.ok) throw Object.assign(new Error(`Couldn’t list models (HTTP ${res.status}).`), { status: res.status });
  const j = (await res.json()) as { models?: { slug: string; visibility?: string }[] };
  const slug = j.models?.find((m) => m.visibility === "list")?.slug;
  if (!slug) throw new Error("No models available for this ChatGPT account.");
  await writeJsonFile("chatgpt.json", { ...c, model: slug });
  return slug;
}

/** Streams one Responses API call (store:false, stream:true) and returns the text once completed. */
export async function completeWithPlan(system: string, user: string): Promise<string> {
  const c = await freshCredential();
  if (!c.scopes.includes("chatgpt.tokens.use.direct")) throw Object.assign(new Error("ChatGPT plan use wasn’t granted. Sign in again and allow it."), { status: 403 });
  const model = await pickModel(c);
  const res = await fetch(`${RESOURCE}/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${c.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions: system, input: [{ role: "user", content: user }], store: false, stream: true }),
  });
  if (!res.ok || !res.body) {
    let code = "";
    try { code = ((await res.json()) as { error?: { code?: string } }).error?.code ?? ""; } catch { /* ignore */ }
    if (code === "subscription_sharing_usage_limit_exceeded") throw Object.assign(new Error(`Usage limit reached. Manage usage: ${MANAGE_USAGE}`), { status: 429 });
    if (code === "subscription_sharing_usage_unavailable" || code === "subscription_sharing_user_unavailable") {
      throw Object.assign(new Error("ChatGPT couldn’t check your plan right now. Try again in a minute."), { status: 503 });
    }
    throw Object.assign(new Error(`ChatGPT request failed (HTTP ${res.status}${code ? `, ${code}` : ""}).`), { status: res.status });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let done = false;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data || data === "[DONE]") continue;
      let ev: { type?: string; delta?: string; response?: { error?: { code?: string } } };
      try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
      else if (ev.type === "response.completed") done = true;
      else if (ev.type === "response.failed") {
        const code = ev.response?.error?.code ?? "unknown_error";
        if (code === "subscription_sharing_usage_limit_exceeded") throw Object.assign(new Error(`Usage limit reached. Manage usage: ${MANAGE_USAGE}`), { status: 429 });
        throw new Error(`ChatGPT response failed: ${code}`);
      } else if (ev.type === "response.incomplete") throw new Error("ChatGPT stopped before finishing. Try again.");
    }
  }
  if (!done) throw new Error("The stream ended before response.completed.");
  return text;
}

export async function signOut(): Promise<{ revoked: boolean }> {
  const c = await loadCredential();
  if (!c) return { revoked: true };
  let revoked = false;
  // Retry network errors and 5xx with backoff while we still hold the refresh token.
  for (let attempt = 0; attempt < 3 && !revoked && c.refresh_token; attempt++) {
    try {
      const disc = (await (await fetch(DISCOVERY)).json()) as { revocation_endpoint?: string };
      if (!disc.revocation_endpoint) break;
      const r = await fetch(disc.revocation_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: c.refresh_token, token_type_hint: "refresh_token", client_id: c.client_id }),
      });
      revoked = r.ok;
      if (r.status < 500) break;
    } catch { /* network: retry */ }
    if (!revoked) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  // Keep the client/account mapping and host id for a later sign-in; clear the tokens.
  await writeJsonFile("chatgpt.json", { ...c, access_token: "", refresh_token: "", id_token: "", expires_in: 0 });
  return { revoked };
}

export async function status(): Promise<{ connected: boolean; email: string; planUsage: boolean }> {
  const c = await loadCredential();
  const connected = !!c?.refresh_token;
  return { connected, email: connected ? c!.email : "", planUsage: connected && !!c?.scopes.includes("chatgpt.tokens.use.direct") };
}
