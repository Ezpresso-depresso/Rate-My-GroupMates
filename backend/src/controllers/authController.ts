import type { Request, Response } from 'express';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { DEV_LOGIN, GOOGLE_CLIENT_ID, MAX_NAME_LENGTH } from '../config/constants';
import { authedUser, signSession } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { colorFor, emailName, firstName, isEmail, normalizeEmail } from '../lib/util';
import { User, type UserDoc } from '../models/User';

const google = new OAuth2Client();

/** What the login page needs to know; lets the Google client id live only in the backend env. */
export function authConfig(_req: Request, res: Response) {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null, devLogin: DEV_LOGIN });
}

function session(res: Response, user: UserDoc, status = 200) {
  res.status(status).json({ token: signSession(user), user });
}

/** Body: { credential } — the ID token from the Google Identity Services button. */
export async function googleLogin(req: Request, res: Response) {
  if (!GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google sign-in isn’t set up on the server (GOOGLE_CLIENT_ID is missing)');
  const credential = req.body?.credential;
  if (typeof credential !== 'string' || !credential) throw new HttpError(400, 'Missing Google credential');

  let payload: TokenPayload | undefined;
  try {
    const ticket = await google.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    console.warn('Google token verification failed:', (err as Error).message);
    throw new HttpError(401, 'Couldn’t verify your Google sign-in. Please try again');
  }
  if (!payload?.sub || !payload.email) throw new HttpError(401, 'Google didn’t share an email address for this account');
  if (!payload.email_verified) throw new HttpError(403, 'Verify your email with Google first, then sign in again');

  const email = normalizeEmail(payload.email);
  const fullName = (payload.name ?? '').trim();
  const name = (payload.given_name ?? '').trim() || firstName(fullName) || emailName(email);

  // Match on the Google account first, then on email (accounts made by the seed script or dev login).
  let user = (await User.findOne({ googleId: payload.sub })) ?? (await User.findOne({ email }));
  if (user) {
    user.set({ googleId: payload.sub, email, name, fullName });
    await user.save();
    return session(res, user);
  }
  try {
    user = await User.create({ googleId: payload.sub, email, name, fullName, color: colorFor(email) });
  } catch (err) {
    // Two sign-ins racing (e.g. double click): the other request created the account first.
    if ((err as { code?: number }).code !== 11000) throw err;
    user = await User.findOne({ googleId: payload.sub });
    if (!user) throw err;
    return session(res, user);
  }
  session(res, user, 201);
}

/** Body: { email, name }. Local testing only (DEV_LOGIN=true and not production). */
export async function devLogin(req: Request, res: Response) {
  if (!DEV_LOGIN) throw new HttpError(404, 'Not found');
  const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
  const fullName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address');
  if (fullName.length > MAX_NAME_LENGTH) throw new HttpError(400, `Name must be at most ${MAX_NAME_LENGTH} characters`);

  const existing = await User.findOne({ email });
  if (existing) return session(res, existing);
  try {
    const user = await User.create({ email, name: firstName(fullName) || emailName(email), fullName, color: colorFor(email) });
    session(res, user, 201);
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    const user = await User.findOne({ email });
    if (!user) throw err;
    session(res, user);
  }
}

export function me(req: Request, res: Response) {
  res.json(authedUser(req));
}
