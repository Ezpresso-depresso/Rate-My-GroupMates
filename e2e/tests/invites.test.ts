import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { api, appUrl, createGroup, expect, joinGroup, launchBrowser, newUser, newVisitor, signUp } from '../setup/helpers';

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

describe('accepting an invite', () => {
  test('an invitee sees the invitation on their home page, from the creator', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    await createGroup(kent, 'Group 16', [omar]);
    await omar.page.reload();

    const invite = omar.page.locator('.invite-card', { hasText: 'Group 16' });
    await expect(invite).toContainText('Kent invited you · INF 151');
    await expect(invite.getByRole('link', { name: 'Accept →' })).toBeVisible();
  });

  test('the invite link + code joins the group', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);

    await omar.page.goto(group.joinUrl);
    await expect(omar.page.getByRole('heading', { name: 'Kent invited you to Group 16' })).toBeVisible();
    await joinGroup(omar, group);

    // Qitai hasn't joined, so Omar lands in the waiting room, not the rating screen.
    await expect(omar.page.getByText('2 of 3 joined')).toBeVisible();
    await expect(omar.page.locator('.member-row', { hasText: 'Omar' })).toContainText('Joined');
  });

  test('the code works in lowercase and with spaces', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);

    await joinGroup(omar, group, ` ${group.code.slice(0, 3).toLowerCase()} ${group.code.slice(3).toLowerCase()} `);
    await expect(omar.page.getByText('2 of 3 joined')).toBeVisible();
  });

  test('a wrong code is refused with a clear message', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const group = await createGroup(kent, 'Group 16', [omar]);

    await joinGroup(omar, group, 'WRONG1');
    await expect(omar.page.getByText('That code doesn’t match')).toBeVisible();

    await omar.page.getByLabel('Invite code').fill('');
    await omar.page.getByRole('button', { name: 'Join group' }).click();
    await expect(omar.page.getByText('Enter the code from whoever invited you')).toBeVisible();
  });

  test('someone who wasn’t invited can’t join, even with the right link and code', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const stranger = await newUser(browser, 'Stranger');
    const group = await createGroup(kent, 'Group 16', [omar]);

    await stranger.page.goto(group.joinUrl);
    await expect(stranger.page.getByText(`This group didn’t invite ${stranger.email}`)).toBeVisible();
    await expect(stranger.page.getByRole('button', { name: 'Use a different account' })).toBeVisible();
    await expect(stranger.page.getByLabel('Invite code')).toHaveCount(0);
  });

  test('opening an invite link before having an account continues to the invite after signing up', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newVisitor(browser, 'Omar');
    const group = await createGroup(kent, 'Group 16', [omar]);

    await omar.page.goto(group.joinUrl);
    await signUp(omar);
    await expect(omar.page.getByRole('heading', { name: 'Kent invited you to Group 16' })).toBeVisible();
  });

  test('a deleted group’s link says so', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const group = await createGroup(kent, 'Doomed', [omar]);
    await kent.page.getByRole('button', { name: 'Delete group' }).click();
    await expect(kent.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();

    await omar.page.goto(group.joinUrl);
    await expect(omar.page.getByText('This group doesn’t exist')).toBeVisible();
  });

  test('a broken invite link says so', async () => {
    const omar = await newUser(browser, 'Omar');
    await omar.page.goto(`${appUrl()}/join/not-a-real-id`);
    await expect(omar.page.getByText('That group link is broken or incomplete')).toBeVisible();
  });
});

