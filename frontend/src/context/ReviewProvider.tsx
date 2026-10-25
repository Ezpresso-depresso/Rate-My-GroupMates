/*
 * Holds the team, submitted reviews and the current user's drafts.
 * Persists to localStorage for now; swap the load/save calls for `services/api`
 * once the backend has data.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEY } from '../config';
import { SAMPLE_CURRENT_USER_ID, samplePeerReviews, sampleTeam } from '../data/sampleTeam';
import { categories, emptyDraft, MAX_COMMENT_LENGTH, valid } from '../lib/ratingCore';
import type { Review, ReviewDraft } from '../types';
import { ReviewContext, type ReviewContextValue } from './reviewContext';

interface StoredState {
  reviews: Review[];
  drafts: Record<string, ReviewDraft>;
}

function load(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredState;
  } catch {
    /* storage unavailable or corrupt: fall back to sample data */
  }
  return { reviews: samplePeerReviews, drafts: {} };
}

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(load);
  const team = sampleTeam;
  const currentUser = team.members.find((m) => m.id === SAMPLE_CURRENT_USER_ID)!;
  const teammates = useMemo(() => team.members.filter((m) => m.id !== currentUser.id), [team, currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      console.warn('Browser storage is unavailable. Changes may not survive a refresh.');
    }
  }, [state]);

  const draftFor = useCallback(
    (targetId: string): ReviewDraft => {
      const draft = state.drafts[targetId];
      if (draft) return draft;
      const submitted = state.reviews.find((r) => r.reviewerId === currentUser.id && r.targetId === targetId);
      return submitted ? { ...emptyDraft(), ...submitted, scores: { ...submitted.scores } } : emptyDraft();
    },
    [state, currentUser.id],
  );

  const updateDraft = useCallback(
    (targetId: string, patch: Partial<ReviewDraft>) =>
      setState((s) => ({ ...s, drafts: { ...s.drafts, [targetId]: { ...draftFor(targetId), ...patch } } })),
    [draftFor],
  );

  const submitAll = useCallback((): string | null => {
    const incomplete = teammates.find((t) => !valid(draftFor(t.id)));
    if (incomplete) return incomplete.id;
    const submittedAt = new Date().toISOString();
    const mine: Review[] = teammates.map((t) => {
      const d = draftFor(t.id);
      return {
        teamId: team.id,
        reviewerId: currentUser.id,
        targetId: t.id,
        rating: d.rating,
        scores: Object.fromEntries(categories.map((c) => [c.key, d.scores[c.key]])),
        text: d.text.trim().slice(0, MAX_COMMENT_LENGTH),
        anonymous: d.anonymous,
        submittedAt,
      };
    });
    setState((s) => ({ ...s, reviews: [...s.reviews.filter((r) => r.reviewerId !== currentUser.id), ...mine] }));
    return null;
  }, [teammates, draftFor, team.id, currentUser.id]);

  const hasSubmitted = teammates.every((t) =>
    state.reviews.some((r) => r.reviewerId === currentUser.id && r.targetId === t.id),
  );

  const value: ReviewContextValue = {
    team,
    currentUser,
    teammates,
    reviews: state.reviews,
    hasSubmitted,
    draftFor,
    updateDraft,
    submitAll,
  };

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}
