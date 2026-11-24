'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnimationItem } from 'lottie-web';
import { CircleAlert, CircleCheck, Inbox, LoaderCircle } from './glyphs';

const feedbackGlyphs = { success: CircleCheck, error: CircleAlert, empty: Inbox, loading: LoaderCircle };
type FeedbackKind = keyof typeof feedbackGlyphs;

export function FeedbackIcon({ kind }: { kind: FeedbackKind }) {
  const container = useRef<HTMLSpanElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const Fallback = feedbackGlyphs[kind];

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation: AnimationItem | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;

    function stop() {
      generation += 1;
      clearTimeout(timer);
      animation?.destroy();
      animation = undefined;
    }

    function update() {
      stop();
      setIsPlaying(false);
      if (preference.matches) return;
      const current = generation;
      timer = setTimeout(() => {
        void import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
          if (generation !== current) return;
          animation = lottie.loadAnimation({
            container: element!, renderer: 'svg', loop: false, autoplay: true,
            path: `/assets/animations/${kind}.json`,
          });
          animation.addEventListener('DOMLoaded', () => {
            if (generation === current) setIsPlaying(true);
          });
          animation.addEventListener('data_failed', () => {
            if (generation === current) setIsPlaying(false);
          });
        }).catch(() => { /* Keep the static icon if the optional player fails. */ });
      }, kind === 'loading' ? 250 : 0);
    }

    update();
    preference.addEventListener('change', update);
    return () => {
      preference.removeEventListener('change', update);
      stop();
    };
  }, [kind]);

  return <span aria-hidden="true" className={`app-feedback-icon app-feedback-${kind}`}>
    <Fallback className="app-feedback-fallback" strokeWidth={1.75} style={{ visibility: isPlaying ? 'hidden' : 'visible' }} />
    <span className="app-feedback-player" ref={container} style={{ visibility: isPlaying ? 'visible' : 'hidden' }} />
  </span>;
}
