'use client';

import { useEffect, useState } from 'react';

/**
 * True once the client has hydrated, false during SSR and the first render.
 *
 * Use it to gate values that cannot be guaranteed identical between the
 * prerender and the browser. That is not hypothetical here: `Math.sin` and
 * `Math.cos` are only specified to within an implementation-defined error, so
 * different V8 builds — Node at build time, Chromium at runtime — can disagree
 * in the last unit in the last place. Iterating a chaotic map amplifies that
 * difference exponentially, and a Lyapunov exponent computed over 2000
 * iterations of the Ikeda map came out as 0.6258 on the server and 0.6217 in
 * the browser, which React reports as hydration error #418.
 *
 * Sensitive dependence on initial conditions is the subject of this project, so
 * the correct move is to keep such quantities off the server rather than try to
 * make two engines agree bit for bit.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  // The one setState-in-effect that cannot be derived during render: whether
  // hydration has happened is knowable only after an effect runs. Empty
  // dependency array, so it fires once and cannot cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);

  return hydrated;
}
