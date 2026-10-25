import type { Request, Response } from 'express';
import { CATEGORY_KEYS } from '../config/constants';
import { HttpError } from '../middleware/errorHandler';
import { Review } from '../models/Review';
import { Team } from '../models/Team';

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

/** Query: ?targetId= to filter, ?viewerId= to see your own anonymous reviews unredacted. */
export async function listReviews(req: Request<TeamParams>, res: Response) {
  const filter: Record<string, unknown> = { team: req.params.teamId };
  if (typeof req.query.targetId === 'string') filter.targetId = req.query.targetId;
  // TODO: once auth exists, take the viewer from the session instead of the query.
  const viewerId = typeof req.query.viewerId === 'string' ? req.query.viewerId : undefined;
  const reviews = await Review.find(filter).sort({ submittedAt: -1 });
  res.json(reviews.map((r) => toPublic(r, viewerId)));
}

/** Upserts one review per teammate for the given reviewer. */
export async function submitReviews(req: Request<TeamParams>, res: Response) {
  const { teamId } = req.params;
  const { reviewerId, reviews } = req.body as { reviewerId: string; reviews: ReviewInput[] };

  const team = await Team.findById(teamId);
  if (!team) throw new HttpError(404, 'Team not found');

  // TODO: once auth exists, take reviewerId from the session instead of the body.
  const memberIds = new Set(team.members.map((m) => String(m._id)));
  if (!memberIds.has(reviewerId)) throw new HttpError(403, 'Reviewer is not on this team');
  const stranger = reviews.find((r) => !memberIds.has(r.targetId));
  if (stranger) throw new HttpError(400, `Target ${stranger.targetId} is not on this team`);

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
