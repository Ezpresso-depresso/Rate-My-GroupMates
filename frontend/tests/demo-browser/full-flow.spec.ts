import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Tests do not need external web fonts. The API itself is NOT mocked here.
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

test('real original pages run from member selection through submitted awards and the game', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?start=1');
  await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Local demo notice' })).toBeVisible();
  await page.screenshot({ path: 'test-results/full-flow-start.png' });
  await page.getByRole('button', { name: 'Alex', exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '4 out of 5 stars', exact: true }).click();
    for (const name of ['Participation', 'Communication', 'Quality of work']) {
      await page.getByRole('button', { name: `${name}: 8 out of 10`, exact: true }).click();
    }
    await page.getByRole('button', { name: i < 2 ? 'Next teammate' : 'Submit Ratings' }).click();
  }
  await expect(page).toHaveURL(/\/awards$/);
  await expect(page.locator('.ceremony-grid > *')).toHaveCount(3);
  const saved = await (await page.request.get('/__local_demo/api/teams/local-full-flow-demo/reviews?viewerId=demo-member-0')).json();
  expect(saved).toHaveLength(3); expect(saved.every((r: { rating: number }) => r.rating === 4)).toBe(true);
  await page.getByRole('button', { name: 'Enter Afterparty' }).click();
  await page.getByRole('button', { name: 'Enter the afterparty' }).click();
  await expect(page.locator('.fighter-label')).toHaveCount(4);
  await page.getByRole('button', { name: 'Skip ceremony' }).click();
  await expect(page.locator('.ap-game')).toHaveAttribute('data-phase', 'brawl');
  await page.getByRole('button', { name: 'Back to awards' }).click();
  await expect(page.locator('.ceremony-grid > *')).toHaveCount(3);
  await page.reload(); await expect(page.locator('.ceremony-grid > *')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('the original join form and restart link work without changing production data', async ({ page }) => {
  await page.goto('/?start=1');
  await page.getByPlaceholder('Your name').fill('Preview Guest');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByText('Rating your teammate', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '02 · Team awards' }).click();
  await expect(page.getByRole('heading', { name: 'The awards are waiting.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter Afterparty' })).toHaveCount(0);
  await page.getByRole('link', { name: '从选择成员重新开始' }).click();
  await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview Guest', exact: true })).toBeVisible();
});
