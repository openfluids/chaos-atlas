'use client';

import React, {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react';

/**
 * One animatable slider axis in the playback registry.
 *
 * Values are read/written through `getValue` / `setValue` so the registry
 * never stores the numeric value in React state — a registry that re-rendered
 * every consumer on every value change would fight the animation it drives.
 */
export type AnimatableParam = {
  /** Stable key for this param (unique within a provider). */
  name: string;
  label: React.ReactNode;
  min: number;
  max: number;
  step: number;
  getValue: () => number;
  setValue: (value: number) => void;
};

/** Clamp a selection index into `[0, count)`. Empty registry → 0. */
export function clampSelectedIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), count - 1);
}

export type PlaybackRegistry = {
  /** Register a param. Notifies membership subscribers (mount). */
  register: (param: AnimatableParam) => void;
  /** Remove a param. Notifies membership subscribers (unmount). */
  deregister: (name: string) => void;
  /** Read one entry from the ref-backed map (no subscription). */
  getParam: (name: string) => AnimatableParam | undefined;
  /** Snapshot of all registered params in registration order. */
  getParams: () => AnimatableParam[];
  /**
   * Subscribe to mount/unmount membership changes only.
   * Value updates never fire this. Returns an unsubscribe function.
   */
  subscribe: (listener: () => void) => () => void;
  /**
   * Bumps only when a param mounts or unmounts. Read after a subscription
   * re-render; never put this on a React state that is in the context value
   * (that would change the context identity and re-run self-register effects).
   */
  readonly version: number;
  /**
   * Raw selected index (may be past the end until a reader clamps).
   * Selection is membership-like: rare, own subscription — not the value path.
   */
  getSelectedIndex: () => number;
  /** Store a raw selection index; notifies selection subscribers when it changes. */
  setSelectedIndex: (index: number) => void;
  /**
   * Clamped selected param, or undefined when the registry is empty.
   * Does not subscribe — pair with `subscribeSelection` / `usePlaybackSelection`.
   */
  getSelectedParam: () => AnimatableParam | undefined;
  /** Subscribe to selection-index changes only (not value, not membership). */
  subscribeSelection: (listener: () => void) => () => void;
  /** Bumps when the selected index is written to a new value. */
  readonly selectionVersion: number;
};

type Store = {
  map: Map<string, AnimatableParam>;
  order: string[];
  version: number;
  listeners: Set<() => void>;
  selectedIndex: number;
  selectionVersion: number;
  selectionListeners: Set<() => void>;
};

const PlaybackContext = createContext<PlaybackRegistry | null>(null);

function createRegistry(store: Store): PlaybackRegistry {
  const emitMembership = () => {
    store.version += 1;
    store.listeners.forEach((listener) => listener());
  };

  const emitSelection = () => {
    store.selectionVersion += 1;
    store.selectionListeners.forEach((listener) => listener());
  };

  return {
    register(param: AnimatableParam) {
      const isNew = !store.map.has(param.name);
      store.map.set(param.name, param);
      if (isNew) {
        store.order.push(param.name);
        emitMembership();
      }
    },
    deregister(name: string) {
      if (!store.map.delete(name)) return;
      store.order = store.order.filter((n) => n !== name);
      emitMembership();
    },
    getParam(name: string) {
      return store.map.get(name);
    },
    getParams() {
      return store.order
        .map((name) => store.map.get(name))
        .filter((p): p is AnimatableParam => p !== undefined);
    },
    subscribe(listener: () => void) {
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    get version() {
      return store.version;
    },
    getSelectedIndex() {
      return store.selectedIndex;
    },
    setSelectedIndex(index: number) {
      const next = Number.isFinite(index) ? Math.trunc(index) : 0;
      if (next === store.selectedIndex) return;
      store.selectedIndex = next;
      emitSelection();
    },
    getSelectedParam() {
      const params = store.order
        .map((name) => store.map.get(name))
        .filter((p): p is AnimatableParam => p !== undefined);
      if (params.length === 0) return undefined;
      const idx = clampSelectedIndex(store.selectedIndex, params.length);
      return params[idx];
    },
    subscribeSelection(listener: () => void) {
      store.selectionListeners.add(listener);
      return () => {
        store.selectionListeners.delete(listener);
      };
    },
    get selectionVersion() {
      return store.selectionVersion;
    },
  };
}

/**
 * Holds the animatable-param registry for a map page subtree.
 *
 * Registry entries live in a ref-backed `Map`. The context value identity is
 * stable for the provider lifetime so self-registering controls (`ParamSlider`)
 * do not re-run their mount effects when membership changes. Registering or
 * updating a param's current value does not re-render consumers — only
 * mount/unmount notifies `subscribe` listeners (and `usePlaybackRegistry`
 * via `useSyncExternalStore`). Selection has its own subscription: rare
 * membership-like changes must not ride the per-frame value path.
 */
export function PlaybackProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  // Lazy one-time init keeps the API object identity stable without reading
  // a ref during render (react-hooks/refs).
  const [api] = useState(() =>
    createRegistry({
      map: new Map(),
      order: [],
      version: 0,
      listeners: new Set(),
      selectedIndex: 0,
      selectionVersion: 0,
      selectionListeners: new Set(),
    }),
  );

  return (
    <PlaybackContext.Provider value={api}>{children}</PlaybackContext.Provider>
  );
}

/**
 * Access the playback registry. Must be used under a `PlaybackProvider`.
 * Re-renders when a param mounts or unmounts; not when values change.
 */
export function usePlaybackRegistry(): PlaybackRegistry {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error(
      'usePlaybackRegistry must be used within a PlaybackProvider',
    );
  }
  // Membership-only subscription: snapshot is the version counter.
  useSyncExternalStore(ctx.subscribe, () => ctx.version, () => 0);
  return ctx;
}

/**
 * Optional registry access for controls that self-register when a provider
 * is present and no-op when it is not (e.g. `ParamSlider` before playback
 * is mounted in `MapPageLayout`).
 *
 * Does NOT subscribe to membership — identity is stable, so register effects
 * do not loop.
 */
export function usePlaybackRegistryOptional(): PlaybackRegistry | null {
  return useContext(PlaybackContext);
}

/**
 * Selected playback param (clamped). Re-renders on selection or membership
 * changes; never on value updates. Must be used under a `PlaybackProvider`.
 */
export function usePlaybackSelectedParam(): AnimatableParam | undefined {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error(
      'usePlaybackSelectedParam must be used within a PlaybackProvider',
    );
  }
  useSyncExternalStore(ctx.subscribe, () => ctx.version, () => 0);
  useSyncExternalStore(
    ctx.subscribeSelection,
    () => ctx.selectionVersion,
    () => 0,
  );
  return ctx.getSelectedParam();
}

/**
 * Raw selected index + writer. Re-renders on selection changes only (not
 * membership, not values). Pair with `usePlaybackRegistry` when the param
 * list is also needed.
 */
export function usePlaybackSelection(): {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
} {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error(
      'usePlaybackSelection must be used within a PlaybackProvider',
    );
  }
  useSyncExternalStore(
    ctx.subscribeSelection,
    () => ctx.selectionVersion,
    () => 0,
  );
  return {
    selectedIndex: ctx.getSelectedIndex(),
    setSelectedIndex: ctx.setSelectedIndex,
  };
}
