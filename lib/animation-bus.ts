/**
 * Lightweight pub/sub used to chain animations across blocks and text reveals.
 *
 * Each animatable element claims a stable token (e.g. `block:<id>` or `text:<contentKey>`)
 * and emits `markComplete(token)` when its entrance animation finishes. Other elements
 * configured with `trigger: { kind: 'after', after: <token> }` listen via `useAnimationGate`
 * and stay idle until that token has been marked complete.
 *
 * State is kept in module scope so cross-component listeners work without prop drilling.
 * It resets when the editor remounts the page (since this module re-evaluates per page).
 */

'use client';

import { useSyncExternalStore } from 'react';

const completed = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

export function markComplete(token: string): void {
  if (!token || completed.has(token)) return;
  completed.add(token);
  const subs = listeners.get(token);
  if (subs) {
    for (const cb of Array.from(subs)) {
      try { cb(); } catch { /* ignore */ }
    }
  }
}

export function isComplete(token: string): boolean {
  return completed.has(token);
}

export function subscribe(token: string, cb: () => void): () => void {
  let subs = listeners.get(token);
  if (!subs) {
    subs = new Set();
    listeners.set(token, subs);
  }
  subs.add(cb);
  return () => {
    subs?.delete(cb);
    if (subs && subs.size === 0) listeners.delete(token);
  };
}

/** Test/preview helper — clears all completion state. */
export function resetAnimationBus(): void {
  completed.clear();
  listeners.clear();
}

const NOOP_UNSUBSCRIBE = () => {};

/**
 * Returns true once the given token has fired. If `token` is undefined or empty,
 * returns true immediately (i.e. no gate).
 */
export function useAnimationGate(token: string | undefined | null): boolean {
  const subscribeFn = (cb: () => void) => {
    if (!token) return NOOP_UNSUBSCRIBE;
    return subscribe(token, cb);
  };
  const getSnapshot = () => !token || isComplete(token);
  // SSR: render as if gate is open; the client will re-subscribe and gate naturally.
  const getServerSnapshot = () => true;
  return useSyncExternalStore(subscribeFn, getSnapshot, getServerSnapshot);
}
