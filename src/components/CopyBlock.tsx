"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { track } from "@/lib/analytics";

export function CopyBlock({ code, label, lang, trackKind }: { code: string; label?: string; lang?: string; trackKind?: "prompt" }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mt-3 overflow-hidden rounded-[4px] border border-hair bg-card">
      <div className="flex items-center justify-between border-b border-hair px-3 py-1.5">
        <span className="meta">{label ?? lang ?? "code"}</span>
        <button
          type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* ignore */ }
            if (trackKind) track("export", { kind: trackKind });
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium hover:bg-paper-2"
        >
          {ok ? <Check size={13} /> : <Copy size={13} />} {ok ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-ink-2"><code>{code}</code></pre>
    </div>
  );
}
