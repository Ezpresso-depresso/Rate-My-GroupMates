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
  await expect(qitai.page.getByRole('button', { name: '5 out of 5 stars' })).toBeVisible();
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
    await expect(kent.page.getByRole('button', { name: '5 out of 5 stars' })).toBeVisible();
    await expect(omar.page.getByRole('button', { name: '5 out of 5 stars' })).toBeVisible();
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

  test('you can’t move on without a star rating, every score and an award', async () => {
    const { kent } = await startedGroup();

    await kent.page.getByRole('button', { name: 'Next teammate →' }).click();
    await expect(kent.page.getByText('Choose an overall star rating to continue.')).toBeVisible();

    await kent.page.getByRole('button', { name: '4 out of 5 stars' }).click();
    await kent.page.getByRole('button', { name: 'Next teammate →' }).click();
    await expect(kent.page.getByText('Choose a score in every category to continue.')).toBeVisible();

    for (const category of ['Participation', 'Communication', 'Quality'])
      await kent.page.getByRole('button', { name: new RegExp(`^${category}.*: 7 out of 10$`) }).click();
    await kent.page.getByRole('button', { name: 'Next teammate →' }).click();
    await expect(kent.page.getByText(/^Pick an award for .+ to continue\.$/)).toBeVisible();
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

    // A finished group's card opens straight to its awards.
    await qitai.page.locator('.group-card', { hasText: 'Group 16' }).click();
    await expect(qitai.page).toHaveURL(/\/awards$/);
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

describe('ratings in Find Groupmates', () => {
  test('search results show each person’s overall stars, by the same rule as their profile', async () => {
    const { kent, omar, qitai, group } = await startedGroup();
    await kent.page.goto(group.url);
    await rateEveryone(kent, 5, 9);
    await expect(kent.page).toHaveURL(/\/awards$/);
    await rateEveryone(omar, 4, 8);
    await expect(omar.page).toHaveURL(/\/awards$/);
    // Qitai hasn't rated anyone yet, so their own reviews don't count for them yet.
    const { page } = omar;

    const search = async (who: TestUser) => {
      await page.goto(`${appUrl()}/profiles`);
      await page.getByRole('button', { name: /Search filter/ }).click();
      await page.getByRole('menuitemradio', { name: 'Email', exact: true }).click();
      await page.getByRole('searchbox', { name: 'Search people by email' }).fill(who.email);
      return page.locator('.search-results .member-row', { hasText: who.email });
    };

    // Kent was rated 4 stars by Omar (Qitai hasn't submitted).
    const kentRow = await search(kent);
    await expect(kentRow.getByLabel('4.0 out of 5 stars')).toBeVisible();
    await expect(kentRow).toContainText('4.0 (1 review)');

    const qitaiRow = await search(qitai);
    await expect(qitaiRow).toContainText('No ratings yet');
  });
});

describe('active and past groups', () => {
  test('a group moves to Past once you’ve rated, and Past can be collapsed (remembered)', async () => {
    const { kent, group } = await startedGroup();
    const { page } = kent;
    const active = page.getByRole('region', { name: /^Active groups/ });
    const past = page.getByRole('region', { name: /^Past groups/ });

    await page.goto(appUrl());
    await expect(active.locator('.group-card', { hasText: 'Group 16' })).toContainText('To do: rate your teammates');
    await expect(past).toHaveCount(0); // no past groups yet

    await page.goto(group.url);
    await rateEveryone(kent, 4, 8);
    await expect(page).toHaveURL(/\/awards$/);

    await page.goto(appUrl());
    await expect(past.locator('.group-card', { hasText: 'Group 16' })).toContainText('Done ✓');
    await expect(active).toContainText('Nothing in progress');

    const toggle = page.getByRole('button', { name: /^Past groups/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.group-card', { hasText: 'Group 16' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('button', { name: /^Past groups/ })).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: /^Past groups/ }).click();
    await expect(page.locator('.group-card', { hasText: 'Group 16' })).toBeVisible();
  });
});

describe('ranks', () => {
  test('a profile shows its rank badge: Unranked until rated, then from the average stars', async () => {
    const { kent, omar, qitai, group } = await startedGroup();
    const rank = (page: typeof kent.page) => page.getByRole('img', { name: /^Rank: / });

    await kent.page.goto(`${appUrl()}/profile`);
    await expect(rank(kent.page)).toHaveAccessibleName('Rank: Schrödinger’s Teammate');

    // Everyone rates everyone (Kent must rate for his own results to count): Kent gives 5s, Omar 4s, Qitai 5s.
    for (const [user, stars] of [[kent, 5], [omar, 4], [qitai, 5]] as const) {
      await user.page.goto(group.url);
      await rateEveryone(user, stars, 8);
      await expect(user.page).toHaveURL(/\/awards$/);
    }

    await kent.page.goto(`${appUrl()}/profile`);
    // Kent got 4 (Omar) + 5 (Qitai) = 4.5 exactly: the bottom of Grandmaster.
    await expect(rank(kent.page)).toHaveAccessibleName('Rank: Grandmaster Arbiter of Teamwork Teammate');

    // Omar got 5 stars from both Kent and Qitai: a perfect 5.0 is The Pope (seen on his profile by Kent too).
    const omarId = (await api(await omar.token(), 'GET', '/auth/me')).body.id;
    await kent.page.goto(`${appUrl()}/profiles/${omarId}`);
    await expect(rank(kent.page)).toHaveAccessibleName('Rank: The Pope');
    // The Pope's profile panel glows instead of casting a shadow; other ranks don't.
    await expect(kent.page.locator('.profile-page')).toHaveClass(/pope-glow/);
    await kent.page.goto(`${appUrl()}/profile`);
    await expect(rank(kent.page)).toHaveAccessibleName(/^Rank: Grandmaster/);
    await expect(kent.page.locator('.profile-page')).not.toHaveClass(/pope-glow/);
  });
});

describe('signature awards', () => {
  test('the award grid is 3×3 and keyboard-friendly, and your pick comes back when you edit', async () => {
    const { omar, group } = await startedGroup();
    const { page } = omar;
    const awards = page.getByRole('radiogroup', { name: /award$/ });
    await expect(awards.getByRole('radio')).toHaveCount(9);

    await awards.getByRole('radio', { name: /^Picasso / }).click();
    await expect(awards.getByRole('radio', { name: /^Picasso / })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowDown'); // Picasso is row 2, col 1 → row 3, col 1
    await expect(awards.getByRole('radio', { name: /^Hard Carry / })).toHaveAttribute('aria-checked', 'true');

    await rateEveryone(omar, 4, 8); // the helper re-picks Hard Carry for each teammate
    await expect(page).toHaveURL(/\/awards$/);
    await page.goto(group.url);
    await expect(page.getByRole('radio', { name: /^Hard Carry / })).toHaveAttribute('aria-checked', 'true');
  });

  test('each person gets the award their teammates picked most', async () => {
    const { kent, omar, qitai, group } = await startedGroup();
    // Rate Kent and Qitai with the given awards; the tabs go in member order without the rater.
    const rate = async (user: TestUser, awards: [string, string]) => {
      await user.page.goto(group.url);
      await rateCurrentTeammate(user.page, 4, 8, awards[0]);
      await user.page.getByRole('button', { name: 'Next teammate →' }).click();
      await rateCurrentTeammate(user.page, 4, 8, awards[1]);
      await user.page.getByRole('button', { name: 'Submit Ratings' }).click();
      await expect(user.page).toHaveURL(/\/awards$/);
    };
    await rate(kent, ['GTA 6', 'Picasso']); // Omar, Qitai
    await rate(omar, ['CYO', 'Picasso']); // Kent, Qitai
    await rate(qitai, ['CYO', 'GTA 6']); // Kent, Omar

    // Omar was picked GTA 6 twice; Kent CYO twice; Qitai Picasso twice.
    const card = (name: string) => kent.page.locator('.ceremony-card', { hasText: name });
    await expect(card('Omar')).toContainText('GTA 6');
    await expect(card('Qitai')).toContainText('Picasso');

    await kent.page.goto(`${appUrl()}/profile`);
    await expect(kent.page.getByRole('region', { name: /Awards/ }).first()).toContainText('CYO');
  });
});
