/*
 * Checks that production is ready for Google sign-in: the backend's settings, the MongoDB database
 * (connection, and the indexes that keep one account per email and per Google account) and,
 * optionally, the live backend.
 *
 *   npm run check:prod                                   check settings + database
 *   npm run check:prod -- --fix                          also create any missing indexes
 *   npm run check:prod -- --api https://<backend>.vercel.app/api   also check the live backend
 *
 * Reads backend/.env, so put your production values there first (the same ones as on Vercel).
 * Without --fix it only reads; it never changes or deletes user data either way.
 */
import mongoose from 'mongoose';
import { CLIENT_ORIGINS, GOOGLE_CLIENT_ID, MONGODB_DB_NAME } from '../config/constants';
import { connectDB } from '../config/db';
import { User } from '../models/User';

// Report the indexes as they really are, instead of Mongoose quietly building them on connect.
mongoose.set('autoIndex', false);

const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const apiArg = args.indexOf('--api');
const API_URL = apiArg >= 0 ? args[apiArg + 1]?.replace(/\/+$/, '') : '';

let failures = 0;
let warnings = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const warn = (msg: string) => {
  warnings++;
  console.log(`  ! ${msg}`);
};
const fail = (msg: string) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const section = (title: string) => console.log(`\n${title}`);

function checkSettings() {
  section('Backend settings (backend/.env — must match Vercel)');
  if (!GOOGLE_CLIENT_ID) fail('GOOGLE_CLIENT_ID is empty, so Google sign-in is switched off');
  else if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID))
    warn(`GOOGLE_CLIENT_ID doesn’t look like a Google client ID (…apps.googleusercontent.com): ${GOOGLE_CLIENT_ID}`);
  else ok(`GOOGLE_CLIENT_ID is set (${GOOGLE_CLIENT_ID.slice(0, 12)}…)`);

  const origins = CLIENT_ORIGINS.map(String);
  const live = origins.filter((o) => !/localhost|127\.0\.0\.1/.test(o));
  if (live.length === 0) fail('CLIENT_ORIGIN only lists localhost: add your production frontend URL');
  else ok(`CLIENT_ORIGIN allows ${live.join(', ')}`);
  for (const o of live)
    if (o.startsWith('http://')) warn(`${o} uses http://; Google sign-in needs the https:// address`);

  if (!process.env.JWT_SECRET?.trim())
    warn('JWT_SECRET is empty: sessions are signed with a key derived from MONGODB_URI, so changing the DB password signs everyone out');
  else ok('JWT_SECRET is set');
}

