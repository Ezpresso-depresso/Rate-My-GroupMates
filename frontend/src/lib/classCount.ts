/*
 * How many classes are on your profile, shared between the navbar (which nudges you to add some
 * while it's 0) and the profile page (which updates it the moment you add or drop one).
 * Re-checked on every page change too, since joining or creating a group can add a class.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { classCountChanged } from './tour';

/** null until the first check comes back. */
let count: number | null = null;
const listeners = new Set<() => void>();

export function setClassCount(next: number) {
  classCountChanged(next);
  if (next === count) return;
  count = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The last known class count (0 if not known yet). */
export const currentClassCount = () => count ?? 0;

/** Your class count, kept fresh. `userId` resets it when a different account signs in. */
export function useClassCount(userId: string): number | null {
  const { pathname } = useLocation();

  useEffect(() => {
    count = null; // a new account (or first load): don't show the last account's answer
    listeners.forEach((l) => l());
  }, [userId]);

  useEffect(() => {
    let current = true;
    api
      .getClasses()
      .then((classes) => current && setClassCount(classes.length))
      .catch(() => {
        /* offline / signed out: keep whatever we knew; no nudge is better than a wrong one */
      });
    return () => {
      current = false;
    };
  }, [userId, pathname]);

  return useSyncExternalStore(subscribe, () => count);
}
