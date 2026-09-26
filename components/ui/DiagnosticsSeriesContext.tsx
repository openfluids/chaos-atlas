'use client';

import React, { createContext, useContext, useState, useSyncExternalStore } from 'react';

type Listener = () => void;

interface SeriesStore {
  get: () => readonly number[] | null;
  publish: (series: ArrayLike<number> | null) => void;
  subscribe: (listener: Listener) => () => void;
}

function seriesEqual(a: number[] | null, b: number[] | null): boolean {
  if (a === b) return true;
  if (a == null || b == null || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function createStore(): SeriesStore {
  let current: number[] | null = null;
  const listeners = new Set<Listener>();
  return {
    get: () => current,
    publish(series) {
      const next = series == null ? null : Array.from(series, (v) => Number(v));
      if (seriesEqual(current, next)) return;
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const DiagnosticsSeriesContext = createContext<SeriesStore | null>(null);

const publishNothing = (_series: ArrayLike<number> | null): void => {};

/**
 * One store per map page. Visualizations publish the x_n they already
 * computed for drawing; the panel subscribes. No second simulation.
 */
export function DiagnosticsSeriesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [store] = useState(createStore);
  return (
    <DiagnosticsSeriesContext.Provider value={store}>
      {children}
    </DiagnosticsSeriesContext.Provider>
  );
}

/** Stable publisher. No-op outside a provider (unit tests that omit the shell). */
export function usePublishDrawnSeries(): (series: ArrayLike<number> | null) => void {
  const store = useContext(DiagnosticsSeriesContext);
  return store ? store.publish : publishNothing;
}

export function useDrawnSeries(): readonly number[] | null {
  const store = useContext(DiagnosticsSeriesContext);
  return useSyncExternalStore(
    store ? store.subscribe : subscribeNothing,
    store ? store.get : getNothing,
    getNothing,
  );
}

function subscribeNothing(): () => void {
  return () => {};
}

function getNothing(): null {
  return null;
}
