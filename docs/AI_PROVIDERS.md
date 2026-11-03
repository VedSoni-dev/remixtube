# Bring your own AI

TubeRemix works completely without AI. The only AI feature is **Describe it** (Customize): type
what you want to watch and get topic, format and depth suggestions. Without a provider, a keyword
matcher over the taxonomy's own synonym-rich descriptions does it. A model can do it better.

Rule: only officially supported sign-in routes. Nothing extracts, proxies or stores subscription
session tokens in unsanctioned ways. Checked 2026-11-03.

| Provider | Route | Where it works | Where the credential lives |
|---|---|---|---|
| OpenAI API key | User pastes their own key; browser calls api.openai.com directly | Hosted + local | Tab's sessionStorage (or localStorage if "Remember") |
| Anthropic API key | Own key; browser calls api.anthropic.com with `anthropic-dangerous-direct-browser-access` | Hosted + local | Same |
| OpenRouter | **Sign in with OpenRouter** (official OAuth PKCE → user-owned key), or paste a key | Hosted + local | Same |
| ChatGPT plan (Plus/Pro) | **Sign in with ChatGPT**, plan usage for open-source apps (`developers.openai.com/siwc/token-sharing-open-source`) | **Local installs only** | `~/.config/tuberemix/chatgpt.json`, mode 0600, never in the browser |
| Claude Pro/Max subscription | Not offered | — | — |

## Why ChatGPT is local-only

OpenAI's docs allow ChatGPT plan usage self-serve for "open-source and locally hosted apps".
Paid or remotely hosted apps need OpenAI's partner program (interest form). TubeRemix's hosted
site isn't a partner, so the button only appears when you run TubeRemix on your own computer:

```bash
# in your TubeRemix clone
npm run build
TUBEREMIX_LOCAL=1 npm start        # PowerShell: $env:TUBEREMIX_LOCAL=1; npm start
```

Then Customize → AI → **Continue with ChatGPT**. The flow follows the docs: a stable
`ext_agent_host_id` (`urn:uuid:…`, `~/.config/tuberemix/host.json`), `client_id=dynamic_agent_client`
on first registration with `agent_name_hint=TubeRemix`, PKCE S256, loopback redirect
`http://127.0.0.1:<port>/auth/callback`, ID-token signature/issuer/audience/expiry/nonce checks,
the `chatgpt.tokens.use.direct` scope check, Responses API with `store: false` and `stream: true`,
completion only on `response.completed`, serialized refresh, and revocation on sign-out. The
server refuses these routes unless `TUBEREMIX_LOCAL=1` and the Host header is `127.0.0.1:<port>`;
POSTs must come from that same origin.

Status: implemented to the published spec, but **not verified end to end** with a real ChatGPT
account (that needs the owner's own sign-in).

## Why no Claude subscription sign-in

Anthropic's terms (clarified February 2026) don't allow OAuth tokens from Claude Free/Pro/Max
accounts to be used in third-party products. TubeRemix offers an Anthropic API key instead, and
the supported way to use a Claude subscription: copy the **Claude Code prompt** from
Share & export and run it in Claude Code yourself.

## publik

publik (publikhq.com) offers keyless, OpenAI-compatible AI for an app's users once the app is
listed. Listing requires a public GitHub repository (or a connected private one with platform
release downloads). Not wired yet; see `launch/PUBLIK_PLAN.md`.
