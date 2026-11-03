import Link from "next/link";

export function Wordmark({ href = "/", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "text-[28px]" : "text-[22px]";
  return (
    <Link href={href} aria-label="TubeRemix home" className={`group inline-flex items-baseline gap-0 leading-none ${cls}`}>
      <span className="font-serif italic tracking-[-0.01em]">Tube</span>
      <span className="font-sans font-semibold tracking-[-0.04em]">
        <span className="marked">Remix</span>
      </span>
    </Link>
  );
}
