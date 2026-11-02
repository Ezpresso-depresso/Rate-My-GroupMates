import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import {
  CATEGORY_KEYS,
  MAX_COMMENT_LENGTH,
  SCORE_MAX,
  SCORE_MIN,
  STAR_MAX,
  STAR_MIN,
} from '../config/constants';
import { HttpError } from './errorHandler';

const inRange = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Rejects requests whose route params aren't valid Mongo ObjectIds. */
export const validateObjectIds =
  (...params: string[]): RequestHandler =>
  (req, _res, next) => {
    const bad = params.find((p) => !isValidObjectId(req.params[p]));
    const message = bad === 'teamId' ? 'That group link is broken or incomplete' : `Invalid ${bad}`;
    next(bad ? new HttpError(400, message) : undefined);
  };

/**
 * Body: { reviews: [{ targetId, rating, scores, text?, anonymous? }] }. The reviewer is the signed-in user.
 * Shape checks only; membership checks happen in the controller once the team is loaded.
 */
export const validateReviewSubmission: RequestHandler = (req, _res, next) => {
  const { reviews } = req.body ?? {};
  if (!Array.isArray(reviews) || reviews.length === 0) return next(new HttpError(400, 'reviews must be a non-empty array'));

  for (const r of reviews) {
    if (!isValidObjectId(r?.targetId)) return next(new HttpError(400, 'Invalid targetId'));
    if (!inRange(r.rating, STAR_MIN, STAR_MAX)) return next(new HttpError(400, `rating must be ${STAR_MIN}–${STAR_MAX}`));
    if (!CATEGORY_KEYS.every((k) => inRange(r.scores?.[k], SCORE_MIN, SCORE_MAX)))
      return next(new HttpError(400, `Every category score must be ${SCORE_MIN}–${SCORE_MAX}`));
    if (r.text !== undefined && (typeof r.text !== 'string' || r.text.length > MAX_COMMENT_LENGTH))
      return next(new HttpError(400, `text must be at most ${MAX_COMMENT_LENGTH} characters`));
    if (r.anonymous !== undefined && typeof r.anonymous !== 'boolean') return next(new HttpError(400, 'anonymous must be true or false'));
  }
  next();
};
