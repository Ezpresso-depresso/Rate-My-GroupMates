/*
 * Your profile: every review you've received, plus what you've pinned.
 *
 * A group counts as soon as its reviews are open: every rating someone receives counts toward
 * their profile and overall rank right away, whether or not they've submitted their own reviews.
 * Ratings and awards are computed in the browser from these reviews (frontend/src/lib/ratingCore.ts), so the
 * award rules live in one place.
 */
import type { Request, Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { MAX_ADDED_CLASSES, MAX_BIO_LENGTH, MAX_PINS, PROFILE_BACKGROUNDS } from '../config/constants';
import { findCourse } from '../lib/courses';
import { inGroupFor, profileClasses } from '../lib/userClasses';
import { authedUser } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { Review } from '../models/Review';
import { Team, type TeamDoc } from '../models/Team';
import { User, type UserDoc } from '../models/User';

/** Groups where the user is an accepted member and reviews are open. */
async function countedGroups(userId: Types.ObjectId) {
  const teams = await Team.find({ 'members.user': userId, reviewsStartedAt: { $ne: null } });
  return teams.flatMap((team) => {
    const me = team.members.find((m) => m.user && String(m.user) === String(userId));
    return me && me.status === 'accepted' ? [{ team, memberId: me._id as Types.ObjectId }] : [];
  });
}

export interface OverallRating {
  /** Average stars, or null with no ratings yet. */
  average: number | null;
  count: number;
}

/**
 * Overall star rating for many users at once (for search results and rank tags), by the same rule
 * as the profile: every rating received in a group whose reviews are open counts.
 */
export async function overallRatings(userIds: Types.ObjectId[]): Promise<Map<string, OverallRating>> {
  const result = new Map<string, OverallRating>(userIds.map((id) => [String(id), { average: null, count: 0 }]));
  if (!userIds.length) return result;

  const wanted = new Set(userIds.map(String));
  const teams = await Team.find({ 'members.user': { $in: userIds }, reviewsStartedAt: { $ne: null } })
    .select('members._id members.user members.status')
    .lean();
  // memberId -> userId
  const members = new Map<string, string>();
  for (const team of teams)
    for (const m of team.members)
      if (m.user && m.status === 'accepted' && wanted.has(String(m.user)))
        members.set(String(m._id), String(m.user));
  if (!members.size) return result;
  const memberIds = [...members.keys()].map((id) => new Types.ObjectId(id));

  const received = await Review.aggregate<{ _id: Types.ObjectId; sum: number; n: number }>([
    { $match: { targetId: { $in: memberIds }, rating: { $gte: 1, $lte: 5 } } },
    { $group: { _id: '$targetId', sum: { $sum: '$rating' }, n: { $sum: 1 } } },
  ]);
  const totals = new Map<string, { sum: number; n: number }>();
  for (const r of received) {
    const userId = members.get(String(r._id))!;
    const t = totals.get(userId) ?? { sum: 0, n: 0 };
    totals.set(userId, { sum: t.sum + r.sum, n: t.n + r.n });
  }
  for (const [userId, t] of totals) result.set(userId, { average: t.sum / t.n, count: t.n });
  return result;
}

function memberName(team: TeamDoc, memberId: Types.ObjectId) {
  return team.members.find((m) => String(m._id) === String(memberId))?.name ?? 'A teammate';
}

/** Everything a profile shows, for any user: the same data whether it's yours or someone else's. */
export async function buildProfile(userId: Types.ObjectId) {
  const groups = await countedGroups(userId);
  const byMember = new Map(groups.map((g) => [String(g.memberId), g.team]));

  const reviews = await Review.find({ targetId: { $in: groups.map((g) => g.memberId) } }).sort({ submittedAt: -1 });
  const pins = await User.findById(userId).select('pinnedComments pinnedAwards');

  return {
    classes: await profileClasses(userId),
    groups: groups.map(({ team }) => ({ id: String(team._id), name: team.name, course: team.course })),
    reviews: reviews.map((r) => {
      const team = byMember.get(String(r.targetId))!;
      return {
        id: String(r._id),
        teamId: String(team._id),
        rating: r.rating,
        scores: r.scores,
        text: r.text,
        anonymous: r.anonymous,
        award: r.award ?? null,
        // Anonymous reviews never say who wrote them.
        reviewerName: r.anonymous ? null : memberName(team, r.reviewerId),
        submittedAt: r.submittedAt,
      };
    }),
    pinnedComments: pins?.pinnedComments ?? [],
    pinnedAwards: pins?.pinnedAwards ?? [],
  };
}

export async function getProfile(req: Request, res: Response) {
  res.json(await buildProfile(authedUser(req)._id));
}

const AWARD_KEY = /^([0-9a-f]{24}):funny:([\w-]{1,40})$/i;

function parsePins(raw: unknown, label: string): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.some((p) => typeof p !== 'string')) throw new HttpError(400, `${label} must be a list`);
  const pins = [...new Set(raw as string[])];
  if (pins.length > MAX_PINS) throw new HttpError(400, `You can pin up to ${MAX_PINS} ${label}`);
  return pins;
}

