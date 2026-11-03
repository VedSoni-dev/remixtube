"use client";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { MAX_TOPICS, type TopicWeight } from "@/core/prefs";
import type { DataIndex } from "@/core/types";

export const WEIGHT_LABEL: Record<TopicWeight, string> = { 1: "Curious", 2: "Into it", 3: "Obsessed" };

export function TopicPicker({ index, value, onChange, compact = false }: {
  index: DataIndex;
  value: Record<string, TopicWeight>;
  onChange: (next: Record<string, TopicWeight>) => void;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const count = Object.keys(value).length;
  const toggle = (id: string) => {
    const next = { ...value };
    if (next[id]) delete next[id];
    else if (count < MAX_TOPICS) next[id] = 2;
    onChange(next);
  };
  const needle = q.trim().toLowerCase();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter topics"
          aria-label="Filter topics"
          className="h-10 w-full max-w-xs rounded-full border border-hair bg-card px-4 text-[14px] outline-none focus:border-ink"
        />
        <span className="meta">{count} / {MAX_TOPICS} picked</span>
      </div>
      <div className={`mt-5 space-y-6 ${compact ? "max-h-[50vh] overflow-y-auto pr-1" : ""}`}>
        {index.areas.map((a) => {
          const ts = index.topics.filter((t) => t.area === a.id && t.chip && (!needle || t.name.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle)));
          if (!ts.length) return null;
          return (
            <div key={a.id}>
              <p className="meta mb-2">{a.name}</p>
              <div className="flex flex-wrap gap-2">
                {ts.map((t) => {
                  const on = !!value[t.id];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      aria-pressed={on}
                      title={t.description}
                      disabled={!on && count >= MAX_TOPICS}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors disabled:opacity-40 ${on ? "border-ink bg-ink text-paper" : "border-hair bg-card hover:border-ink/40"}`}
                    >
                      {on ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden className="text-muted" />}
                      {t.name}
                      <span className={`font-mono text-[10.5px] tabular-nums ${on ? "text-paper/70" : "text-muted"}`}>{t.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
