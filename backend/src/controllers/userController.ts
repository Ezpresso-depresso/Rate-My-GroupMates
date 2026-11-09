import type { Request, Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { avatarPath, escapeRegExp } from '../lib/util';
import { HttpError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { buildProfile } from './profileController';

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;
const SEARCH_LIMIT = 20;
const MAX_QUERY_LENGTH = 100;

/**
 * GET /users/:userId/avatar — someone's profile picture as an image, for <img> tags (which can't
 * send a sign-in token, so this is public, like most sites' avatars). Group responses link here
 * with a `?v=` that changes on every account update, so the image can be cached forever.
 */
export async function avatarImage(req: Request<{ userId: string }>, res: Response) {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(404, 'No profile picture');
  const user = await User.findById(req.params.userId).select('avatar');
  const match = user?.avatar ? DATA_URL.exec(user.avatar) : null;
  if (!match) throw new HttpError(404, 'No profile picture');

  res.set({
    'Content-Type': match[1],
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(match[2], 'base64'));
}

type PublicUserRow = {
  _id: Types.ObjectId;
  email: string;
  name: string;
  fullName: string;
  color: string;
  profileBackground?: string;
  bio?: string;
  updatedAt?: Date;
  hasAvatar: boolean;
};

// Loads users without their (large) picture data, just whether they have one.
const PUBLIC_FIELDS = {
  email: 1,
  name: 1,
  fullName: 1,
  color: 1,
  profileBackground: 1,
  bio: 1,
  updatedAt: 1,
  hasAvatar: { $gt: [{ $strLenCP: { $ifNull: ['$avatar', ''] } }, 0] },
};

function toPublicUser(u: PublicUserRow) {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    fullName: u.fullName,
    color: u.color,
    avatar: u.hasAvatar ? avatarPath(u._id, u.updatedAt) : '',
    profileBackground: u.profileBackground ?? '',
    bio: u.bio ?? '',
  };
}

/**
 * How well `q` matches a name or email: whole value > starts with > a word starts with > contains.
 * The best of name, full name and email wins, so "kent" finds Kent and kent.k@uci.edu alike.
 */
function matchScore(u: PublicUserRow, q: string): number {
  const score = (value: string) => {
    const v = value.toLowerCase();
    if (!v || !v.includes(q)) return 0;
    if (v === q) return 100;
    if (v.startsWith(q)) return 80;
    if (v.split(/[\s@._-]+/).some((word) => word.startsWith(q))) return 60;
    return 40;
  };
  const emailLocal = u.email.split('@')[0];
  return Math.max(score(u.fullName), score(u.name), score(u.email), score(emailLocal) - 1);
}

/** GET /users/search?q= — people by name or email, best matches first (up to 20). */
export async function searchUsers(req: Request, res: Response) {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
  if (!q) return res.json([]);

  const pattern = new RegExp(escapeRegExp(q), 'i');
  const rows = await User.aggregate<PublicUserRow>([
    { $match: { $or: [{ name: pattern }, { fullName: pattern }, { email: pattern }] } },
    { $limit: 200 }, // ranked below; this just bounds the work
    { $project: PUBLIC_FIELDS },
  ]);

  const ranked = rows
    .map((u) => ({ u, score: matchScore(u, q) }))
    .sort((a, b) => b.score - a.score || (a.u.fullName || a.u.name).localeCompare(b.u.fullName || b.u.name))
    .slice(0, SEARCH_LIMIT);
  res.json(ranked.map(({ u }) => toPublicUser(u)));
}

/** GET /users/:userId/profile — someone's profile (read-only): who they are, plus the same data as GET /profile. */
export async function getUserProfile(req: Request<{ userId: string }>, res: Response) {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(404, 'That profile doesn’t exist');
  const [row] = await User.aggregate<PublicUserRow>([
    { $match: { _id: new Types.ObjectId(req.params.userId) } },
    { $project: PUBLIC_FIELDS },
  ]);
  if (!row) throw new HttpError(404, 'That profile doesn’t exist');
  res.json({ user: toPublicUser(row), ...(await buildProfile(row._id)) });
}