async function checkDatabase() {
  section(`MongoDB (database “${MONGODB_DB_NAME}”)`);
  try {
    await connectDB();
  } catch (err) {
    fail(`Couldn’t connect: ${(err as Error).message}`);
    console.log(
      '    Check in Atlas: Network Access lists 0.0.0.0/0, and the Database Access user and password match MONGODB_URI.',
    );
    return;
  }
  ok('Connected');

  const db = mongoose.connection.db!;
  const users = db.collection('users');
  const hasUsers = (await db.listCollections({ name: 'users' }).toArray()).length > 0;
  const count = hasUsers ? await users.countDocuments() : 0;
  const googleCount = hasUsers ? await users.countDocuments({ googleId: { $exists: true, $ne: null } }) : 0;
  ok(`${count} user(s), ${googleCount} with Google sign-in`);
  if (count === 0)
    warn(`No users in “${MONGODB_DB_NAME}”. If your app already has users, MONGODB_DB_NAME may point at the wrong database`);

  // Data that would stop the unique indexes from being built.
  const dupes = async (field: string) =>
    hasUsers
      ? users
          .aggregate<{ _id: string; n: number }>([
            { $match: { [field]: { $type: 'string' } } },
            { $group: { _id: `$${field}`, n: { $sum: 1 } } },
            { $match: { n: { $gt: 1 } } },
            { $limit: 5 },
          ])
          .toArray()
      : [];
  const dupeEmails = await dupes('email');
  if (dupeEmails.length) fail(`Several accounts share an email: ${dupeEmails.map((d) => d._id).join(', ')}`);
  const dupeGoogle = await dupes('googleId');
  if (dupeGoogle.length) fail(`${dupeGoogle.length} Google account(s) are linked to more than one user`);
  // A sparse index skips users without a googleId, but not ones storing googleId: null.
  const nullGoogle = hasUsers ? await users.countDocuments({ googleId: { $type: 'null' } }) : 0;
  if (nullGoogle > 1) fail(`${nullGoogle} users store googleId: null, which clashes in the unique index. Remove that field from them`);
  const blocked = dupeEmails.length > 0 || dupeGoogle.length > 0 || nullGoogle > 1;

  const indexes = hasUsers ? await users.indexes() : [];
  const find = (field: string) => indexes.find((i) => Object.keys(i.key).length === 1 && field in i.key);
  const emailIdx = find('email');
  const googleIdx = find('googleId');
  const problems: string[] = [];

  if (emailIdx?.unique) ok('Index on email is unique (one account per email)');
  else problems.push(emailIdx ? 'The email index isn’t unique' : 'No unique index on email');

  if (googleIdx?.unique && googleIdx.sparse) ok('Index on googleId is unique + sparse (one account per Google account)');
  else if (googleIdx?.unique) problems.push('The googleId index is unique but not sparse, so only one password-only user could exist');
  else problems.push(googleIdx ? 'The googleId index isn’t unique' : 'No unique + sparse index on googleId');

  if (problems.length === 0) return;
  if (!FIX) {
    for (const p of problems) fail(`${p}. Run again with --fix to create it`);
    return;
  }
  if (blocked) {
    for (const p of problems) fail(`${p}. Fix the data problems above first, then run --fix again`);
    return;
  }
  // Wrong-shaped indexes have to go before the right ones can take their name.
  for (const idx of [emailIdx, googleIdx])
    if (idx?.name && !(idx.unique && (idx === emailIdx || idx.sparse))) {
      await users.dropIndex(idx.name);
      console.log(`    dropped the old ${idx.name} index`);
    }
  try {
    await User.createIndexes();
    ok('Created the missing indexes');
  } catch (err) {
    fail(`Couldn’t create indexes: ${(err as Error).message}`);
    console.log('    The Atlas database user needs the readWrite role on this database.');
  }
}

async function checkLiveApi() {
  if (!API_URL) return;
  section(`Live backend (${API_URL})`);
  const get = async (path: string, headers: Record<string, string> = {}) => {
    const res = await fetch(`${API_URL}${path}`, { headers, signal: AbortSignal.timeout(15_000) });
    return { res, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
  };
  try {
    const health = await get('/health');
    if (health.body?.db === 'connected' || health.body?.db === 'disconnected') ok(`Reachable (/health says db: ${health.body.db})`);
    else fail(`/health answered ${health.res.status} with unexpected content: is ${API_URL} the backend’s /api URL?`);

    const config = await get('/auth/config');
    const live = config.body?.googleClientId;
    if (!live) fail('Google sign-in is off on the live backend: set GOOGLE_CLIENT_ID on Vercel and redeploy');
    else if (GOOGLE_CLIENT_ID && live !== GOOGLE_CLIENT_ID) fail(`The live backend uses a different GOOGLE_CLIENT_ID (${String(live).slice(0, 12)}…)`);
    else ok('Google sign-in is on');

    for (const origin of CLIENT_ORIGINS.filter((o): o is string => typeof o === 'string' && !/localhost/.test(o))) {
      const { res } = await get('/auth/config', { Origin: origin });
      if (res.headers.get('access-control-allow-origin') === origin) ok(`Accepts requests from ${origin}`);
      else fail(`Rejects requests from ${origin}: set CLIENT_ORIGIN on Vercel to include it and redeploy`);
    }
  } catch (err) {
    fail(`Couldn’t reach it: ${(err as Error).message}`);
  }
}

async function main() {
  checkSettings();
  await checkDatabase();
  await checkLiveApi();
  console.log(
    failures
      ? `\n${failures} problem(s) to fix${warnings ? `, ${warnings} warning(s)` : ''}.`
      : `\nReady for Google sign-in${warnings ? ` (${warnings} warning(s))` : ''}.`,
  );
  if (failures) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('Check failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
