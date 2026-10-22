"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay, Keyboard } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import { Icon } from "@/components/ui/icons";

const ctrl =
  "grid size-12 place-items-center rounded-full border-2 border-forest-900 text-forest-900 transition hover:bg-forest-900 hover:text-white focus-visible:outline-offset-2";

/**
 * The site's one carousel. Autoplays (paused on hover/focus, honours reduced motion, user can pause),
 * rewinds at the end, has Previous/Next arrows and touch swipe, and hides its controls when everything fits.
 */
export function Slider({
  items,
  label,
  cols = { sm: 2, lg: 3 },
  delay = 4500,
}: {
  items: ReactNode[];
  label: string;
  cols?: { sm: number; lg: number };
  delay?: number;
}) {
  const swiperRef = useRef<SwiperType | null>(null);
  const [locked, setLocked] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) {
        swiperRef.current?.autoplay?.stop();
        setPlaying(false);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const toggle = () => {
    const s = swiperRef.current;
    if (!s) return;
    if (playing) s.autoplay.stop();
    else s.autoplay.start();
    setPlaying(!playing);
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={`${label} slides`}
      onFocusCapture={() => playing && swiperRef.current?.autoplay?.pause()}
      onBlurCapture={() => playing && swiperRef.current?.autoplay?.resume()}
    >
      <Swiper
        modules={[A11y, Autoplay, Keyboard]}
        onSwiper={(s) => {
          swiperRef.current = s;
          setLocked(s.isLocked);
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) s.autoplay?.stop();
        }}
        onLock={() => setLocked(true)}
        onUnlock={() => setLocked(false)}
        autoplay={{ delay, disableOnInteraction: false, pauseOnMouseEnter: true }}
        rewind
        speed={600}
        spaceBetween={20}
        slidesPerView={1.12}
        breakpoints={{ 640: { slidesPerView: cols.sm }, 1024: { slidesPerView: cols.lg } }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{ slideLabelMessage: "{{index}} of {{slidesLength}}", prevSlideMessage: "Previous", nextSlideMessage: "Next" }}
        watchOverflow
        className="!overflow-hidden"
      >
        {items.map((item, i) => (
          <SwiperSlide key={i} className="!h-auto">
            {item}
          </SwiperSlide>
        ))}
      </Swiper>
      {!locked && (
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" className={ctrl} aria-label={`Previous ${label} slide`} onClick={() => swiperRef.current?.slidePrev()}>
            <Icon name="arrow-right" className="rotate-180" />
          </button>
          {!reduced && (
            <button type="button" className={ctrl} aria-label={playing ? `Pause ${label} autoplay` : `Start ${label} autoplay`} aria-pressed={!playing} onClick={toggle}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5v14l11-7z" />}
              </svg>
            </button>
          )}
          <button type="button" className={ctrl} aria-label={`Next ${label} slide`} onClick={() => swiperRef.current?.slideNext()}>
            <Icon name="arrow-right" />
          </button>
        </div>
      )}
    </div>
  );
}
