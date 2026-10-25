export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

// Until there's login, the team and acting member come from env (see `npm run seed` in backend/).
export const TEAM_ID = import.meta.env.VITE_TEAM_ID ?? '';
export const CURRENT_USER_ID = import.meta.env.VITE_CURRENT_USER_ID ?? '';

/** Unsubmitted drafts stay in the browser, one entry per team + member. */
export const draftsKey = (teamId: string, userId: string) => `rmg-drafts-v1:${teamId}:${userId}`;
