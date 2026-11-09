/*
 * Google sign-in, as specced in specs/auth/google-sign-in-prod/SPEC.md.
 *
 * The real backend verifies every token exactly as in production, except that it fetches Google's public
 * signing keys from a local stand-in (GOOGLE_CERTS_URL), so these tests can sign their own Google tokens.
 * In the browser tests, Google's button script is swapped for a tiny fake that hands over such a token.
 */
import { execFile } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MongoClient } from 'mongodb';
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import {
  api,
  apiUrl,
  appUrl,
  expect,
  googleApiUrl,
  googleClientId,
  googleSignIn,
  googleToken,
  launchBrowser,
  mongoUri,
  newVisitor,
  signUp,
  uniqueEmail,
} from '../setup/helpers';

let browser: Browser;
let mongo: MongoClient;
beforeAll(async () => {
  browser = await launchBrowser();
  mongo = await new MongoClient(mongoUri()).connect();
});
afterAll(async () => {
  await browser?.close();
  await mongo?.close();
});

const users = () => mongo.db('rmg-e2e').collection('users');
const userId = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub as string;

describe('the login page', () => {
  test('the Google backend tells the login page its client ID', async () => {
    const res = await fetch(`${googleApiUrl()}/auth/config`);
    expect(await res.json()).toEqual({ googleClientId: googleClientId() });
  });

  /** Points the login page at the Google-enabled backend and replaces Google's script with a fake button. */
  async function withGoogle(page: Page, credential: () => string) {
    await page.route(`${apiUrl()}/auth/config`, (route) => route.fulfill({ json: { googleClientId: googleClientId() } }));
    await page.route(`${apiUrl()}/auth/google`, async (route) =>
      route.fulfill({ response: await route.fetch({ url: `${googleApiUrl()}/auth/google` }) }),
    );
    await page.exposeFunction('testCredential', credential);
    await page.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `window.google = { accounts: { id: {
          initialize(o) { window.__gis = o; },
          renderButton(el) {
            const b = document.createElement('button');
            b.textContent = 'Sign in with Google';
            b.onclick = async () => window.__gis.callback({ credential: await window.testCredential() });
            el.appendChild(b);
          },
        } } };`,
      }),
    );
  }

  test('a new student signs in with Google in one click and sees their first name', async () => {
    const visitor = await newVisitor(browser, 'Visitor');
    const email = uniqueEmail('newgoogle');
    await withGoogle(visitor.page, () => googleToken({ email, given_name: 'Priya', name: 'Priya Patel' }));
    await visitor.page.goto(appUrl());

    await expect(visitor.page.getByRole('tab', { name: 'Sign in' })).toBeVisible(); // password sign-in still offered
    await visitor.page.getByRole('button', { name: 'Sign in with Google' }).click();

    await expect(visitor.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
    await expect(visitor.page.getByText('Hi Priya')).toBeVisible();
    await expect(visitor.page.locator('.current-member')).toContainText(email);
  });

  test('when a blocker stops Google’s script, the page says so and password sign-in still works', async () => {
    const visitor = await newVisitor(browser, 'Blocked');
    await withGoogle(visitor.page, () => googleToken());
    await visitor.page.route('https://accounts.google.com/gsi/client', (route) => route.abort('blockedbyclient'));
    await visitor.page.goto(appUrl());

    await expect(visitor.page.getByText(/Couldn’t load Google sign-in/)).toBeVisible();
    await signUp(visitor);
    await expect(visitor.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
  });
});

