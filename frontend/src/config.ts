export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');

/** The signed-in session token (see services/session.ts). */
export const SESSION_KEY = 'rmg-session-v1';

/** Unsubmitted drafts stay in the browser, one entry per group + member. */
export const draftsKey = (teamId: string, memberId: string) => `rmg-drafts-v1:${teamId}:${memberId}`;

/** How often the waiting room re-checks whether everyone has joined. */
export const LOBBY_POLL_MS = Number(import.meta.env.VITE_LOBBY_POLL_MS) || 10_000; // tests use a shorter interval

/** Shown on the privacy/terms pages when set. */
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? '';
