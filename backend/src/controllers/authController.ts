import type { Request, Response } from 'express';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { GOOGLE_CERTS_URL, GOOGLE_CLIENT_ID, LOCKOUT_ATTEMPTS, LOCKOUT_MINUTES, MAX_NAME_LENGTH } from '../config/constants';
import { checkPassword, hashPassword, passwordProblem } from '../lib/password';
import { colorFor, emailName, firstName, isEmail, normalizeEmail } from '../lib/util';
import { authedUser, signSession } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { User, type UserDoc } from '../models/User';

const google = new OAuth2Client(
  GOOGLE_CERTS_URL ? { endpoints: { oauth2FederatedSignonPemCertsUrl: GOOGLE_CERTS_URL } } : undefined,
);
const LOCKOUT_MS = LOCKOUT_MINUTES * 60_000;
const WRONG_LOGIN = 'Wrong email or password';

/** What the login page needs to know. Google sign-in only shows when GOOGLE_CLIENT_ID is set. */
export function authConfig(_req: Request, res: Response) {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null });
}

function session(res: Response, user: UserDoc, status = 200) {
  res.status(status).json({ token: signSession(user), user });
}

const bodyString = (req: Request, key: string) => (typeof req.body?.[key] === 'string' ? (req.body[key] as string) : '');

function lockedMessage(until: Date) {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

// ---------- email + password ----------

/** Body: { name, email, password }. Creates the account and signs you in. */
export async function register(req: Request, res: Response) {
  const fullName = bodyString(req, 'name').trim();
  const email = normalizeEmail(bodyString(req, 'email'));
  const password = req.body?.password;

  if (!fullName) throw new HttpError(400, 'Enter your name');
  if (fullName.length > MAX_NAME_LENGTH) throw new HttpError(400, `Name must be at most ${MAX_NAME_LENGTH} characters`);
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address');
  const problem = passwordProblem(password, email);
  if (problem) throw new HttpError(400, problem);

  const taken = new HttpError(409, 'An account with this email already exists. Sign in instead');
  if (await User.exists({ email })) throw taken;
  try {
    const user = await User.create({
      email,
      name: firstName(fullName) || emailName(email),
      fullName,
      color: colorFor(email),
      passwordHash: await hashPassword(password as string),
    });
    session(res, user, 201);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw taken; // two sign-ups racing for the same email
    throw err;
  }
}

/**
 * Body: { email, password }. Unknown email and wrong password get the same message, so the form
 * doesn't reveal who has an account. LOCKOUT_ATTEMPTS wrong passwords within LOCKOUT_MINUTES
 * lock the account for LOCKOUT_MINUTES (checked before the password, so guessing stops working).
 */
export async function login(req: Request, res: Response) {
  const email = normalizeEmail(bodyString(req, 'email'));
  const password = bodyString(req, 'password');
  if (!email || !password) throw new HttpError(400, 'Enter your email and password');

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw new HttpError(401, WRONG_LOGIN);
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw new HttpError(429, lockedMessage(user.lockedUntil));
  if (!user.passwordHash) throw new HttpError(401, 'This account was set up with Google sign-in');

  if (await checkPassword(password, user.passwordHash)) {
    if (user.failedLogins || user.lockedUntil)
      await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, failedLoginsSince: null, lockedUntil: null } });
    return session(res, user);
  }

  // Wrong password: count it atomically (parallel guesses can't slip past), starting a new window if the old one expired.
  const now = new Date();
  await User.updateOne(
    { _id: user._id, $or: [{ failedLoginsSince: null }, { failedLoginsSince: { $lt: new Date(now.getTime() - LOCKOUT_MS) } }] },
    { $set: { failedLogins: 0, failedLoginsSince: now } },
  );
  const counted = await User.findOneAndUpdate({ _id: user._id }, { $inc: { failedLogins: 1 } }, { new: true });
  if ((counted?.failedLogins ?? 0) >= LOCKOUT_ATTEMPTS) {
    const until = new Date(now.getTime() + LOCKOUT_MS);
    await User.updateOne({ _id: user._id }, { $set: { lockedUntil: until, failedLogins: 0, failedLoginsSince: null } });
    throw new HttpError(429, lockedMessage(until));
  }
  throw new HttpError(401, WRONG_LOGIN);
}

/**
 * Body: { currentPassword, newPassword }. Signs out every other session (their tokens carry the
 * old session version) and returns a fresh session for this one.
 */
export async function changePassword(req: Request, res: Response) {
  const me = authedUser(req);
  const currentPassword = bodyString(req, 'currentPassword');
  const newPassword = req.body?.newPassword;

  const user = await User.findById(me._id).select('+passwordHash');
  if (!user) throw new HttpError(401, 'Your account no longer exists. Please sign in again');
  if (!user.passwordHash) throw new HttpError(400, 'This account uses Google sign-in, so it has no password to change');
  if (!currentPassword || !(await checkPassword(currentPassword, user.passwordHash)))
    throw new HttpError(400, 'Your current password is wrong');
  const problem = passwordProblem(newPassword, user.email);
  if (problem) throw new HttpError(400, problem);
  if (newPassword === currentPassword) throw new HttpError(400, 'Your new password is the same as your current one');

  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(newPassword as string) }, $inc: { sessionVersion: 1 } },
    { new: true },
  );
  if (!updated) throw new HttpError(401, 'Your account no longer exists. Please sign in again');
  session(res, updated);
}

export function me(req: Request, res: Response) {
  res.json(authedUser(req));
}

// ---------- Google (off unless GOOGLE_CLIENT_ID is set) ----------

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

  // Match on the Google account first, then on email (an existing email + password account).
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
