import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { api, apiUrl, appUrl, expect, launchBrowser, newUser, newVisitor, signIn } from '../setup/helpers';

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

describe('signing in', () => {
  test('a signed-out visitor sees the login page, not the app', async () => {
    const visitor = await newVisitor(browser, 'Visitor');
    await visitor.page.goto(appUrl());

    await expect(visitor.page.getByText('Rate your teammates after a group project.')).toBeVisible();
    await expect(visitor.page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(visitor.page.getByRole('heading', { name: 'Your groups' })).toHaveCount(0);
  });

  test('signing in shows your first name and email in the header', async () => {
    const zahi = await newUser(browser, 'Zahi');

    await expect(zahi.page.getByText('Hi Zahi')).toBeVisible();
    await expect(zahi.page.locator('.current-member')).toContainText('Zahi');
    await expect(zahi.page.locator('.current-member')).toContainText(zahi.email);
  });

  test('an invalid email is rejected before anything is sent', async () => {
    const visitor = await newVisitor(browser, 'Typo');
    await visitor.page.goto(appUrl());
    await visitor.page.getByLabel('Email').fill('not-an-email');
    await visitor.page.getByRole('button', { name: 'Sign in' }).click();

    await expect(visitor.page.getByText('Enter a valid email address')).toBeVisible();
  });

  test('you stay signed in after a reload', async () => {
    const kent = await newUser(browser, 'Kent');
    await kent.page.reload();

    await expect(kent.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
  });

  test('signing out returns to the login page and forgets the session', async () => {
    const omar = await newUser(browser, 'Omar');
    await omar.page.getByRole('button', { name: 'Sign out' }).click();

    await expect(omar.page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await omar.page.reload();
    await expect(omar.page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('a broken or forged session sends you back to login with a message', async () => {
    const qitai = await newUser(browser, 'Qitai');
    await qitai.page.evaluate(() => localStorage.setItem('rmg-session-v1', JSON.stringify('forged.token.value')));
    await qitai.page.reload();

    await expect(qitai.page.getByText('Please sign in again')).toBeVisible();
    await expect(qitai.page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('signing in again with the same email is the same account', async () => {
    const first = await newUser(browser, 'Repeat');
    const before = await api(await first.token(), 'GET', '/auth/me');

    const again = await newVisitor(browser, 'Repeat');
    again.email = first.email;
    await again.page.goto(appUrl());
    await signIn(again);
    await expect(again.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();

    const me = await api(await again.token(), 'GET', '/auth/me');
    expect(me.body.id).toBe(before.body.id);
  });
});

describe('the API refuses requests without a valid session', () => {
  test('no token → 401', async () => {
    const res = await api(null, 'GET', '/teams');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Please sign in');
  });

  test('forged token → 401', async () => {
    const res = await api('forged.token.value', 'GET', '/teams');
    expect(res.status).toBe(401);
  });

  test('Google sign-in without Google configured explains what is missing', async () => {
    const res = await api(null, 'POST', '/auth/google', { credential: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/GOOGLE_CLIENT_ID/);
  });

  test('malformed JSON is a 400, not a server crash', async () => {
    const res = await fetch(`${apiUrl()}/auth/dev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    expect(res.status).toBe(400);
  });
});
