'use client';

import React, { createContext, useContext, useState, useSyncExternalStore } from 'react';

type Listener = () => void;

export interface DrawnSeries {
  /** x_n the current view draws, or null when that view draws no single series. */
  series: readonly number[] | null;
  /** Select label of the view that published, shown beside N. */
  view: string;
}

interface SeriesStore {
  get: () => DrawnSeries;
  publish: (series: ArrayLike<number> | null, view: string) => void;
  subscribe: (listener: Listener) => () => void;
}

const EMPTY: DrawnSeries = { series: null, view: '' };

function seriesEqual(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === b) return true;
  if (a == null || b == null || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function createStore(): SeriesStore {
  let current: DrawnSeries = EMPTY;
  const listeners = new Set<Listener>();
  return {
    get: () => current,
    publish(series, view) {
      const nextSeries =
        series == null || series.length === 0
          ? null
          : Array.from(series, (v) => Number(v));
      if (seriesEqual(current.series, nextSeries) && current.view === view) return;
      current = { series: nextSeries, view };
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

const publishNothing = (_series: ArrayLike<number> | null, _view: string): void => {};

/**
 * One store per map page. Visualizations publish the x_n they already
 * computed for drawing, or null when the view draws no single series.
 * The panel subscribes. No second simulation.
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
export function usePublishDrawnSeries(): (series: ArrayLike<number> | null, view: string) => void {
  const store = useContext(DiagnosticsSeriesContext);
  return store ? store.publish : publishNothing;
}

export function useDrawnSeries(): DrawnSeries {
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

function getNothing(): DrawnSeries {
  return EMPTY;
}
