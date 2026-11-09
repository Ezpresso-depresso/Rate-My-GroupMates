import 'dotenv/config';
import { createHmac } from 'node:crypto';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const NODE_ENV = process.env.NODE_ENV ?? 'development';
// Vercel sets VERCEL_ENV ("production" | "preview" | "development"); NODE_ENV isn't reliable there.
export const IS_PROD = NODE_ENV === 'production' || ['production', 'preview'].includes(process.env.VERCEL_ENV ?? '');
export const PORT = Number(process.env.PORT ?? 5000);

// MongoDB
export const MONGODB_URI = () => required('MONGODB_URI');
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'rate-my-groupmates';

// Auth
// Optional. OAuth client id from Google Cloud Console; when unset, Google sign-in is switched off
// and only email + password is offered. The frontend fetches it from /api/auth/config.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
// Tests only: where to fetch the keys that sign Google ID tokens, so tests can sign their own. Only a
// localhost URL is accepted, so this can never make a deployed server trust someone else's keys.
const certsUrl = process.env.GOOGLE_CERTS_URL?.trim() ?? '';
export const GOOGLE_CERTS_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(certsUrl) ? certsUrl : '';
// Signs login sessions. Uses JWT_SECRET when set; otherwise derives a private secret from the
// database connection string (already secret, already set on Vercel). Never a value written in
// the code: the repo is public, so that would let anyone forge sessions.
export const JWT_SECRET = () =>
  process.env.JWT_SECRET?.trim() ||
  createHmac('sha256', MONGODB_URI()).update('rate-my-groupmates/session-signing/v1').digest('hex');
export const SESSION_DAYS = 30;

// Passwords (stored as bcrypt hashes)
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores anything past 72 bytes, so refuse longer ones
export const BCRYPT_ROUNDS = 10;
// After LOCKOUT_ATTEMPTS wrong passwords within LOCKOUT_MINUTES, the email is locked for LOCKOUT_MINUTES.
export const LOCKOUT_ATTEMPTS = 10;
export const LOCKOUT_MINUTES = 15;

// Comma-separated list of allowed frontend origins. `*` matches any subdomain part, e.g.
// "https://rmg.vercel.app,https://*-myteam-projects.vercel.app" (covers Vercel's branch/preview URLs).
export const CLIENT_ORIGINS: (string | RegExp)[] = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, '')) // a trailing slash would never match
  .filter(Boolean)
  .map((o) =>
    o.includes('*') ? new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`) : o,
  );

// Rating rules (keep in sync with frontend/src/lib/ratingCore.ts)
export const CATEGORY_KEYS = ['participation', 'communication', 'quality'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export const STAR_MIN = 1;
export const STAR_MAX = 5;
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;
export const MAX_COMMENT_LENGTH = 700;

// Groups
export const MIN_GROUP_SIZE = 2; // creator included; no upper limit
export const MAX_NAME_LENGTH = 80;
export const INVITE_CODE_LENGTH = 6;