/** Body: { comments?: string[], awards?: string[] }. Replaces whichever list is sent. */
export async function setPins(req: Request, res: Response) {
  const user = authedUser(req);
  const comments = parsePins(req.body?.comments, 'comments');
  const awards = parsePins(req.body?.awards, 'awards');
  if (!comments && !awards) throw new HttpError(400, 'Send comments and/or awards to pin');

  const groups = await countedGroups(user._id);
  if (comments?.length) {
    if (!comments.every(isValidObjectId)) throw new HttpError(400, 'One of those comments doesn’t exist');
    const yours = await Review.countDocuments({
      _id: { $in: comments },
      targetId: { $in: groups.map((g) => g.memberId) },
      text: { $ne: '' },
    });
    if (yours !== comments.length) throw new HttpError(400, 'You can only pin comments written about you');
  }
  if (awards?.length) {
    const teamIds = new Set(groups.map((g) => String(g.team._id)));
    if (!awards.every((a) => teamIds.has(AWARD_KEY.exec(a)?.[1] ?? '')))
      throw new HttpError(400, 'You can only pin awards you’ve received');
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { ...(comments && { pinnedComments: comments }), ...(awards && { pinnedAwards: awards }) } },
    { new: true },
  ).select('pinnedComments pinnedAwards');
  if (!updated) throw new HttpError(401, 'Your account no longer exists. Please sign in again');
  res.json({ pinnedComments: updated.pinnedComments, pinnedAwards: updated.pinnedAwards });
}

/** Body: { background } — one of PROFILE_BACKGROUNDS, or '' for none. */
export async function setBackground(req: Request, res: Response) {
  const background = typeof req.body?.background === 'string' ? req.body.background : null;
  if (background === null || (background !== '' && !(PROFILE_BACKGROUNDS as readonly string[]).includes(background)))
    throw new HttpError(400, 'Pick one of the preset backgrounds');

  const user = await User.findByIdAndUpdate(authedUser(req)._id, { $set: { profileBackground: background } }, { new: true });
  if (!user) throw new HttpError(401, 'Your account no longer exists. Please sign in again');
  res.json(user);
}

/** Body: { bio } — up to MAX_BIO_LENGTH characters; '' clears it. Line breaks are flattened to spaces. */
export async function setBio(req: Request, res: Response) {
  if (typeof req.body?.bio !== 'string') throw new HttpError(400, 'bio must be text');
  const bio = req.body.bio.replace(/\s+/g, ' ').trim();
  if (bio.length > MAX_BIO_LENGTH) throw new HttpError(400, `Keep your bio under ${MAX_BIO_LENGTH} characters`);

  const user = await User.findByIdAndUpdate(authedUser(req)._id, { $set: { bio } }, { new: true });
  if (!user) throw new HttpError(401, 'Your account no longer exists. Please sign in again');
  res.json(user);
}

/** GET /profile/classes — your classes (the navbar uses this to nudge you to add some). */
export async function getClasses(req: Request, res: Response) {
  res.json(await profileClasses(authedUser(req)._id));
}

async function courseFromBody(req: Request) {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const course = code ? await findCourse(code) : undefined;
  if (!course) throw new HttpError(400, 'Pick a class from the list');
  return course.code;
}

/** POST /profile/classes, body { code } — adds a class to your profile. Returns your classes. */
export async function addClass(req: Request, res: Response) {
  const user = authedUser(req);
  const code = await courseFromBody(req);
  const current = await User.findById(user._id).select('addedCourses');
  if (!current) throw new HttpError(401, 'Your account no longer exists. Please sign in again');
  if (!current.addedCourses.includes(code) && current.addedCourses.length >= MAX_ADDED_CLASSES)
    throw new HttpError(400, `You can add up to ${MAX_ADDED_CLASSES} classes`);

  await User.updateOne({ _id: user._id }, { $addToSet: { addedCourses: code }, $pull: { droppedCourses: code } });
  res.json(await profileClasses(user._id));
}

/** POST /profile/classes/drop, body { code } — takes a class off your profile (even one from a group). */
export async function dropClass(req: Request, res: Response) {
  const user = authedUser(req);
  const code = await courseFromBody(req);
  // A group's class would come straight back, so remember that it was dropped.
  const fromGroup = await inGroupFor(user._id, code);
  await User.updateOne(
    { _id: user._id },
    { $pull: { addedCourses: code }, ...(fromGroup ? { $addToSet: { droppedCourses: code } } : {}) },
  );
  res.json(await profileClasses(user._id));
}
