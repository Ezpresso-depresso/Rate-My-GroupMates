import { test, expect, type Page } from '@playwright/test';

async function fixture(page: Page, count = 4, submitted = true) {
  const members = Array.from({ length: count }, (_, i) => ({ id: `member-${i}`, name: ['Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan'][i] ?? `Member ${i + 1}`, color: '#aabbcc' }));
  let reviews = submitted ? members.slice(1).map((m, i) => ({ id: `review-${i}`, teamId: 'test-team', reviewerId: 'member-0', targetId: m.id, rating: 4, scores: { participation: 8, communication: 9, quality: 8 }, text: '', anonymous: false, submittedAt: '' })) : [];
  const writes: string[] = [];
  await page.addInitScript(() => localStorage.setItem('rmg-member-v1:test-team', JSON.stringify('member-0')));
  // Every API request is intercepted. These tests never contact a real team database.
  await page.route('**/api/**', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      writes.push(request.url());
      const body = request.postDataJSON();
      reviews = body.reviews.map((r: object, i: number) => ({ ...r, id: `review-${i}`, reviewerId: body.reviewerId, teamId: 'test-team', submittedAt: '' }));
    }
    await route.fulfill({ json: request.url().includes('/reviews') ? reviews : { id: 'test-team', name: 'The Night Shift', course: 'TEST', members } });
  });
  return writes;
}

test('unsubmitted members cannot enter, rating submission unlocks awards and the game', async ({ page }) => {
  const writes = await fixture(page, 2, false);
  await page.goto('/awards');
  await expect(page.getByRole('heading', { name: 'The awards are waiting.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter Afterparty' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Continue rating' }).click();
  await page.getByRole('button', { name: '4 out of 5 stars', exact: true }).click();
  for (const name of ['Participation', 'Communication', 'Quality of work']) await page.getByRole('button', { name: `${name}: 8 out of 10`, exact: true }).click();
  await page.getByRole('button', { name: 'Submit Ratings' }).click();
  await expect(page).toHaveURL(/\/awards$/);
  await page.getByRole('button', { name: 'Enter Afterparty' }).click();
  await expect(page.getByRole('heading', { name: 'One room. Everyone’s invited.' })).toBeVisible();
  expect(writes).toHaveLength(1);
});

test('3D game renders, moves, jumps, pauses, resumes, and cleans up on navigation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const writes = await fixture(page);
  await page.goto('/awards'); await page.getByRole('button', { name: 'Enter Afterparty' }).click();
  await page.getByRole('button', { name: 'Enter the afterparty' }).click();
  await expect(page.locator('.ap-stage canvas')).toBeVisible();
  await expect(page.locator('.fighter-label')).toHaveCount(4);
  await page.locator('.afterparty').screenshot({ path: 'test-results/ceremony-desktop.png' });
  await page.getByRole('button', { name: 'Skip ceremony' }).click();
  await expect(page.locator('.ap-game')).toHaveAttribute('data-phase', 'brawl');
  const before = await page.locator('.fighter-label').first().getAttribute('style');
  await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d');
  expect(await page.locator('.fighter-label').first().getAttribute('style')).not.toEqual(before);
  await page.keyboard.press('Space'); await page.keyboard.down('j'); await page.waitForTimeout(500); await page.keyboard.up('j');
  await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: 'Time out.' })).toBeVisible();
  const time = await page.locator('.ap-timer strong').textContent();
  await page.waitForTimeout(1200); expect(await page.locator('.ap-timer strong').textContent()).toEqual(time);
  await page.getByRole('button', { name: 'Back to the brawl' }).click();
  await expect(page.getByRole('heading', { name: 'Time out.' })).toHaveCount(0);
  await page.locator('.afterparty').screenshot({ path: 'test-results/brawl-desktop.png' });
  await page.getByRole('button', { name: 'Back to awards' }).click();
  await expect(page.locator('.ap-stage canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enter Afterparty' }).click();
  await page.getByRole('button', { name: 'Enter the afterparty' }).click();
  await expect(page.locator('.ap-stage canvas')).toHaveCount(1);
  expect(writes).toHaveLength(0); expect(errors).toEqual([]);
});

test('six-member mobile group fits screen and touch controls work', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const writes = await fixture(page, 6);
  await page.goto('/awards'); await page.getByRole('button', { name: 'Enter Afterparty' }).click(); await page.getByRole('button', { name: 'Enter the afterparty' }).click();
  await expect(page.locator('.fighter-label')).toHaveCount(6);
  await page.getByRole('button', { name: 'Skip ceremony' }).click();
  await expect(page.locator('.ap-game')).toHaveAttribute('data-phase', 'brawl');
  await expect(page.getByRole('button', { name: 'Move right', exact: true })).toBeVisible();
  const before = await page.locator('.fighter-label').first().boundingBox();
  const button = await page.getByRole('button', { name: 'Move right', exact: true }).boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: button!.x + button!.width / 2, y: button!.y + button!.height / 2 }] });
  await page.waitForTimeout(400);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await page.locator('.fighter-label').first().boundingBox();
  expect(after!.x - before!.x).toBeGreaterThan(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.afterparty').screenshot({ path: 'test-results/brawl-mobile.png' });
  expect(writes).toHaveLength(0); expect(errors).toEqual([]);
});