describe('new users', () => {
  test('first Google sign-in creates exactly one account, with the Google first name', async () => {
    const email = uniqueEmail('first');
    const sub = `g-${randomUUID()}`;
    const res = await googleSignIn(googleToken({ sub, email, given_name: 'Mateo', name: 'Mateo Cruz' }));

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, name: 'Mateo', fullName: 'Mateo Cruz' });
    expect(res.body.user.googleId).toBeUndefined(); // never sent to clients
    const docs = await users().find({ email }).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].googleId).toBe(sub);
  });

  test('signing in again, e.g. on another device, lands in the same account', async () => {
    const claims = { sub: `g-${randomUUID()}`, email: uniqueEmail('again') };
    const first = await googleSignIn(googleToken(claims));
    const second = await googleSignIn(googleToken(claims));

    expect(second.status).toBe(200);
    expect(userId(second.body.token)).toBe(userId(first.body.token));
    expect(await users().countDocuments({ email: claims.email })).toBe(1);
  });

  test('a double click (two sign-ins at once) still makes one account', async () => {
    const claims = { sub: `g-${randomUUID()}`, email: uniqueEmail('double') };
    const results = await Promise.all([googleSignIn(googleToken(claims)), googleSignIn(googleToken(claims))]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await users().countDocuments({ email: claims.email })).toBe(1);
  });

  test('a Google session works everywhere in the app (same sessions as password sign-in)', async () => {
    const { body } = await googleSignIn(googleToken());
    const me = await api(body.token, 'GET', '/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(body.user.email);
  });

  test('a Google-only account can’t sign in with a password', async () => {
    const email = uniqueEmail('googleonly');
    await googleSignIn(googleToken({ email }));
    const res = await api(null, 'POST', '/auth/login', { email, password: 'any-password-1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('This account was set up with Google sign-in');
  });
});

describe('existing email + password accounts', () => {
  test('Google sign-in with the same email opens the existing account, groups included, and the password still works', async () => {
    const email = uniqueEmail('existing');
    const password = 'my-own-password-1';
    const reg = await api(null, 'POST', '/auth/register', { name: 'Dana Lee', email, password });
    const group = await api(reg.body.token, 'POST', '/teams', { name: 'Linked group', course: 'INF 151', emails: [uniqueEmail('mate')] });
    expect(group.status).toBe(201);

    // Different capitalisation from Google: still the same person.
    const res = await googleSignIn(googleToken({ email: email.toUpperCase(), given_name: 'Dana' }));
    expect(res.status).toBe(200);
    expect(userId(res.body.token)).toBe(userId(reg.body.token));
    expect(await users().countDocuments({ email })).toBe(1);

    const teams = await api(res.body.token, 'GET', '/teams');
    expect(teams.body.map((t: { id: string }) => t.id)).toContain(group.body.id);

    expect((await api(null, 'POST', '/auth/login', { email, password })).status).toBe(200);
  });
});

describe('invites', () => {
  test('an invite sent to an email shows up when that person first signs in with Google', async () => {
    const owner = await api(null, 'POST', '/auth/register', { name: 'Owner', email: uniqueEmail('owner'), password: 'owner-password-1' });
    const inviteeEmail = uniqueEmail('invitee');
    const group = await api(owner.body.token, 'POST', '/teams', { name: 'Invite group', course: 'INF 151', emails: [inviteeEmail] });

    const res = await googleSignIn(googleToken({ email: inviteeEmail }));
    const teams = await api(res.body.token, 'GET', '/teams');
    expect(teams.body).toEqual([expect.objectContaining({ id: group.body.id, todo: 'accept' })]);
  });
});

describe('rejected sign-ins', () => {
  test('an email Google hasn’t verified can’t sign in or take over an account', async () => {
    const email = uniqueEmail('unverified');
    await api(null, 'POST', '/auth/register', { name: 'Victim', email, password: 'victim-password-1' });

    const res = await googleSignIn(googleToken({ email, email_verified: false }));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Verify your email with Google first, then sign in again');
    expect((await users().findOne({ email }))?.googleId).toBeUndefined();
  });

  test('tokens that aren’t genuine Google tokens for this app are refused', async () => {
    const forgedKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const bad = [
      googleToken({ aud: 'someone-elses-app.apps.googleusercontent.com' }),
      googleToken({ iss: 'https://evil.example' }),
      googleToken({ exp: Math.floor(Date.now() / 1000) - 600 }),
      googleToken({}, forgedKey),
      'not-a-token',
    ];
    for (const credential of bad) {
      const res = await googleSignIn(credential);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Couldn’t verify your Google sign-in. Please try again');
    }
    expect((await googleSignIn('')).status).toBe(400);
  });
});

describe('the production check script', () => {
  const backend = resolve(dirname(fileURLToPath(import.meta.url)), '../../backend');
  const check = (dbName: string, args: string[] = [], env: Record<string, string> = {}) =>
    promisify(execFile)(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/scripts/checkProduction.ts', ...args], {
      cwd: backend,
      env: {
        ...process.env,
        MONGODB_URI: mongoUri(),
        MONGODB_DB_NAME: dbName,
        GOOGLE_CLIENT_ID: googleClientId(),
        CLIENT_ORIGIN: 'https://rmg.example.app',
        JWT_SECRET: 'a-long-random-secret',
        ...env,
      },
    }).then(
      ({ stdout }) => ({ code: 0, stdout }),
      (err: { code: number; stdout: string }) => ({ code: err.code, stdout: err.stdout }),
    );

  test('finds missing indexes, creates them with --fix, then reports ready', async () => {
    const dbName = `rmg-check-${randomUUID().slice(0, 8)}`;
    // An older database: users exist but the googleId index was never built.
    await mongo.db(dbName).collection('users').insertOne({ email: 'old@test.dev', name: 'Old' });

    const before = await check(dbName);
    expect(before.code).toBe(1);
    expect(before.stdout).toContain('No unique + sparse index on googleId');

    const fixed = await check(dbName, ['--fix']);
    expect(fixed.stdout).toContain('Created the missing indexes');

    const after = await check(dbName);
    expect(after.code).toBe(0);
    expect(after.stdout).toContain('Index on googleId is unique + sparse');
    expect(after.stdout).toContain('Ready for Google sign-in');
    const idx = (await mongo.db(dbName).collection('users').indexes()).find((i) => 'googleId' in i.key);
    expect(idx).toMatchObject({ unique: true, sparse: true });
  });

  test('flags settings that would break Google sign-in', async () => {
    const res = await check(`rmg-check-${randomUUID().slice(0, 8)}`, [], { GOOGLE_CLIENT_ID: '', CLIENT_ORIGIN: 'http://localhost:5173' });
    expect(res.code).toBe(1);
    expect(res.stdout).toContain('GOOGLE_CLIENT_ID is empty');
    expect(res.stdout).toContain('CLIENT_ORIGIN only lists localhost');
  });

  test('checks the live backend with --api', async () => {
    const on = await check('rmg-e2e', ['--api', googleApiUrl()]);
    expect(on.stdout).toContain('Google sign-in is on');

    const off = await check('rmg-e2e', ['--api', apiUrl()]);
    expect(off.code).toBe(1);
    expect(off.stdout).toContain('Google sign-in is off on the live backend');
  });
});
