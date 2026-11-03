"use client";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

/** Code with a copy button. `{{ORIGIN}}` in the code is replaced with the site you're on. */
export function CopyBlock({ code, label, lang, trackKind, fallbackOrigin = "" }: { code: string; label?: string; lang?: string; trackKind?: "prompt"; fallbackOrigin?: string }) {
  const [ok, setOk] = useState(false);
  const [origin, setOrigin] = useState(fallbackOrigin);
  useEffect(() => setOrigin(window.location.origin), []);
  const text = code.split("{{ORIGIN}}").join(origin);
  const name = label ?? lang ?? "code";
  return (
    <div className="mt-3 overflow-hidden rounded-[4px] border border-hair bg-card">
      <div className="flex items-center justify-between border-b border-hair px-3 py-1.5">
        <span className="meta">{name}</span>
        <button
          type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* ignore */ }
            if (trackKind) track("export", { kind: trackKind });
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.7812rem] font-medium hover:bg-paper-2"
        >
          {ok ? <Check size={13} /> : <Copy size={13} />} {ok ? "Copied" : "Copy"}
        </button>
      </div>
      <pre tabIndex={0} aria-label={name} className="overflow-x-auto p-3 font-mono text-[0.7812rem] leading-relaxed text-ink-2"><code>{text}</code></pre>
    </div>
  );
}
