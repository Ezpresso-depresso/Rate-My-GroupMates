import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import {
  api,
  appUrl,
  createGroup,
  expect,
  joinGroup,
  launchBrowser,
  newUser,
  rateCurrentTeammate,
  type Group,
  type TestUser,
} from '../setup/helpers';

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

/** Kent creates a group with Omar and Qitai, and both join, so reviews are open. */
async function startedGroup() {
  const kent = await newUser(browser, 'Kent');
  const omar = await newUser(browser, 'Omar');
  const qitai = await newUser(browser, 'Qitai');
  const group = await createGroup(kent, 'Group 16', [omar, qitai]);
  await joinGroup(omar, group);
  await joinGroup(qitai, group);
  await expect(qitai.page.getByRole('link', { name: '01 · Rate teammates' })).toBeVisible();
  return { kent, omar, qitai, group };
}

async function rateEveryone(user: TestUser, stars: number, score: number) {
  await rateCurrentTeammate(user.page, stars, score);
  await user.page.getByRole('button', { name: 'Next teammate →' }).click();
  await rateCurrentTeammate(user.page, stars, score);
  await user.page.getByRole('button', { name: 'Submit Ratings' }).click();
}

describe('reviews stay locked until everyone accepts', () => {
  test('while anyone is still invited, nobody can rate', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);
    await joinGroup(omar, group);

    await expect(omar.page.getByText('Reviews unlock once everyone has joined')).toBeVisible();
    await expect(omar.page.getByRole('button', { name: /out of 5 stars/ })).toHaveCount(0);

    // The API refuses too, not just the UI.
    const res = await api(await omar.token(), 'GET', `/teams/${group.id}/reviews`);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Reviews open once everyone has accepted their invite');
  });

  test('when the last person joins, everyone already waiting is moved to rating automatically', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);
    await joinGroup(omar, group);
    await expect(omar.page.getByText('2 of 3 joined')).toBeVisible();

    await joinGroup(qitai, group);

    for (const user of [qitai, omar, kent]) {
      await expect(user.page.getByRole('link', { name: '01 · Rate teammates' })).toBeVisible();
      await expect(user.page.getByRole('button', { name: '5 out of 5 stars' })).toBeVisible();
    }
  });

  test('cancelling the last pending invite also starts reviews', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const qitai = await newUser(browser, 'Qitai');
    const group = await createGroup(kent, 'Group 16', [omar, qitai]);
    await joinGroup(omar, group);

    await kent.page.getByRole('button', { name: `Cancel ${qitai.email}’s invite` }).click();
    await expect(kent.page.getByRole('link', { name: '01 · Rate teammates' })).toBeVisible();
    await expect(omar.page.getByRole('link', { name: '01 · Rate teammates' })).toBeVisible();
  });
});

describe('rating and awards', () => {
  test('you rate each teammate (never yourself), submit, and see the awards', async () => {
    const { kent } = await startedGroup();
    const tabs = kent.page.getByRole('group', { name: 'Choose a teammate' });
    await expect(tabs.getByRole('button')).toHaveCount(2);
    await expect(tabs).toContainText('Omar');
    await expect(tabs).toContainText('Qitai');
    await expect(tabs).not.toContainText('Kent');

    await rateEveryone(kent, 5, 9);

    await expect(kent.page).toHaveURL(/\/awards$/);
    await expect(kent.page.getByText('Results post-review')).toBeVisible();
  });

  test('you can’t move on without a star rating and every score', async () => {
    const { kent } = await startedGroup();

    await kent.page.getByRole('button', { name: 'Next teammate →' }).click();
    await expect(kent.page.getByText('Choose an overall star rating to continue.')).toBeVisible();

    await kent.page.getByRole('button', { name: '4 out of 5 stars' }).click();
    await kent.page.getByRole('button', { name: 'Next teammate →' }).click();
    await expect(kent.page.getByText('Choose a score in every category to continue.')).toBeVisible();
  });

  test('your submitted ratings are saved and come back when you edit them', async () => {
    const { omar, group } = await startedGroup();
    await rateEveryone(omar, 3, 6);
    await expect(omar.page).toHaveURL(/\/awards$/);

    await omar.page.goto(group.url);
    await expect(omar.page.getByRole('button', { name: '3 out of 5 stars' })).toHaveAttribute('aria-pressed', 'true');
    await expect(omar.page.getByText('2/2 reviews ready')).toBeVisible();
  });

  test('the home page shows a to-do until you submit, then done', async () => {
    const { qitai } = await startedGroup();
    await qitai.page.goto(appUrl());
    const card = qitai.page.locator('.group-card', { hasText: 'Group 16' });
    await expect(card).toContainText('To do: rate your teammates');

    await card.click();
    await rateEveryone(qitai, 4, 7);
    await expect(qitai.page).toHaveURL(/\/awards$/);

    await qitai.page.goto(appUrl());
    await expect(qitai.page.locator('.group-card', { hasText: 'Group 16' })).toContainText('Done ✓');
  });

  test('once reviews start, the group is locked: no new invites, leaving or deleting', async () => {
    const { kent, omar, group } = await startedGroup();
    const kentToken = await kent.token();

    const invite = await api(kentToken, 'POST', `/teams/${group.id}/invites`, { emails: ['late@test.dev'] });
    expect(invite.status).toBe(409);
    expect(invite.body.message).toMatch(/Reviews have already started/);

    const leave = await api(await omar.token(), 'POST', `/teams/${group.id}/leave`);
    expect(leave.status).toBe(409);

    const del = await api(kentToken, 'DELETE', `/teams/${group.id}`);
    expect(del.status).toBe(409);
  });
});

describe('nobody can read or write someone else’s reviews', () => {
  async function outsiderAnd(group: Group) {
    const outsider = await newUser(browser, 'Outsider');
    return { token: await outsider.token(), path: `/teams/${group.id}/reviews` };
  }

  test('an outsider can’t read a group’s reviews', async () => {
    const { group } = await startedGroup();
    const { token, path } = await outsiderAnd(group);
    const res = await api(token, 'GET', path);
    expect(res.status).toBe(403);
  });

  test('an outsider can’t submit reviews into a group', async () => {
    const { group } = await startedGroup();
    const { token, path } = await outsiderAnd(group);
    const res = await api(token, 'POST', path, {
      reviews: [{ targetId: '0123456789abcdef01234567', rating: 5, scores: { participation: 9, communication: 9, quality: 9 } }],
    });
    expect(res.status).toBe(403);
  });

  test('an outsider opening the group page is told it isn’t theirs', async () => {
    const { group } = await startedGroup();
    const outsider = await newUser(browser, 'Outsider');
    await outsider.page.goto(group.url);
    await expect(outsider.page.getByText(`This group didn’t invite ${outsider.email}`)).toBeVisible();
    await expect(outsider.page.getByRole('link', { name: '← Back to my groups' })).toBeVisible();
  });

  test('you can’t review yourself, even by calling the API directly', async () => {
    const { kent, group } = await startedGroup();
    const team = await api(await kent.token(), 'GET', `/teams/${group.id}`);
    const me = team.body.members.find((m: { name: string }) => m.name === 'Kent');
    const res = await api(await kent.token(), 'POST', `/teams/${group.id}/reviews`, {
      reviews: [{ targetId: me.id, rating: 5, scores: { participation: 10, communication: 10, quality: 10 } }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('You can’t review yourself');
  });
});
