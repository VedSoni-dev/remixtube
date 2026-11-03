"use client";
import { useState } from "react";
import { thumbUrl } from "@/core/catalog";

/**
 * YouTube thumbnail with an honest fallback. A removed video's thumbnail comes back as a
 * 404 or a 120px grey placeholder; either way we show a typographic card instead.
 */
export function Thumb({
  id, title, channel, style = "creator", priority = false, onMissing, className = "",
}: {
  id: string;
  title: string;
  channel: string;
  style?: "creator" | "frame";
  priority?: boolean;
  onMissing?: (id: string) => void;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);
  const fail = () => {
    if (!missing) {
      setMissing(true);
      onMissing?.(id);
    }
  };
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-[3px] bg-paper-2 ${className}`}>
      {missing ? (
        <div className="absolute inset-0 flex flex-col justify-between border border-hair bg-card p-3">
          <span className="meta">No thumbnail</span>
          <span className="line-clamp-3 font-serif text-[1.1875rem] leading-[1.1] text-ink-2">{title}</span>
          <span className="meta truncate">{channel}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl(id, style, "hq")}
          srcSet={`${thumbUrl(id, style, "mq")} 320w, ${thumbUrl(id, style, "hq")} 480w`}
          sizes="(min-width: 1400px) 22vw, (min-width: 768px) 30vw, (min-width: 480px) 48vw, 92vw"
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
          onError={fail}
          onLoad={(e) => { if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 120) fail(); }}
        />
      )}
    </div>
  );
}
