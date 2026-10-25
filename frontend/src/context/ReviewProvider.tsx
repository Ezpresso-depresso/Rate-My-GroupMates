/*
 * Loads the team and its reviews from the API and holds the current user's drafts.
 * Drafts stay in localStorage until submitted; submitted reviews live in MongoDB.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusScreen } from '../components/common/StatusScreen';
import { CURRENT_USER_ID, draftsKey, TEAM_ID } from '../config';
import { categories, emptyDraft, MAX_COMMENT_LENGTH, valid } from '../lib/ratingCore';
import { api } from '../services/api';
import type { Review, ReviewDraft, Team } from '../types';
import { ReviewContext, type ReviewContextValue } from './reviewContext';

type Drafts = Record<string, ReviewDraft>;
type Status = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready' };

const DRAFTS_KEY = draftsKey(TEAM_ID, CURRENT_USER_ID);

const MISSING_ENV: Status | null =
  TEAM_ID && CURRENT_USER_ID
    ? null
    : {
        kind: 'error',
        message: 'Set VITE_TEAM_ID and VITE_CURRENT_USER_ID in frontend/.env (run `npm run seed` in backend/ to get them), then restart the dev server.',
      };

function loadDrafts(): Drafts {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '{}') as Drafts;
  } catch {
    return {};
  }
}

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(MISSING_ENV ?? { kind: 'loading' });
  const [team, setTeam] = useState<Team | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [drafts, setDrafts] = useState<Drafts>(loadDrafts);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (MISSING_ENV) return;
    let ignore = false;
    Promise.all([api.getTeam(TEAM_ID), api.getReviews(TEAM_ID, CURRENT_USER_ID)])
      .then(([t, r]) => {
        if (ignore) return;
        if (!t.members.some((m) => m.id === CURRENT_USER_ID)) {
          setStatus({ kind: 'error', message: `VITE_CURRENT_USER_ID isn’t a member of ${t.name}.` });
          return;
        }
        setTeam(t);
        setReviews(r);
        setStatus({ kind: 'ready' });
      })
      .catch((err: Error) => {
        if (!ignore) setStatus({ kind: 'error', message: `Couldn’t load your team: ${err.message}` });
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    } catch {
      console.warn('Browser storage is unavailable. Drafts may not survive a refresh.');
    }
  }, [drafts]);

  const currentUser = team?.members.find((m) => m.id === CURRENT_USER_ID);
  const teammates = useMemo(() => team?.members.filter((m) => m.id !== CURRENT_USER_ID) ?? [], [team]);

  const draftFor = useCallback(
    (targetId: string): ReviewDraft => {
      const draft = drafts[targetId];
      if (draft) return draft;
      const submitted = reviews.find((r) => r.reviewerId === CURRENT_USER_ID && r.targetId === targetId);
      return submitted
        ? { rating: submitted.rating, scores: { ...submitted.scores }, text: submitted.text, anonymous: submitted.anonymous }
        : emptyDraft();
    },
    [drafts, reviews],
  );

  const updateDraft = useCallback(
    (targetId: string, patch: Partial<ReviewDraft>) =>
      setDrafts((d) => ({ ...d, [targetId]: { ...draftFor(targetId), ...patch } })),
    [draftFor],
  );

  const submitAll = useCallback(async (): Promise<string | null> => {
    const incomplete = teammates.find((t) => !valid(draftFor(t.id)));
    if (incomplete) return incomplete.id;

    await api.submitReviews(TEAM_ID, {
      reviewerId: CURRENT_USER_ID,
      reviews: teammates.map((t) => {
        const d = draftFor(t.id);
        return {
          targetId: t.id,
          rating: d.rating,
          scores: Object.fromEntries(categories.map((c) => [c.key, d.scores[c.key]])),
          text: d.text.trim().slice(0, MAX_COMMENT_LENGTH),
          anonymous: d.anonymous,
        };
      }),
    });
    setReviews(await api.getReviews(TEAM_ID, CURRENT_USER_ID));
    setDrafts({}); // submitted reviews now act as the starting point for edits
    return null;
  }, [teammates, draftFor]);

  if (status.kind === 'loading') return <StatusScreen title="Loading your team…" />;
  if (status.kind === 'error' || !team || !currentUser)
    return (
      <StatusScreen
        title="Something went wrong"
        message={status.kind === 'error' ? status.message : undefined}
        onRetry={() => {
          setStatus(MISSING_ENV ?? { kind: 'loading' });
          setAttempt((a) => a + 1);
        }}
      />
    );

  const hasSubmitted = teammates.every((t) =>
    reviews.some((r) => r.reviewerId === CURRENT_USER_ID && r.targetId === t.id),
  );

  const value: ReviewContextValue = {
    team,
    currentUser,
    teammates,
    reviews,
    hasSubmitted,
    draftFor,
    updateDraft,
    submitAll,
  };

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}
