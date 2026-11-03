"use client";
import { Bookmark, BookmarkCheck, ThumbsUp } from "lucide-react";
import type { Reason } from "@/core/rank";
import type { VideoLite } from "@/core/types";
import { actions, useStore } from "@/lib/store";
import { Thumb } from "./Thumb";

export function VideoCard({
  video, reasons, rank, onOpen, priority, active, showActions = true,
}: {
  video: VideoLite;
  reasons?: Reason[];
  rank?: number;
  onOpen: (v: VideoLite) => void;
  priority?: boolean;
  active?: boolean;
  showActions?: boolean;
}) {
  const s = useStore();
  const liked = !!s.liked[video.id];
  const later = !!s.later[video.id];
  const reason = reasons?.[0]?.text;
  const crowd = video.r > 0 ? `${video.r} recommender${video.r === 1 ? "" : "s"}` : "";
  return (
    <article
      data-card={video.id}
      className={`group relative min-w-0 rounded-[4px] ${active ? "ring-2 ring-ink ring-offset-4 ring-offset-paper" : ""}`}
    >
      <button
        type="button"
        onClick={() => onOpen(video)}
        className="block w-full text-left"
        aria-label={`Play ${video.t} by ${video.c}`}
      >
        <div className="relative">
          <Thumb id={video.id} title={video.t} channel={video.c} style={s.thumbs} priority={priority} />
          {rank !== undefined && (
            <span aria-hidden className="absolute left-0 top-0 rounded-br-[3px] bg-paper px-1.5 py-0.5 font-mono text-[0.6875rem] tabular-nums text-ink">
              {String(rank).padStart(2, "0")}
            </span>
          )}
        </div>
        <h3 className="mt-2.5 line-clamp-2 text-[0.9375rem] font-semibold leading-[1.28] tracking-[-0.01em] text-ink" title={video.t}>
          {video.t}
        </h3>
      </button>
      <div className="mt-1 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="meta truncate">{video.c}</p>
          {(crowd || reason) && (
            <p className="mt-1 line-clamp-1 text-[0.7812rem] leading-snug text-ink-2">
              {crowd && <span className="font-medium text-ink">{crowd}</span>}
              {crowd && reason ? " · " : ""}
              {reason}
            </p>
          )}
        </div>
        {showActions && (
          <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <button
              type="button"
              onClick={() => actions.toggleLater(video)}
              aria-pressed={later}
              aria-label={later ? "Remove from Watch later" : "Save to Watch later"}
              title={later ? "Saved to Watch later" : "Watch later (w)"}
              className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-paper-2 md:h-8 md:w-8"
            >
              {later ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            </button>
            <button
              type="button"
              onClick={() => actions.toggleLike(video)}
              aria-pressed={liked}
              aria-label={liked ? "Unlike" : "Like"}
              title={liked ? "Liked" : "Like (l)"}
              className={`grid h-10 w-10 place-items-center rounded-full hover:bg-paper-2 md:h-8 md:w-8 ${liked ? "text-ink" : "text-ink-2"}`}
            >
              <ThumbsUp size={16} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function CardSkeleton({ n = 8 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} aria-hidden className="min-w-0">
          <div className="skeleton aspect-video w-full rounded-[3px]" />
          <div className="skeleton mt-3 h-3.5 w-11/12 rounded" />
          <div className="skeleton mt-2 h-3.5 w-7/12 rounded" />
          <div className="skeleton mt-2.5 h-2.5 w-5/12 rounded" />
        </div>
      ))}
    </>
  );
}
