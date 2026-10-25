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

// Comma-separated list of allowed frontend origins, e.g. "http://localhost:5173,https://rmg.vercel.app"
export const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Rating rules (keep in sync with frontend/src/lib/ratingCore.ts)
export const CATEGORY_KEYS = ['participation', 'communication', 'quality'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export const STAR_MIN = 1;
export const STAR_MAX = 5;
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;
export const MAX_COMMENT_LENGTH = 700;
