/*
 * The help tour: popups that walk a new account through adding a class, searching for groupmates
 * and making a group. Starts on sign-up or from Help in the account menu. Kept in localStorage so
 * it survives a refresh, and tied to the account that started it.
 *
 * Steps: 'classes' (add a class; the profile-customising note shows alongside until closed),
 * then 'search' (make a search), then 'group' (click + New group), then done.
 */
import { useSyncExternalStore } from 'react';
import { useAuth } from '../hooks/useAuth';
import { readStorage, writeStorage } from './storage';

export type TourStep = 'classes' | 'search' | 'group';
interface Tour {
  userId: string;
  step: TourStep | null;
  noteOpen: boolean;
  /** Classes on the profile when the tour started; having more finishes the 'classes' step. */
  classes: number;
}

const KEY = 'rmg-tour';
const OFF: Tour = { userId: '', step: null, noteOpen: false, classes: 0 };
let tour: Tour = readStorage(KEY, OFF);
const listeners = new Set<() => void>();

function set(next: Tour) {
  tour = next;
  writeStorage(KEY, next.step ? next : undefined);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startTour(userId: string, classes: number) {
  set({ userId, step: 'classes', noteOpen: true, classes });
}

/** Called with every new class count: gaining a class (added, or from joining a group) finishes step 1. */
export function classCountChanged(classes: number) {
  if (classes > tour.classes) advanceTour('classes', 'search');
}

/** Move on from `from` (ignored if the tour isn't on that step). `null` ends the tour. */
export function advanceTour(from: TourStep, to: TourStep | null) {
  if (tour.step === from) set(to ? { ...tour, step: to } : OFF);
}

/** Ends the tour now (from the Help page): every tour pop-up closes. */
export function endTour() {
  set(OFF);
}

export function closeTourNote() {
  set({ ...tour, noteOpen: false });
}

/** The signed-in account's tour (off if another account started it). */
export function useTour(): Tour {
  const { user } = useAuth();
  const current = useSyncExternalStore(subscribe, () => tour);
  return current.userId === user.id ? current : OFF;
}
