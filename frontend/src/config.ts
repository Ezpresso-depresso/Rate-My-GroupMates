export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

// Until there's group creation, the team to load comes from env (see `npm run seed` in backend/).
export const TEAM_ID = import.meta.env.VITE_TEAM_ID ?? '';

/** Which member this browser is acting as (picked on first visit). */
export const memberKey = (teamId: string) => `rmg-member-v1:${teamId}`;

/** Unsubmitted drafts stay in the browser, one entry per team + member. */
export const draftsKey = (teamId: string, userId: string) => `rmg-drafts-v1:${teamId}:${userId}`;
