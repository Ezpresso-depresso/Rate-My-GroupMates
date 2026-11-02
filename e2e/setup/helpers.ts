/* Shared helpers: fresh browser users, the app's URLs, and direct API calls for permission checks. */
import { randomUUID } from 'node:crypto';
import { chromium, expect as pwExpect, type Browser, type BrowserContext, type Page } from 'playwright/test';
import { inject } from 'vitest';

export const appUrl = () => inject('appUrl');
export const apiUrl = () => inject('apiUrl');
export { pwExpect as expect };

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: !process.env.HEADED });
}

export interface TestUser {
  name: string;
  email: string;
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
    context,
    page,
    token: async () => JSON.parse((await page.evaluate(() => localStorage.getItem('rmg-session-v1'))) ?? 'null'),
  };
}

/** Signs in through the local test login on whatever page is open. */
export async function signIn(user: TestUser) {
  await user.page.getByLabel('Email').fill(user.email);
  await user.page.getByLabel('Name').fill(`${user.name} Testerson`);
  await user.page.getByRole('button', { name: 'Sign in' }).click();
}

/** A new, signed-in person on the home page. */
export async function newUser(browser: Browser, name: string): Promise<TestUser> {
  const user = await newVisitor(browser, name);
  await user.page.goto(appUrl());
  await signIn(user);
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
