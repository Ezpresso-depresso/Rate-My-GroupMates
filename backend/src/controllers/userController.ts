import type { Request, Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { findCourse } from '../lib/courses';
import { userIdsInClass } from '../lib/userClasses';
import { avatarPath, escapeRegExp } from '../lib/util';
import { HttpError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { buildProfile, overallRatings } from './profileController';

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;
const SEARCH_LIMIT = 20;
const CLASS_LIMIT = 100; // a class list is browsed, not ranked: show more of it
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

/** How well `q` matches one value: whole value > starts with > a word starts with > contains. */
function textScore(value: string, q: string): number {
  const v = value.toLowerCase();
  if (!v || !v.includes(q)) return 0;
  if (v === q) return 100;
  if (v.startsWith(q)) return 80;
  if (v.split(/[\s@._-]+/).some((word) => word.startsWith(q))) return 60;
  return 40;
}

const nameScore = (u: PublicUserRow, q: string) => Math.max(textScore(u.fullName, q), textScore(u.name, q));
const emailScore = (u: PublicUserRow, q: string) => Math.max(textScore(u.email, q), textScore(u.email.split('@')[0], q) - 1);

/** Which part of a person the search looks at. `all` = name or email. */
const SEARCH_FIELDS = ['all', 'name', 'email', 'class'] as const;
type SearchField = (typeof SEARCH_FIELDS)[number];

/** Everyone whose profile lists this class (a course code like "COMPSCI 161"). */
async function searchByClass(q: string) {
  const course = await findCourse(q);
  if (!course) return [];
  const ids = await userIdsInClass(course.code);
  if (!ids.length) return [];
  const rows = await User.aggregate<PublicUserRow>([{ $match: { _id: { $in: ids } } }, { $project: PUBLIC_FIELDS }]);
  return rows.map((u) => ({ u, score: 0 })); // all equally good: sorted by name below
}

/**
 * GET /users/search?q=&by= — people (each with their overall star rating) whose name, email (`all`, the default, checks both) or class
 * matches, best matches first (up to 20). For `class`, `q` is a course code: people whose profile lists it.
 */
export async function searchUsers(req: Request, res: Response) {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
  const by: SearchField = SEARCH_FIELDS.includes(req.query.by as SearchField) ? (req.query.by as SearchField) : 'all';
  if (!q) return res.json([]);

  let scored: { u: PublicUserRow; score: number }[];
  if (by === 'class') {
    scored = await searchByClass(q);
  } else {
    const pattern = new RegExp(escapeRegExp(q), 'i');
    const fields = { all: ['name', 'fullName', 'email'], name: ['name', 'fullName'], email: ['email'] }[by];
    const rows = await User.aggregate<PublicUserRow>([
      { $match: { $or: fields.map((f) => ({ [f]: pattern })) } },
      { $limit: 200 }, // ranked below; this just bounds the work
      { $project: PUBLIC_FIELDS },
    ]);
    const score = (u: PublicUserRow) =>
      by === 'name' ? nameScore(u, q) : by === 'email' ? emailScore(u, q) : Math.max(nameScore(u, q), emailScore(u, q));
    scored = rows.map((u) => ({ u, score: score(u) }));
  }

  const ranked = scored
    .sort((a, b) => b.score - a.score || (a.u.fullName || a.u.name).localeCompare(b.u.fullName || b.u.name))
    .slice(0, by === 'class' ? CLASS_LIMIT : SEARCH_LIMIT);
  const ratings = await overallRatings(ranked.map(({ u }) => u._id));
  res.json(ranked.map(({ u }) => ({ ...toPublicUser(u), rating: ratings.get(String(u._id)) })));
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