test('a full round reaches results and replay resets scores and ceremony', async ({ page }) => {
  test.setTimeout(100_000);
  const writes = await fixture(page);
  await page.goto('/awards'); await page.getByRole('button', { name: 'Enter Afterparty' }).click();
  await page.getByLabel('ROUND LENGTH').selectOption('60');
  await page.getByRole('button', { name: 'Enter the afterparty' }).click();
  await page.getByRole('button', { name: 'Skip ceremony' }).click();
  await expect(page.locator('.ap-game')).toHaveAttribute('data-phase', 'results', { timeout: 85_000 });
  await expect(page.getByRole('dialog', { name: 'Brawl results' })).toBeVisible();
  await expect(page.locator('.ap-result-table tbody tr')).toHaveCount(4);
  await page.locator('.afterparty').screenshot({ path: 'test-results/results-desktop.png' });
  await page.getByRole('button', { name: 'One more round' }).click();
  await expect(page.locator('.ap-game')).toHaveAttribute('data-phase', 'awards');
  await expect(page.locator('.ap-fighter-top > b').first()).toHaveText('0KO');
  expect(writes).toHaveLength(0);
});

test('unavailable WebGL shows a recoverable error with an exit', async ({ page }) => {
  await fixture(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    };
  });
  await page.goto('/awards'); await page.getByRole('button', { name: 'Enter Afterparty' }).click(); await page.getByRole('button', { name: 'Enter the afterparty' }).click();
  await expect(page.getByRole('heading', { name: 'Arena unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to awards' }).click();
  await expect(page).toHaveURL(/\/awards$/);
});

test('development preview runs without API configuration and supports larger groups', async ({ page }) => {
  await page.route('**/api/**', route => route.abort());
  await page.goto('/dev/afterparty.html?members=12');
  await page.getByRole('button', { name: 'Enter Afterparty' }).click();
  await page.getByRole('button', { name: 'Enter the afterparty' }).click();
  await expect(page.locator('.fighter-label')).toHaveCount(12);
  await expect(page.locator('.ap-stage canvas')).toHaveCount(1);
});

test('afterparty only appends to awards and preserves the original content on close', async ({ page }) => {
  await fixture(page);
  await page.goto('/awards');
  await expect(page.getByRole('button', { name: 'Enter Afterparty' })).toBeVisible();
  const cards = await page.locator('.ceremony-grid').innerHTML();
  const closing = await page.locator('.closing-card').first().innerHTML();
  const navigation = await page.getByRole('navigation', { name: 'Main navigation' }).innerHTML();
  await page.screenshot({ path: 'test-results/awards-with-extra-entry.png', fullPage: true });
  await page.getByRole('button', { name: 'Enter Afterparty' }).click();
  await expect(page.getByRole('heading', { name: 'One room. Everyone’s invited.' })).toBeVisible();
  await expect(page).toHaveURL(/\/awards$/);
  expect(await page.locator('.ceremony-grid').innerHTML()).toBe(cards);
  await page.getByRole('button', { name: 'Back to awards' }).click();
  await expect(page.locator('#afterparty-panel')).toHaveCount(0);
  expect(await page.locator('.ceremony-grid').innerHTML()).toBe(cards);
  expect(await page.locator('.closing-card').first().innerHTML()).toBe(closing);
  expect(await page.getByRole('navigation', { name: 'Main navigation' }).innerHTML()).toBe(navigation);
  await expect(page.getByRole('button', { name: 'Enter Afterparty' })).toBeFocused();
});

test('a failed game download cannot remove the original awards page', async ({ page }) => {
  await fixture(page);
  await page.route('**/src/features/afterparty/AfterpartyPanel.tsx', route => route.abort());
  await page.goto('/awards');
  const cards = await page.locator('.ceremony-grid').innerHTML();
  await page.getByRole('button', { name: 'Enter Afterparty' }).click();
  await expect(page.getByRole('alert')).toContainText('The game couldn’t load.');
  expect(await page.locator('.ceremony-grid').innerHTML()).toBe(cards);
  await page.getByRole('button', { name: 'Close game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter Afterparty' })).toBeFocused();
  await expect(page).toHaveURL(/\/awards$/);
});
