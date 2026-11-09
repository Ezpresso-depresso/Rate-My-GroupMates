/* Shared helpers: fresh browser users, the app's URLs, and direct API calls for permission checks. */
import { createSign, randomUUID } from 'node:crypto';
import { chromium, expect as pwExpect, type Browser, type BrowserContext, type Page } from 'playwright/test';
import { inject } from 'vitest';

export const appUrl = () => inject('appUrl');
export const mongoUri = () => inject('mongoUri');
export const apiUrl = () => inject('apiUrl');
export { pwExpect as expect };

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: !process.env.HEADED });
}

export interface TestUser {
  name: string;
  email: string;
  password: string;
  context: BrowserContext;
  page: Page;
  /** The session token the app stored after sign-in. */
  token: () => Promise<string>;
}

/** Unique per test run, so tests never see each other's groups. */
export const uniqueEmail = (name: string) => `${name.toLowerCase()}.${randomUUID().slice(0, 8)}@test.dev`;

/** A brand-new person in their own browser context (separate localStorage), not signed in yet. */
export async function newVisitor(browser: Browser, name: string): Promise<TestUser> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept()); // confirm() prompts: always say yes
  const email = uniqueEmail(name);
  return {
    name,
    email,
    password: `pw-${randomUUID().slice(0, 12)}`,
    context,
    page,
    token: async () => JSON.parse((await page.evaluate(() => localStorage.getItem('rmg-session-v1'))) ?? 'null'),
  };
}

/** Creates an account through the "Create account" tab of the login page that's open. */
export async function signUp(user: TestUser) {
  const { page } = user;
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Name').fill(`${user.name} Testerson`);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
}

/** Signs in to an existing account through the "Sign in" tab of the login page that's open. */
export async function signIn(user: TestUser, password = user.password) {
  const { page } = user;
  await page.getByRole('tab', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** A new person with a fresh account, signed in, on the home page. */
export async function newUser(browser: Browser, name: string): Promise<TestUser> {
  const user = await newVisitor(browser, name);
  await user.page.goto(appUrl());
  await signUp(user);
  await pwExpect(user.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
  return user;
}

export interface Group {
  id: string;
  url: string;
  joinUrl: string;
  code: string;
}

/** Creates a group through the UI and returns where it lives and its invite code. */
export async function createGroup(owner: TestUser, name: string, invitees: TestUser[], course = 'INF 151'): Promise<Group> {
  const { page } = owner;
  await page.goto(`${appUrl()}/groups/new`);
  await page.getByLabel('Group name').fill(name);
  await page.getByLabel('Course').fill(course);
  await page.getByLabel('Teammates’ emails').fill(invitees.map((u) => u.email).join('\n'));
  await page.getByRole('button', { name: /^Create group/ }).click();
  await pwExpect(page.getByText(/Waiting room/i)).toBeVisible();
  const url = page.url();
  const id = url.split('/').pop()!;
  return { id, url, joinUrl: `${appUrl()}/join/${id}`, code: await page.getByLabel('Invite code').inputValue() };
}

/** Opens the invite link and enters the code. */
export async function joinGroup(user: TestUser, group: Group, code = group.code) {
  await user.page.goto(group.joinUrl);
  await user.page.getByLabel('Invite code').fill(code);
  await user.page.getByRole('button', { name: 'Join group' }).click();
}

/** Calls the backend directly, as the given user (or signed out). */
export async function api(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${apiUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Fills in a complete review for whichever teammate is on screen. */
export async function rateCurrentTeammate(page: Page, stars: number, score: number) {
  await page.getByRole('button', { name: `${stars} out of 5 stars` }).click();
  for (const category of ['Participation', 'Communication', 'Quality']) {
    await page.getByRole('button', { name: new RegExp(`^${category}.*: ${score} out of 10$`) }).click();
  }
}

/** Hovers the name/avatar pill in the header to show the account menu, then picks an item. */
export async function useAccountMenu(page: Page, item: 'Settings' | 'Sign out') {
  await page.getByRole('link', { name: 'Your profile' }).hover();
  if (item === 'Sign out') await page.getByRole('button', { name: 'Sign out' }).click();
  else await page.getByRole('link', { name: item }).click();
}

// ---------- Google sign-in (against the second backend, which has GOOGLE_CLIENT_ID set) ----------

export const googleApiUrl = () => inject('googleApiUrl');
export const googleClientId = () => inject('googleClientId');

export interface GoogleClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  aud?: string;
  iss?: string;
  exp?: number;
}

/** An ID token shaped like the one Google's button hands the app, signed with the test key. */
export function googleToken(claims: GoogleClaims = {}, privateKey = inject('googlePrivateKey')) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://accounts.google.com',
    aud: googleClientId(),
    sub: `g-${randomUUID()}`,
    email: uniqueEmail('google'),
    email_verified: true,
    name: 'Gigi Googler',
    given_name: 'Gigi',
    iat: now,
    exp: now + 3600,
    ...claims,
  };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT', kid: inject('googleKeyId') })}.${b64(payload)}`;
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url')}`;
}

/** POST /auth/google on the Google-enabled backend. */
export async function googleSignIn(credential: string) {
  const res = await fetch(`${googleApiUrl()}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  return { status: res.status, body: await res.json() };
}
