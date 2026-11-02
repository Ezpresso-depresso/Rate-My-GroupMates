import 'dotenv/config';

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
// OAuth client id from Google Cloud Console (APIs & Services > Credentials). The frontend
// fetches it from /api/auth/config, so it only has to be set here.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
// Signs session tokens. Must be set in production; local dev falls back to a fixed secret.
export const JWT_SECRET = () => (IS_PROD ? required('JWT_SECRET') : (process.env.JWT_SECRET ?? 'dev-only-secret'));
export const SESSION_DAYS = 30;
// Lets anyone sign in with any name + email, no Google. Local testing only: never on in production.
export const DEV_LOGIN = !IS_PROD && process.env.DEV_LOGIN === 'true';

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
