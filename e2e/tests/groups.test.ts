import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { api, appUrl, createGroup, expect, fillTeammates, launchBrowser, newUser, pickCourse, uniqueEmail } from '../setup/helpers';

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

    await pickCourse(page, 'IN4MATX 151');
    await fillTeammates(page, ['omar@uci', 'qitai@uci.edu']);
    await expect(page.getByText('Not an email')).toBeVisible();
    await create.click();
    await expect(page.getByText('Fix or remove “omar@uci”')).toBeVisible();

    await page.getByRole('button', { name: 'Remove teammate 2' }).click();
    await page.getByRole('combobox', { name: 'Teammate 1 email' }).fill(kent.email);
    await expect(page.getByText('That’s you: you’re added automatically')).toBeVisible();
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
    await pickCourse(page, 'IN4MATX 151');
    // Pasting a list into one box splits it into a box per email (duplicates dropped).
    await page.getByRole('combobox', { name: 'Teammate 1 email' }).fill(`Omar Ali <${omar.toUpperCase()}>, "Qitai" <${qitai}>; ${omar}`);
    await expect(page.getByRole('combobox', { name: 'Teammate 2 email' })).toHaveValue(qitai);
    await page.getByRole('button', { name: 'Create group & invite 2' }).click();

    await expect(page.getByText(/Waiting room/i)).toBeVisible();
    await expect(page.locator('.member-row')).toHaveCount(3);
    await expect(page.locator('.member-row', { hasText: omar })).toBeVisible();
    await expect(page.locator('.member-row', { hasText: qitai })).toBeVisible();
  });
});

describe('choosing teammates', () => {
  const teammateBoxes = (page: Page) => page.getByRole('combobox', { name: /^Teammate \d+ email$/ });

  test('the form starts with one teammate box; + adds more and × removes them', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    await page.goto(`${appUrl()}/groups/new`);

    await expect(teammateBoxes(page)).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Remove teammate/ })).toHaveCount(0); // the only box can't be removed
    await page.getByRole('button', { name: 'Add another teammate' }).click();
    await expect(page.getByRole('combobox', { name: 'Teammate 2 email' })).toBeFocused();
    await page.getByRole('button', { name: 'Remove teammate 2' }).click();
    await expect(teammateBoxes(page)).toHaveCount(1);
  });

  test('typing suggests people with matching emails; picking one fills it in', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const { page } = kent;
    await page.goto(`${appUrl()}/groups/new`);

    const box = page.getByRole('combobox', { name: 'Teammate 1 email' });
    await box.fill(omar.email.split('@')[0]);
    const option = page.getByRole('option').filter({ hasText: omar.email });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByRole('listbox')).toHaveCount(0);

    // The picked teammate shows as a card with their picture, name and email.
    const card = page.getByRole('button', { name: `Teammate 1: Omar Testerson, ${omar.email}. Click to change` });
    await expect(card).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create group & invite 1' })).toBeVisible();

    // Clicking it brings back the email box to change it.
    await card.click();
    await expect(box).toBeFocused();
    await expect(box).toHaveValue(omar.email);
  });

  test('a typed email with an account becomes a card; one without says they can join later', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const stranger = uniqueEmail('stranger');
    const { page } = kent;
    await page.goto(`${appUrl()}/groups/new`);

    await fillTeammates(page, [omar.email, stranger]);
    await page.getByLabel('Group name').click(); // leave the last box
    await expect(page.getByRole('button', { name: new RegExp(`^Teammate 1: Omar Testerson`) })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Teammate 2 email' })).toHaveValue(stranger);
    await expect(page.getByText('No account yet. They can join once they sign up with this email.')).toBeVisible();
  });
});

describe('a message for the group', () => {
  test('the creator can add a message that invitees see on their invitation and the join page', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const { page } = kent;
    const message = 'Meeting Thursdays at 6 in the library. Bring snacks.';

    await page.goto(`${appUrl()}/groups/new`);
    await page.getByLabel('Group name').fill('With a note');
    await pickCourse(page, 'IN4MATX 151');
    await fillTeammates(page, [omar.email]);
    await page.getByLabel(/Message for your teammates/).fill(message);
    await expect(page.getByText(`${message.length}/300`)).toBeVisible();
    await page.getByRole('button', { name: /^Create group/ }).click();
    await expect(page.getByText(/Waiting room/i)).toBeVisible();
    const id = page.url().split('/').pop()!;

    // Omar's home page shows it on the invitation…
    await omar.page.goto(appUrl());
    await expect(omar.page.locator('.invite-card', { hasText: 'With a note' })).toContainText(message);

    // …and the join page quotes it.
    await omar.page.goto(`${appUrl()}/join/${id}`);
    const quote = omar.page.getByRole('figure');
    await expect(quote).toContainText('Message from Kent');
    await expect(quote).toContainText(message);
  });

  test('the message is optional, and too-long messages are refused', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const token = await kent.token();
    const emails = [omar.email];

    const none = await api(token, 'POST', '/teams', { name: 'No note', course: 'IN4MATX 151', emails });
    expect(none.status).toBe(201);
    expect(none.body.message).toBe('');

    const long = await api(token, 'POST', '/teams', { name: 'Long', course: 'IN4MATX 151', emails, message: 'x'.repeat(301) });
    expect(long.status).toBe(400);
    expect(long.body.message).toBe('Keep the message under 300 characters');
  });
});
