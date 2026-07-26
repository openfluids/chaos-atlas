'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the user has requested reduced motion via the OS/browser preference
 * (`prefers-reduced-motion: reduce`).
 *
 * SSR-safe: returns `false` during SSR and the first client render — no
 * `window` access during render — then syncs from `matchMedia` in an effect
 * and live-updates via `addEventListener('change', …)`.
 *
 * This flag is a suppress-autoplay signal only. Callers must never use it to
 * refuse a user-initiated play; removing voluntary control in the name of
 * accessibility is its own failure.
 *
 * `theme-provider.tsx` already subscribes to the same media query (and
 * discards the value); this hook exposes it for playback and other UI.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // The one setState-in-effect that cannot be derived during render: the
    // media-query result is only knowable on the client after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return reduced;
}
