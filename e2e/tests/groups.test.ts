import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { appUrl, createGroup, expect, launchBrowser, newUser, uniqueEmail } from '../setup/helpers';

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

describe('creating a group', () => {
  test('a new user has no groups yet and is told which email to be invited with', async () => {
    const kent = await newUser(browser, 'Kent');

    await expect(kent.page.getByRole('heading', { name: 'No groups yet' })).toBeVisible();
    await expect(kent.page.getByText(kent.email)).toHaveCount(2); // header + "ask to invite <email>"
  });

  test('creating a group opens its waiting room with an invite link and a 6-character code', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const group = await createGroup(kent, 'Group 16', [omar]);

    expect(group.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await expect(kent.page.getByLabel('Invite link')).toHaveValue(group.joinUrl);
    await expect(kent.page.getByText('1 of 2 joined')).toBeVisible();
    await expect(kent.page.locator('.member-row', { hasText: omar.email })).toContainText('Invited');
    await expect(kent.page.locator('.member-row', { hasText: 'Kent' }).first()).toContainText('Joined');
  });

  test('the group shows on your home page as waiting', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    await createGroup(kent, 'Waiting Group', [omar]);
    await kent.page.goto(appUrl());

    const card = kent.page.locator('.group-card', { hasText: 'Waiting Group' });
    await expect(card).toContainText('Waiting · 1/2 joined');
  });

  test('missing name, missing course, bad emails and inviting only yourself are all caught', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    await page.goto(`${appUrl()}/groups/new`);
    const create = page.getByRole('button', { name: /^Create group/ });

    await create.click();
    await expect(page.getByText('Give your group a name')).toBeVisible();

    await page.getByLabel('Group name').fill('Group 16');
    await create.click();
    await expect(page.getByText('Which course is this for?')).toBeVisible();

    await page.getByLabel('Course').fill('INF 151');
    await page.getByLabel('Teammates’ emails').fill('omar@uci, qitai@uci.edu');
    await expect(page.locator('.email-chips')).toContainText('omar@uci · not an email');
    await create.click();
    await expect(page.getByText('Fix or remove “omar@uci”')).toBeVisible();

    await page.getByLabel('Teammates’ emails').fill(kent.email);
    await expect(page.locator('.email-chips')).toContainText('that’s you');
    await create.click();
    await expect(page.getByText('Invite at least one teammate (not counting yourself)')).toBeVisible();

    expect(page.url()).toBe(`${appUrl()}/groups/new`);
  });

  test('emails pasted from Gmail ("Name <email>") and in mixed case are understood', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = uniqueEmail('omar');
    const qitai = uniqueEmail('qitai');
    const { page } = kent;
    await page.goto(`${appUrl()}/groups/new`);
    await page.getByLabel('Group name').fill('Pasted');
    await page.getByLabel('Course').fill('INF 151');
    await page.getByLabel('Teammates’ emails').fill(`Omar Ali <${omar.toUpperCase()}>, "Qitai" <${qitai}>; ${omar}`);
    await page.getByRole('button', { name: 'Create group & invite 2' }).click();

    await expect(page.getByText(/Waiting room/i)).toBeVisible();
    await expect(page.locator('.member-row')).toHaveCount(3);
    await expect(page.locator('.member-row', { hasText: omar })).toBeVisible();
    await expect(page.locator('.member-row', { hasText: qitai })).toBeVisible();
  });
});
