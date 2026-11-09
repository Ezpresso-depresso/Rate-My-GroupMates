/*
 * Your profile: every review you've received, plus what you've pinned.
 *
 * A group only counts once you've submitted your own reviews in it (the same rule the
 * awards page uses), so the profile never shows results early. Ratings and awards are
 * computed in the browser from these reviews (frontend/src/lib/ratingCore.ts), so the
 * award rules live in one place.
 */
import type { Request, Response } from 'express';
import { isValidObjectId, type Types } from 'mongoose';
import { MAX_PINS } from '../config/constants';
import { authedUser } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { Review } from '../models/Review';
import { Team, type TeamDoc } from '../models/Team';
import { User, type UserDoc } from '../models/User';

/** Groups where you're an accepted member, reviews are open, and you've reviewed everyone. */
async function countedGroups(user: UserDoc) {
  const teams = await Team.find({ 'members.user': user._id, reviewsStartedAt: { $ne: null } });
  const mine = teams.flatMap((team) => {
    const me = team.members.find((m) => m.user && String(m.user) === String(user._id));
    return me && me.status === 'accepted' ? [{ team, memberId: me._id as Types.ObjectId }] : [];
  });

  const written = await Review.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { reviewerId: { $in: mine.map((m) => m.memberId) } } },
    { $group: { _id: '$team', n: { $sum: 1 } } },
  ]);
  const count = new Map(written.map((w) => [String(w._id), w.n]));
  return mine.filter(({ team }) => (count.get(String(team._id)) ?? 0) >= team.members.length - 1);
}

function memberName(team: TeamDoc, memberId: Types.ObjectId) {
  return team.members.find((m) => String(m._id) === String(memberId))?.name ?? 'A teammate';
}

export async function getProfile(req: Request, res: Response) {
  const user = authedUser(req);
  const groups = await countedGroups(user);
  const byMember = new Map(groups.map((g) => [String(g.memberId), g.team]));

  const reviews = await Review.find({ targetId: { $in: groups.map((g) => g.memberId) } }).sort({ submittedAt: -1 });
  const pins = await User.findById(user._id).select('pinnedComments pinnedAwards');

  res.json({
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
        // Anonymous reviews never say who wrote them.
        reviewerName: r.anonymous ? null : memberName(team, r.reviewerId),
        submittedAt: r.submittedAt,
      };
    }),
    pinnedComments: pins?.pinnedComments ?? [],
    pinnedAwards: pins?.pinnedAwards ?? [],
  });
}

const AWARD_KEY = /^([0-9a-f]{24}):(funny|medal|badge):([\w-]{1,40})$/i;

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

  const groups = await countedGroups(user);
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
