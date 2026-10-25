/*
 * Loads the team and its reviews from the API and holds the current user's drafts.
 * Each browser picks which member it is on first visit (no login yet).
 * Drafts stay in localStorage until submitted; submitted reviews live in MongoDB.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MemberPicker } from '../components/common/MemberPicker';
import { StatusScreen } from '../components/common/StatusScreen';
import { draftsKey, memberKey, TEAM_ID } from '../config';
import { categories, emptyDraft, MAX_COMMENT_LENGTH, valid } from '../lib/ratingCore';
import { api } from '../services/api';
import type { Review, ReviewDraft, Team } from '../types';
import { ReviewContext, type ReviewContextValue } from './reviewContext';

type Drafts = Record<string, ReviewDraft>;
type Status = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready' };

const MISSING_ENV: Status | null = TEAM_ID
  ? null
  : {
      kind: 'error',
      message: 'Set VITE_TEAM_ID in frontend/.env (run `npm run seed` in backend/ to get it), then restart the dev server.',
    };

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn('Browser storage is unavailable. Changes may not survive a refresh.');
  }
}

const loadDrafts = (userId: string): Drafts => (userId ? readStorage(draftsKey(TEAM_ID, userId), {}) : {});

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(MISSING_ENV ?? { kind: 'loading' });
  const [team, setTeam] = useState<Team | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUserId, setCurrentUserId] = useState(() => readStorage(memberKey(TEAM_ID), ''));
  const [drafts, setDrafts] = useState<Drafts>(() => loadDrafts(currentUserId));
  const [attempt, setAttempt] = useState(0);

  // (Re)load whenever the acting member changes: anonymous reviews only keep
  // their reviewerId for the member who wrote them.
  useEffect(() => {
    if (MISSING_ENV) return;
    let ignore = false;
    Promise.all([api.getTeam(TEAM_ID), api.getReviews(TEAM_ID, currentUserId || undefined)])
      .then(([t, r]) => {
        if (ignore) return;
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
  }, [attempt, currentUserId]);

  useEffect(() => {
    if (currentUserId) writeStorage(draftsKey(TEAM_ID, currentUserId), drafts);
  }, [drafts, currentUserId]);

  const currentUser = team?.members.find((m) => m.id === currentUserId);
  const teammates = useMemo(() => team?.members.filter((m) => m.id !== currentUserId) ?? [], [team, currentUserId]);

  const selectMember = (id: string) => {
    writeStorage(memberKey(TEAM_ID), id || undefined);
    setDrafts(loadDrafts(id));
    setCurrentUserId(id);
    if (id) setStatus({ kind: 'loading' });
  };

  const draftFor = useCallback(
    (targetId: string): ReviewDraft => {
      const draft = drafts[targetId];
      if (draft) return draft;
      const submitted = reviews.find((r) => r.reviewerId === currentUserId && r.targetId === targetId);
      return submitted
        ? { rating: submitted.rating, scores: { ...submitted.scores }, text: submitted.text, anonymous: submitted.anonymous }
        : emptyDraft();
    },
    [drafts, reviews, currentUserId],
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
      reviewerId: currentUserId,
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
    setReviews(await api.getReviews(TEAM_ID, currentUserId));
    setDrafts({}); // submitted reviews now act as the starting point for edits
    return null;
  }, [teammates, draftFor, currentUserId]);

  if (status.kind === 'loading') return <StatusScreen title="Loading your team…" />;
  if (status.kind === 'error' || !team)
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
  // No member picked yet (or the stored one isn't on this team anymore).
  if (!currentUser) return <MemberPicker team={team} onSelect={selectMember} />;

  const hasSubmitted = teammates.every((t) =>
    reviews.some((r) => r.reviewerId === currentUserId && r.targetId === t.id),
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
    switchMember: () => selectMember(''),
  };

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}
