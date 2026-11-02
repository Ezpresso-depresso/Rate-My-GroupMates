/*
 * Loads one group (from the URL) for the signed-in user.
 *   - invited but not accepted yet → sent to the join page
 *   - waiting for others to accept → the waiting room, re-checked every few seconds
 *   - reviews open → loads reviews and provides the rating/awards context
 * Drafts stay in localStorage until submitted; submitted reviews live in MongoDB.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { GroupLobby } from '../components/groups/GroupLobby';
import { StatusScreen } from '../components/common/StatusScreen';
import { Shell } from '../components/layout/Shell';
import { draftsKey, LOBBY_POLL_MS } from '../config';
import { useAuth } from '../hooks/useAuth';
import { categories, emptyDraft, MAX_COMMENT_LENGTH, valid } from '../lib/ratingCore';
import { readStorage, writeStorage } from '../lib/storage';
import { joinPath, viewerOf } from '../lib/teams';
import { api, type ApiError } from '../services/api';
import type { Review, ReviewDraft, Team } from '../types';
import { ReviewContext, type ReviewContextValue } from './reviewContext';

type Drafts = Record<string, ReviewDraft>;
type Status =
  | { kind: 'loading' }
  | { kind: 'error'; title: string; message: string; retry: boolean }
  | { kind: 'gone'; message: string }
  | { kind: 'ready' };

/** Turns a failed load into a screen: retryable for network/server trouble, final for 403/404. */
function errorStatus(err: ApiError): Status {
  if (err.status === 400 || err.status === 403 || err.status === 404) return { kind: 'gone', message: err.message };
  return { kind: 'error', title: 'Couldn’t load this group', message: err.message, retry: true };
}

export function ReviewProvider({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [team, setTeam] = useState<Team | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [pollError, setPollError] = useState('');

  const me = team ? viewerOf(team, user) : undefined;
  const memberId = me?.status === 'accepted' ? me.id : '';
  const [drafts, setDrafts] = useState<Drafts>({});
  const [draftsFor, setDraftsFor] = useState('');

  // Load drafts once we know who we are in this group.
  if (memberId && draftsFor !== memberId) {
    setDraftsFor(memberId);
    setDrafts(readStorage(draftsKey(teamId, memberId), {}));
  }
  useEffect(() => {
    if (memberId && draftsFor === memberId) writeStorage(draftsKey(teamId, memberId), drafts);
  }, [drafts, draftsFor, memberId, teamId]);

  // Initial load (and retries).
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const t = await api.getTeam(teamId);
        const viewer = viewerOf(t, user);
        const r = t.status === 'reviewing' && viewer?.status === 'accepted' ? await api.getReviews(teamId) : [];
        if (ignore) return;
        setTeam(t);
        setReviews(r);
        setStatus({ kind: 'ready' });
      } catch (err) {
        if (!ignore) setStatus(errorStatus(err as ApiError));
      }
    })();
    return () => {
      ignore = true;
    };
  }, [teamId, user, attempt]);

  // Waiting room: re-check until everyone has joined, then load reviews.
  const waiting = status.kind === 'ready' && team?.status === 'pending';
  useEffect(() => {
    if (!waiting) return;
    let ignore = false;
    const timer = setInterval(async () => {
      if (document.hidden) return; // don't poll from background tabs
      try {
        const t = await api.getTeam(teamId);
        const r = t.status === 'reviewing' && viewerOf(t, user)?.status === 'accepted' ? await api.getReviews(teamId) : null;
        if (ignore) return;
        setTeam(t);
        if (r) setReviews(r);
        setPollError('');
      } catch (err) {
        if (ignore) return;
        const e = err as ApiError;
        if (e.status === 403 || e.status === 404) setStatus(errorStatus(e));
        else setPollError('Lost connection to the server. Still trying…');
      }
    }, LOBBY_POLL_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [waiting, teamId, user]);

  const teammates = useMemo(() => team?.members.filter((m) => m.id !== memberId) ?? [], [team, memberId]);

  const draftFor = useCallback(
    (targetId: string): ReviewDraft => {
      const draft = drafts[targetId];
      if (draft) return draft;
      const submitted = reviews.find((r) => r.reviewerId === memberId && r.targetId === targetId);
      return submitted
        ? { rating: submitted.rating, scores: { ...submitted.scores }, text: submitted.text, anonymous: submitted.anonymous }
        : emptyDraft();
    },
    [drafts, reviews, memberId],
  );

  const updateDraft = useCallback(
    (targetId: string, patch: Partial<ReviewDraft>) =>
      setDrafts((d) => ({ ...d, [targetId]: { ...draftFor(targetId), ...patch } })),
    [draftFor],
  );

  const submitAll = useCallback(async (): Promise<string | null> => {
    const incomplete = teammates.find((t) => !valid(draftFor(t.id)));
    if (incomplete) return incomplete.id;

    await api.submitReviews(teamId, {
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
    setDrafts({}); // submitted reviews now act as the starting point for edits
    try {
      setReviews(await api.getReviews(teamId));
    } catch {
      // Saved, but the refresh failed: the next page load shows them. Don't report the save as failed.
    }
    return null;
  }, [teammates, draftFor, teamId]);

  if (status.kind === 'loading') return <StatusScreen title="Loading your group…" />;
  if (status.kind === 'gone')
    return <StatusScreen title="Can’t open this group" message={status.message} secondary={{ label: '← Back to my groups', to: '/' }} />;
  if (status.kind === 'error' || !team)
    return (
      <StatusScreen
        title={status.kind === 'error' ? status.title : 'Something went wrong'}
        message={status.kind === 'error' ? status.message : undefined}
        onRetry={() => {
          setStatus({ kind: 'loading' });
          setAttempt((a) => a + 1);
        }}
        secondary={{ label: '← Back to my groups', to: '/' }}
      />
    );

  if (!me) return <StatusScreen title="Can’t open this group" message="You’re not in this group." secondary={{ label: '← Back to my groups', to: '/' }} />;
  if (me.status === 'invited') return <Navigate to={joinPath(team.id)} replace />;

  if (team.status === 'pending')
    return (
      <Shell>
        <GroupLobby
          team={team}
          pollError={pollError}
          onChange={(t) => {
            if (t.status === 'pending') return setTeam(t);
            // Your own action started reviews (e.g. cancelled the last pending invite): load them.
            setStatus({ kind: 'loading' });
            setAttempt((a) => a + 1);
          }}
          onGone={(message) => setStatus({ kind: 'gone', message })}
        />
      </Shell>
    );

  const currentUser = team.members.find((m) => m.id === memberId)!;
  const hasSubmitted = teammates.every((t) => reviews.some((r) => r.reviewerId === memberId && r.targetId === t.id));

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
