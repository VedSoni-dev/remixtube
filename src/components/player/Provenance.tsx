"use client";
import { ExternalLink, MessageSquareQuote } from "lucide-react";
import { hnItemUrl } from "@/core/catalog";
import type { Mention, Stance, VideoDetail } from "@/core/types";

const STANCE: Record<Stance, { label: string; cls: string }> = {
  strong_rec: { label: "Strong rec", cls: "bg-ink text-paper" },
  rec: { label: "Recommends", cls: "bg-paper-2 text-ink" },
  reference: { label: "Cites it", cls: "border border-hair text-muted" },
  critical: { label: "Pushback", cls: "border border-bad/40 text-bad" },
  joke: { label: "Joke", cls: "border border-hair text-muted" },
};

function month(mo: string): string {
  const [y, m] = mo.split("-").map(Number);
  if (!y || !m) return mo;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Renders the comment excerpt, turning the [VIDEO]/[LINK] placeholders into quiet badges. */
function Excerpt({ text }: { text: string }) {
  const parts = text.split(/(\[VIDEO\]|\[LINK\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p === "[VIDEO]" ? <span key={i} className="mx-0.5 rounded-[2px] bg-marker px-1 font-mono text-[0.6562rem] text-marker-ink">this video</span>
        : p === "[LINK]" ? <span key={i} className="mx-0.5 rounded-[2px] border border-hair px-1 font-mono text-[0.6562rem] text-muted">link</span>
        : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function MentionItem({ m }: { m: Mention }) {
  const st = STANCE[m.st];
  return (
    <li className="border-t border-hair py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${st.cls}`}>{st.label}</span>
        {m.w && <span className="text-[0.8125rem] text-ink-2">{m.w}</span>}
      </div>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">
        <Excerpt text={m.x} />
      </p>
      <a
        href={hnItemUrl(m.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex flex-wrap items-center gap-x-1.5 text-[0.7812rem] text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        <span className="font-medium text-ink-2">{m.a}</span>
        <span>· {month(m.mo)}</span>
        {m.story && <span className="line-clamp-1">· in “{m.story}”</span>}
        <ExternalLink size={12} aria-hidden />
        <span className="sr-only">(opens the comment on Hacker News)</span>
      </a>
    </li>
  );
}

export function Provenance({ id, detail }: { id: string; detail: VideoDetail }) {
  const v = detail.v;
  const recs = detail.mentions.filter((m) => m.st === "rec" || m.st === "strong_rec");
  const others = detail.mentions.filter((m) => m.st !== "rec" && m.st !== "strong_rec");
  const cut = detail.mentions.some((m) => m.cut);
  return (
    <section aria-labelledby={`prov-${id}`} className="mt-8">
      <div className="flex items-center gap-2">
        <MessageSquareQuote size={18} aria-hidden />
        <h3 id={`prov-${id}`} className="font-serif text-[1.625rem] leading-none">Recommended by the HN community</h3>
      </div>
      <p className="mt-2 text-[0.8438rem] text-muted">
        {v.r} {v.r === 1 ? "person" : "different people"} recommended this on Hacker News
        {v.sr > 0 && <>, {v.sr} of them enthusiastically</>}. It came up in comments from {v.y0 === v.y1 ? v.y0 : `${v.y0} to ${v.y1}`}.
      </p>
      {(detail.why || detail.sum) && (
        <div className="mt-4 rounded-[4px] border border-hair bg-card p-4">
          {detail.why && <p className="text-[0.9375rem] leading-relaxed text-ink"><span className="font-semibold">Why HN likes it. </span>{detail.why}</p>}
          {detail.sum && <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">{detail.sum}</p>}
          <p className="mt-3 font-mono text-[0.6875rem] text-muted">Summary written by Claude for HackerTube from these comments.</p>
        </div>
      )}
      {recs.length > 0 && (
        <details className="group mt-4" open>
          <summary className="cursor-pointer list-none text-[0.875rem] font-semibold underline-offset-4 hover:underline">
            See why people recommended this <span className="text-muted group-open:hidden">({recs.length})</span>
          </summary>
          <ol className="mt-2">{recs.map((m) => <MentionItem key={m.id} m={m} />)}</ol>
        </details>
      )}
      {others.length > 0 && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-[0.875rem] font-semibold underline-offset-4 hover:underline">
            Other mentions: citations, pushback, jokes <span className="text-muted">({others.length})</span>
          </summary>
          <ol className="mt-2">{others.map((m) => <MentionItem key={m.id} m={m} />)}</ol>
        </details>
      )}
      <p className="mt-3 text-[0.7812rem] text-muted">
        Excerpts of the original comments{cut ? "; long ones are shortened (…), the link opens the full comment" : ""}.{" "}
        {detail.more > 0 ? `${detail.more} more labeled comment${detail.more === 1 ? "" : "s"} in the HackerTube data. ` : ""}
        <a className="underline underline-offset-2 hover:text-ink" href={`https://hn.algolia.com/?type=comment&query=${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer">
          Search every HN comment that links it
        </a>
        .
      </p>
    </section>
  );
}
