"use client";

import Image from "next/image";
import { useState } from "react";
import type { BannerImageData } from "@/lib/banner";

/** Right-hand banner picture. If the chosen image fails to load it swaps to the bundled photo, never a broken icon. */
export function BannerImage({ image, priority = true }: { image: BannerImageData; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? image.fallbackSrc : image.src;
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-panel)] border border-white/15 bg-forest-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] lg:aspect-auto lg:h-[clamp(20rem,60svh,40rem)]">
      <Image
        key={src}
        src={src}
        alt={image.alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 40vw, (min-width: 640px) 80vw, 100vw"
        className="object-cover"
        onError={() => setFailed(true)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-forest-950/30 via-transparent to-transparent" aria-hidden="true" />
    </div>
  );
}
