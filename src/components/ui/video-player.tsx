"use client";

import { useState } from "react";
import type { VideoSource } from "@/lib/video";
import { Icon } from "@/components/ui/icons";

/**
 * 16:9 click-to-play player. Nothing third-party loads until the visitor presses play (faster page, no tracking
 * before consent). YouTube/Vimeo use an iframe; direct files use the native <video> controls.
 */
export function VideoPlayer({ source, title }: { source: VideoSource | null; title: string }) {
  const [playing, setPlaying] = useState(false);
  const frame = "relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] bg-forest-900";

  if (!source) {
    return (
      <div className={`${frame} bg-brand-glow grid place-items-center text-center text-white`}>
        <div className="px-6">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-white/30 bg-white/10 text-gold-300">
            <Icon name="play" size={26} />
          </span>
          <p className="mt-3 text-sm font-semibold text-white/80">Video coming soon</p>
        </div>
      </div>
    );
  }

  if (playing) {
    return (
      <div className={frame}>
        {source.kind === "file" ? (
          <video src={source.src} controls autoPlay playsInline preload="metadata" className="absolute inset-0 size-full bg-black object-contain" aria-label={title} />
        ) : (
          <iframe
            src={source.embedUrl}
            title={title}
            className="absolute inset-0 size-full border-0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`} className={`${frame} group block cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300`}>
      {source.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote YouTube poster, loaded lazily
        <img src={source.thumbnail} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <span className="bg-brand-glow absolute inset-0" aria-hidden="true" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-black/10" aria-hidden="true" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-16 place-items-center rounded-full bg-gold-300 pl-1 text-forest-900 shadow-lg transition-transform duration-300 group-hover:scale-110 md:size-20">
          <Icon name="play" size={30} />
        </span>
      </span>
    </button>
  );
}
