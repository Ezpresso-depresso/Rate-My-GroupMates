import type { Request, Response } from 'express';
import { CATEGORY_KEYS } from '../config/constants';
import { authedUser } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { Review } from '../models/Review';
import { Team } from '../models/Team';
import { findViewer } from './teamController';

type TeamParams = { teamId: string };

interface ReviewInput {
  targetId: string;
  rating: number;
  scores: Record<string, number>;
  text?: string;
  anonymous?: boolean;
}

/** Strips what other teammates shouldn't see: anonymous reviewer ids (except on the viewer's own reviews). */
function toPublic(review: InstanceType<typeof Review>, viewerId?: string) {
  const json = review.toJSON() as Record<string, unknown>;
  if (review.anonymous && String(review.reviewerId) !== viewerId) delete json.reviewerId;
  return json;
}

/**
 * Loads the group and the signed-in user's member entry. Reviews are only for
 * accepted members of a group whose reviews have started.
 */
async function loadReviewer(req: Request<TeamParams>) {
  const user = authedUser(req);
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new HttpError(404, 'This group doesn’t exist (it may have been deleted)');
  const me = findViewer(team, user);
  if (!me || me.status !== 'accepted') throw new HttpError(403, 'You’re not a member of this group');
  if (!team.reviewsStartedAt) throw new HttpError(409, 'Reviews open once everyone has accepted their invite');
  return { team, me };
}

/** Query: ?targetId= to filter. Your own anonymous reviews keep their reviewerId. */
export async function listReviews(req: Request<TeamParams>, res: Response) {
  const { me } = await loadReviewer(req);
  const filter: Record<string, unknown> = { team: req.params.teamId };
  if (typeof req.query.targetId === 'string') filter.targetId = req.query.targetId;
  const reviews = await Review.find(filter).sort({ submittedAt: -1 });
  res.json(reviews.map((r) => toPublic(r, String(me._id))));
}

/** Upserts one review per teammate for the given reviewer. */
export async function submitReviews(req: Request<TeamParams>, res: Response) {
  const { teamId } = req.params;
  const { reviews } = req.body as { reviews: ReviewInput[] };
  const { team, me } = await loadReviewer(req);
  const reviewerId = String(me._id);

  if (reviews.some((r) => r.targetId === reviewerId)) throw new HttpError(400, 'You can’t review yourself');
  const memberIds = new Set(team.members.map((m) => String(m._id)));
  const stranger = reviews.find((r) => !memberIds.has(r.targetId));
  if (stranger) throw new HttpError(400, 'One of those people isn’t in this group. Refresh and try again');
  if (new Set(reviews.map((r) => r.targetId)).size !== reviews.length)
    throw new HttpError(400, 'Each teammate can only be reviewed once per submission');

  const submittedAt = new Date();
  await Review.bulkWrite(
    reviews.map((r) => ({
      updateOne: {
        filter: { team: teamId, reviewerId, targetId: r.targetId },
        update: {
          $set: {
            rating: r.rating,
            scores: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, r.scores[k]])),
            text: (r.text ?? '').trim(),
            anonymous: r.anonymous === true,
            submittedAt,
          },
        },
        upsert: true,
      },
    })),
  );

  const saved = await Review.find({ team: teamId, reviewerId });
  res.status(201).json(saved);
}
