"use client";
// Local-only state: preferences, likes, saves and history live in this browser
// (localStorage). Nothing here is ever sent to a server.
import { useSyncExternalStore } from "react";
import { buildSignals, type Signals } from "@/core/rank";
import { defaultPrefs, sanitizePrefs, type Prefs } from "@/core/prefs";
import type { VideoLite } from "@/core/types";

export interface Snap {
  id: string;
  t: string;
  c: string;
  k: string[];
  at: number;
}

export interface State {
  v: 1;
  prefs: Prefs;
  hasTube: boolean;
  parent: string | null; // tubeId this Tube was remixed from
  liked: Record<string, Snap>;
  disliked: Record<string, Snap>;
  later: Record<string, Snap>;
  history: Snap[];
  impressions: Record<string, number>;
  unavailable: Record<string, number>;
  thumbs: "creator" | "frame";
  lastImpressionDay: string;
}

const KEY = "tuberemix:v1";
const HISTORY_CAP = 400;

function initial(): State {
  return {
    v: 1, prefs: defaultPrefs(), hasTube: false, parent: null,
    liked: {}, disliked: {}, later: {}, history: [], impressions: {}, unavailable: {},
    thumbs: "creator", lastImpressionDay: "",
  };
}

function isSnap(x: unknown): x is Snap {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return typeof s.id === "string" && /^[A-Za-z0-9_-]{11}$/.test(s.id) && typeof s.t === "string" && typeof s.c === "string" && Array.isArray(s.k) && typeof s.at === "number";
}

function snapRecord(x: unknown): Record<string, Snap> {
  const out: Record<string, Snap> = {};
  if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) if (isSnap(v) && v.id === k) out[k] = v;
  return out;
}

function numRecord(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) if (/^[A-Za-z0-9_-]{11}$/.test(k) && typeof v === "number") out[k] = v;
  return out;
}

let known: ReadonlySet<string> | null = null;
let state: State = initial();
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = parse(JSON.parse(raw));
  } catch {
    state = initial();
  }
}

function parse(o: unknown): State {
  const s = initial();
  if (!o || typeof o !== "object") return s;
  const r = o as Record<string, unknown>;
  // Topic ids are re-validated against the catalog once the index loads (setKnownTopics).
  s.prefs = sanitizePrefs(r.prefs, known ?? new Set(Object.keys((r.prefs as { topics?: object })?.topics ?? {})));
  s.hasTube = r.hasTube === true;
  s.parent = typeof r.parent === "string" && /^[0-9a-z]{6}$/.test(r.parent) ? r.parent : null;
  s.liked = snapRecord(r.liked);
  s.disliked = snapRecord(r.disliked);
  s.later = snapRecord(r.later);
  s.history = Array.isArray(r.history) ? r.history.filter(isSnap).slice(0, HISTORY_CAP) : [];
  s.impressions = numRecord(r.impressions);
  s.unavailable = numRecord(r.unavailable);
  s.thumbs = r.thumbs === "frame" ? "frame" : "creator";
  s.lastImpressionDay = typeof r.lastImpressionDay === "string" ? r.lastImpressionDay : "";
  return s;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(): void {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the session still works in memory */
    }
  }, 120);
}

function emit(): void {
  for (const l of listeners) l();
}

export function setState(fn: (s: State) => State): void {
  load();
  state = fn(state);
  persist();
  emit();
}

export function getState(): State {
  load();
  return state;
}

export function setKnownTopics(ids: ReadonlySet<string>): void {
  known = ids;
  load();
  const clean = sanitizePrefs(state.prefs, ids);
  if (JSON.stringify(clean) !== JSON.stringify(state.prefs)) setState((s) => ({ ...s, prefs: clean }));
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    try {
      state = e.newValue ? parse(JSON.parse(e.newValue)) : initial();
    } catch {
      state = initial();
    }
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const serverState = initial();
export function useStore(): State {
  return useSyncExternalStore(subscribe, getState, () => serverState);
}

/** True once we are on the client and localStorage has been read. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function snap(v: Pick<VideoLite, "id" | "t" | "c" | "k">): Snap {
  return { id: v.id, t: v.t, c: v.c, k: v.k.slice(0, 3), at: Date.now() };
}

export const actions = {
  setPrefs(prefs: Prefs, opts: { parent?: string | null } = {}) {
    setState((s) => ({ ...s, prefs, hasTube: true, parent: opts.parent === undefined ? s.parent : opts.parent }));
  },
  toggleLike(v: Pick<VideoLite, "id" | "t" | "c" | "k">) {
    setState((s) => {
      const liked = { ...s.liked };
      const disliked = { ...s.disliked };
      if (liked[v.id]) delete liked[v.id];
      else { liked[v.id] = snap(v); delete disliked[v.id]; }
      return { ...s, liked, disliked };
    });
  },
  toggleDislike(v: Pick<VideoLite, "id" | "t" | "c" | "k">) {
    setState((s) => {
      const liked = { ...s.liked };
      const disliked = { ...s.disliked };
      if (disliked[v.id]) delete disliked[v.id];
      else { disliked[v.id] = snap(v); delete liked[v.id]; }
      return { ...s, liked, disliked };
    });
  },
  toggleLater(v: Pick<VideoLite, "id" | "t" | "c" | "k">) {
    setState((s) => {
      const later = { ...s.later };
      if (later[v.id]) delete later[v.id];
      else later[v.id] = snap(v);
      return { ...s, later };
    });
  },
  watched(v: Pick<VideoLite, "id" | "t" | "c" | "k">) {
    setState((s) => ({ ...s, history: [snap(v), ...s.history.filter((h) => h.id !== v.id)].slice(0, HISTORY_CAP) }));
  },
  removeHistory(id: string) {
    setState((s) => ({ ...s, history: s.history.filter((h) => h.id !== id) }));
  },
  clear(list: "liked" | "later" | "history" | "disliked") {
    setState((s) => ({ ...s, [list]: list === "history" ? [] : {} }));
  },
  markUnavailable(id: string) {
    setState((s) => (s.unavailable[id] ? s : { ...s, unavailable: { ...s.unavailable, [id]: Date.now() } }));
  },
  /** Counts a feed impression at most once per day per video, for the first items shown. */
  recordImpressions(ids: string[]) {
    const day = new Date().toISOString().slice(0, 10);
    setState((s) => {
      if (s.lastImpressionDay === day) return s;
      const impressions = { ...s.impressions };
      for (const id of ids) impressions[id] = Math.min(6, (impressions[id] ?? 0) + 1);
      return { ...s, impressions, lastImpressionDay: day };
    });
  },
  setThumbs(thumbs: State["thumbs"]) {
    setState((s) => ({ ...s, thumbs }));
  },
  resetAll() {
    setState(() => initial());
  },
};

export function signalsFrom(s: State): Signals {
  return buildSignals({
    liked: Object.values(s.liked),
    disliked: Object.values(s.disliked),
    watched: s.history.map((h) => h.id),
    unavailable: Object.keys(s.unavailable),
    impressions: Object.entries(s.impressions),
  });
}
