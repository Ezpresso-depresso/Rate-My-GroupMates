import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { JWT_SECRET, SESSION_DAYS } from '../config/constants';
import { User, type UserDoc } from '../models/User';
import { HttpError } from './errorHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: UserDoc;
    }
  }
}

export function signSession(user: UserDoc): string {
  return jwt.sign({}, JWT_SECRET(), { subject: String(user._id), expiresIn: `${SESSION_DAYS}d` });
}

/** Reads `Authorization: Bearer <token>` and loads the user. 401 when missing, invalid, expired or the account is gone. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return next(new HttpError(401, 'Please sign in'));

  let userId: string | undefined;
  try {
    userId = jwt.verify(token, JWT_SECRET()).sub as string | undefined;
  } catch (err) {
    const expired = err instanceof jwt.TokenExpiredError;
    return next(new HttpError(401, expired ? 'Your session expired. Please sign in again' : 'Please sign in again'));
  }
  if (!userId || !isValidObjectId(userId)) return next(new HttpError(401, 'Please sign in again'));

  const user = await User.findById(userId);
  if (!user) return next(new HttpError(401, 'Your account no longer exists. Please sign in again'));
  req.user = user;
  next();
};

/** For handlers behind requireAuth. */
export function authedUser(req: { user?: UserDoc }): UserDoc {
  if (!req.user) throw new HttpError(401, 'Please sign in');
  return req.user;
}
