import { execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import {
  api,
  apiUrl,
  appUrl,
  expect,
  launchBrowser,
  mongoUri,
  newUser,
  newVisitor,
  signIn,
  signUp,
  uniqueEmail,
  useAccountMenu,
} from '../setup/helpers';

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

const register = (email: string, password: string, name = 'Api Person') =>
  api(null, 'POST', '/auth/register', { name, email, password });
const login = (email: string, password: string) => api(null, 'POST', '/auth/login', { email, password });

describe('creating an account', () => {
  test('a signed-out visitor sees the login page, not the app', async () => {
    const visitor = await newVisitor(browser, 'Visitor');
    await visitor.page.goto(appUrl());

    await expect(visitor.page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
    await expect(visitor.page.getByRole('tab', { name: 'Create account' })).toBeVisible();
    await expect(visitor.page.getByRole('heading', { name: 'Your groups' })).toHaveCount(0);
  });

  test('signing up signs you in, showing your first name and email in the header', async () => {
    const zahi = await newUser(browser, 'Zahi');

    await expect(zahi.page.getByText('Hi Zahi')).toBeVisible();
    await expect(zahi.page.locator('.current-member')).toContainText('Zahi');
    await expect(zahi.page.locator('.current-member')).toContainText(zahi.email);
  });

  test('the form catches a missing name, bad email, short password and password = email', async () => {
    const visitor = await newVisitor(browser, 'Typo');
    const { page } = visitor;
    await page.goto(appUrl());
    await page.getByRole('tab', { name: 'Create account' }).click();
    const submit = page.getByRole('button', { name: 'Create account' });

    await page.getByLabel('Email').fill(visitor.email);
    await page.getByLabel('Password').fill('long-enough-pw');
    await submit.click();
    await expect(page.getByText('Enter your name')).toBeVisible();

    await page.getByLabel('Name').fill('Typo Person');
    await page.getByLabel('Email').fill('not-an-email');
    await submit.click();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();

    await page.getByLabel('Email').fill(visitor.email);
    await page.getByLabel('Password').fill('short');
    await submit.click();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

    await page.getByLabel('Password').fill(visitor.email);
    await submit.click();
    await expect(page.getByText('Your password can’t be your email')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Your groups' })).toHaveCount(0);
  });

  test('an email can only have one account', async () => {
    const first = await newUser(browser, 'First');
    const second = await newVisitor(browser, 'Second');
    second.email = first.email;
    await second.page.goto(appUrl());
    await signUp(second);

    await expect(second.page.getByText('An account with this email already exists. Sign in instead')).toBeVisible();
  });

  test('emails are case-insensitive', async () => {
    const email = uniqueEmail('mixed');
    expect((await register(email.toUpperCase(), 'long-enough-pw')).status).toBe(201);
    expect((await login(email, 'long-enough-pw')).status).toBe(200);
    expect((await register(email, 'another-password')).status).toBe(409);
  });

  test('the server enforces the same rules as the form', async () => {
    const email = uniqueEmail('rules');
    expect((await register(email, 'short')).body.message).toBe('Password must be at least 8 characters');
    expect((await register(email, email)).body.message).toBe('Your password can’t be your email');
    expect((await register(email, 'x'.repeat(73))).body.message).toBe('Password must be at most 72 characters');
    expect((await register('nope', 'long-enough-pw')).body.message).toBe('Enter a valid email address');
    expect((await register(email, 'long-enough-pw', '  ')).body.message).toBe('Enter your name');
  });
});

describe('signing in', () => {
  test('you can sign back in with your email and password', async () => {
    const kent = await newUser(browser, 'Kent');
    await useAccountMenu(kent.page, 'Sign out');

    await signIn(kent);
    await expect(kent.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
  });

  test('a wrong password and an unknown email get the same message', async () => {
    const kent = await newUser(browser, 'Kent');
    await useAccountMenu(kent.page, 'Sign out');

    await signIn(kent, 'wrong-password');
    await expect(kent.page.getByText('Wrong email or password')).toBeVisible();

    kent.email = uniqueEmail('nobody');
    await signIn(kent);
    await expect(kent.page.getByText('Wrong email or password')).toBeVisible();
    await expect(kent.page.getByRole('heading', { name: 'Your groups' })).toHaveCount(0);
  });

  test('the login page explains what to do about a forgotten password', async () => {
    const visitor = await newVisitor(browser, 'Forgetful');
    await visitor.page.goto(appUrl());
    await expect(visitor.page.getByText('Forgot your password? Ask the project team to reset it.')).toBeVisible();
  });

  test('you stay signed in after a reload', async () => {
    const kent = await newUser(browser, 'Kent');
    await kent.page.reload();

    await expect(kent.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
  });

  test('signing out returns to the login page and forgets the session', async () => {
    const omar = await newUser(browser, 'Omar');
    await useAccountMenu(omar.page, 'Sign out');

    await expect(omar.page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
    await omar.page.reload();
    await expect(omar.page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  });

  test('a broken or forged session sends you back to login with a message', async () => {
    const qitai = await newUser(browser, 'Qitai');
    await qitai.page.evaluate(() => localStorage.setItem('rmg-session-v1', JSON.stringify('forged.token.value')));
    await qitai.page.reload();

    await expect(qitai.page.getByText('Please sign in again')).toBeVisible();
    await expect(qitai.page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  });

  test('10 wrong passwords lock the account for 15 minutes, even for the right password', async () => {
    const email = uniqueEmail('locked');
    await register(email, 'the-right-password');

    for (let i = 1; i <= 9; i++) expect((await login(email, `wrong-${i}`)).status).toBe(401);
    const tenth = await login(email, 'wrong-10');
    expect(tenth.status).toBe(429);
    expect(tenth.body.message).toMatch(/^Too many wrong passwords\. Try again in 15 minutes/);

    const right = await login(email, 'the-right-password');
    expect(right.status).toBe(429);
  });

  test('a successful sign-in resets the wrong-password count', async () => {
    const email = uniqueEmail('reset');
    await register(email, 'the-right-password');

    for (let i = 1; i <= 9; i++) await login(email, `wrong-${i}`);
    expect((await login(email, 'the-right-password')).status).toBe(200);
    for (let i = 1; i <= 9; i++) expect((await login(email, `wrong-again-${i}`)).status).toBe(401);
  });
});

describe('your account', () => {
  test('you can change your password; the old one stops working', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    await useAccountMenu(page, 'Settings');

    await page.getByLabel('Current password').fill('not-my-password');
    await page.getByLabel('New password', { exact: true }).fill('brand-new-password');
    await page.getByLabel('Confirm new password').fill('brand-new-password');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Your current password is wrong')).toBeVisible();

    await page.getByLabel('Current password').fill(kent.password);
    await page.getByLabel('Confirm new password').fill('does-not-match');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('The new passwords don’t match')).toBeVisible();

    await page.getByLabel('Confirm new password').fill('brand-new-password');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Password changed')).toBeVisible();

    expect((await login(kent.email, kent.password)).status).toBe(401);
    expect((await login(kent.email, 'brand-new-password')).status).toBe(200);
  });

  test('changing your password keeps you signed in here but signs out your other devices', async () => {
    const kent = await newUser(browser, 'Kent');
    const otherDevice = await login(kent.email, kent.password);
    expect((await api(otherDevice.body.token, 'GET', '/auth/me')).status).toBe(200);

    await useAccountMenu(kent.page, 'Settings');
    await kent.page.getByLabel('Current password').fill(kent.password);
    await kent.page.getByLabel('New password', { exact: true }).fill('brand-new-password');
    await kent.page.getByLabel('Confirm new password').fill('brand-new-password');
    await kent.page.getByRole('button', { name: 'Change password' }).click();
    await expect(kent.page.getByText('Password changed')).toBeVisible();

    expect((await api(otherDevice.body.token, 'GET', '/auth/me')).status).toBe(401);
    await kent.page.goto(appUrl());
    await expect(kent.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
  });

  test('the reset script sets a new password for someone who forgot theirs', async () => {
    const email = uniqueEmail('forgot');
    await register(email, 'forgotten-password');
    const backend = resolve(dirname(fileURLToPath(import.meta.url)), '../../backend');

    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'src/scripts/resetPassword.ts', email, 'fresh-password-1'],
      { cwd: backend, env: { ...process.env, MONGODB_URI: mongoUri(), MONGODB_DB_NAME: 'rmg-e2e' } },
    );
    expect(stdout).toContain(`Password reset for ${email}`);

    expect((await login(email, 'forgotten-password')).status).toBe(401);
    expect((await login(email, 'fresh-password-1')).status).toBe(200);
  });
});

describe('the API protects accounts', () => {
  test('passwords are never sent back, not even hashed', async () => {
    const email = uniqueEmail('secret');
    const created = await register(email, 'super-secret-pw');
    expect(created.status).toBe(201);
    const me = await api(created.body.token, 'GET', '/auth/me');
    expect(me.status).toBe(200);
    const text = JSON.stringify([created.body, me.body]);

    expect(text).not.toContain('super-secret-pw');
    expect(text).not.toMatch(/password|\$2[aby]\$/i);
  });

  test('no token → 401', async () => {
    const res = await api(null, 'GET', '/teams');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Please sign in');
  });

  test('forged token → 401', async () => {
    const res = await api('forged.token.value', 'GET', '/teams');
    expect(res.status).toBe(401);
  });

  test('without JWT_SECRET, sessions still can’t be forged with a guessable secret', async () => {
    const real = await register(uniqueEmail('target'), 'long-enough-pw');
    expect(real.status).toBe(201);
    const userId = JSON.parse(Buffer.from(real.body.token.split('.')[1], 'base64url').toString()).sub;

    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forge = (secret: string) => {
      const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ v: 0, sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
      return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
    };
    for (const guess of ['', 'secret', 'dev-only-secret', 'e2e-secret', 'undefined', mongoUri()])
      expect((await api(forge(guess), 'GET', '/auth/me')).status).toBe(401);
    expect((await api(real.body.token, 'GET', '/auth/me')).status).toBe(200);
  });

  test('the old no-password test login is gone', async () => {
    const res = await api(null, 'POST', '/auth/dev', { email: uniqueEmail('x'), name: 'X' });
    expect(res.status).toBe(404);
  });

  test('Google sign-in is switched off until GOOGLE_CLIENT_ID is set', async () => {
    const res = await api(null, 'POST', '/auth/google', { credential: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/GOOGLE_CLIENT_ID/);

    const visitor = await newVisitor(browser, 'Visitor');
    await visitor.page.goto(appUrl());
    await expect(visitor.page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
    await expect(visitor.page.locator('.google-button')).toHaveCount(0);
  });

  test('malformed JSON is a 400, not a server crash', async () => {
    const res = await fetch(`${apiUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    expect(res.status).toBe(400);
  });
});