describe('declining and leaving', () => {
  test('declining from the home page removes the invite, and the creator sees them gone', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    await createGroup(kent, 'Group 16', [omar, qitai]);
    await omar.page.reload();

    await omar.page.locator('.invite-card', { hasText: 'Group 16' }).getByRole('button', { name: 'Decline' }).click();
    await expect(omar.page.locator('.invite-card')).toHaveCount(0);

    // The creator's waiting room updates on its own.
    await expect(kent.page.locator('.member-row', { hasText: omar.email })).toHaveCount(0);
    await expect(kent.page.getByText('1 of 2 joined')).toBeVisible();
  });

  test('if everyone else declines, the creator is told to invite someone else', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const group = await createGroup(kent, 'Group 16', [omar]);

    await omar.page.goto(group.joinUrl);
    await omar.page.getByRole('button', { name: 'Decline' }).click();
    await expect(omar.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();

    await expect(kent.page.getByText('Everyone else declined, so it’s just you')).toBeVisible();
  });

  test('a member can leave while the group is waiting', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);
    await joinGroup(omar, group);
    await expect(omar.page.getByText('2 of 3 joined')).toBeVisible();

    await omar.page.getByRole('button', { name: 'Leave group' }).click();
    await expect(omar.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
    await expect(omar.page.locator('.group-card', { hasText: 'Group 16' })).toHaveCount(0);
    await expect(kent.page.getByText('1 of 2 joined')).toBeVisible();
  });

  test('the creator has Delete instead of Leave, and other members see the group vanish', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);
    await joinGroup(omar, group);
    await expect(omar.page.getByText('2 of 3 joined')).toBeVisible();

    await expect(kent.page.getByRole('button', { name: 'Leave group' })).toHaveCount(0);
    await kent.page.getByRole('button', { name: 'Delete group' }).click();
    await expect(kent.page.getByRole('heading', { name: 'Your groups' })).toBeVisible();

    // Omar's waiting room notices on its next check.
    await expect(omar.page.getByText('This group doesn’t exist')).toBeVisible();
  });
});

describe('managing invites (creator only)', () => {
  test('the creator can invite more people; duplicates are refused', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    await createGroup(kent, 'Group 16', [omar]);
    const field = kent.page.getByLabel('Invite more people');

    await field.fill(omar.email);
    await kent.page.getByRole('button', { name: 'Invite', exact: true }).click();
    await expect(kent.page.getByText('Everyone you listed is already in this group')).toBeVisible();

    await field.fill(qitai.email);
    await kent.page.getByRole('button', { name: 'Invite', exact: true }).click();
    await expect(kent.page.locator('.member-row', { hasText: qitai.email })).toContainText('Invited');
    await expect(kent.page.getByText('1 of 3 joined')).toBeVisible();
  });

  test('cancelling an invite stops that person from joining', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);

    await kent.page.getByRole('button', { name: `Cancel ${qitai.email}’s invite` }).click();
    await expect(kent.page.locator('.member-row', { hasText: qitai.email })).toHaveCount(0);

    await qitai.page.goto(group.joinUrl);
    await expect(qitai.page.getByText(`This group didn’t invite ${qitai.email}`)).toBeVisible();
  });

  test('a new code replaces the old one immediately', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);

    await kent.page.getByRole('button', { name: 'Make a new code' }).click();
    await expect(kent.page.getByLabel('Invite code')).not.toHaveValue(group.code);
    const newCode = await kent.page.getByLabel('Invite code').inputValue();

    await joinGroup(omar, group, group.code);
    await expect(omar.page.getByText('That code doesn’t match')).toBeVisible();
    await joinGroup(omar, group, newCode);
    await expect(omar.page.getByText('2 of 3 joined')).toBeVisible();
  });

  test('members who joined see the link and code, but not the creator’s controls', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);
    await joinGroup(omar, group);

    await expect(omar.page.getByLabel('Invite code')).toHaveValue(group.code);
    await expect(omar.page.getByLabel('Invite link')).toHaveValue(group.joinUrl);
    await expect(omar.page.getByRole('button', { name: 'Make a new code' })).toHaveCount(0);
    await expect(omar.page.getByLabel('Invite more people')).toHaveCount(0);
    await expect(omar.page.getByRole('button', { name: /^Cancel .* invite$/ })).toHaveCount(0);
  });

  test('people who haven’t joined yet never see the code', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const group = await createGroup(kent, 'Group 16', [omar]);

    await omar.page.goto(group.joinUrl);
    await expect(omar.page.getByText(group.code)).toHaveCount(0);
    // Not just hidden on screen: the server never sends it to them.
    const fromApi = await api(await omar.token(), 'GET', `/teams/${group.id}`);
    expect(fromApi.status).toBe(200);
    expect(JSON.stringify(fromApi.body)).not.toContain(group.code);
    const list = await api(await omar.token(), 'GET', '/teams');
    expect(JSON.stringify(list.body)).not.toContain(group.code);
    // …and opening the group page directly bounces them to the join page.
    await omar.page.goto(group.url);
    await expect(omar.page).toHaveURL(group.joinUrl);
  });
});
