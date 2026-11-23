import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { appUrl, expect, launchBrowser, newUser, useAccountMenu } from '../setup/helpers';

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

describe('help and about awards', () => {
  test('Help in the account menu opens the help page, which restarts the guided tour in place', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    const tourNote = page.getByText('Profile picture, nickname, bio, and profile background can also be changed!');

    // A new account starts the tour; close its note so restarting it is visible.
    await page.goto(`${appUrl()}/profile`);
    await page.getByRole('note').getByRole('button', { name: 'Close' }).click({ force: true }); // it bounces, so never "stable"
    await expect(tourNote).toHaveCount(0);

    await useAccountMenu(page, 'Help');
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole('heading', { name: 'Getting around' })).toBeVisible();

    // Starting it keeps you on the help page; the first pop-up appears on the My Profile tab.
    await page.getByRole('button', { name: 'Start the guided tour' }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole('status')).toHaveText('The guided tour is in progress.');
    await expect(page.getByRole('link', { name: 'Add classes to profile!' })).toBeVisible();

    await page.goto(`${appUrl()}/profile`);
    await expect(tourNote).toBeVisible();
  });

  test('the help page can end a running tour, which closes its pop-ups', async () => {
    const kent = await newUser(browser, 'Kent'); // a new account starts the tour
    const { page } = kent;
    const tourNote = page.getByText('Profile picture, nickname, bio, and profile background can also be changed!');

    await useAccountMenu(page, 'Help');
    await expect(page.getByRole('status')).toHaveText('The guided tour is in progress.');
    await page.getByRole('button', { name: 'End the guided tour' }).click();
    await expect(page.getByRole('button', { name: 'End the guided tour' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start the guided tour' })).toBeVisible();

    await page.goto(`${appUrl()}/profile`);
    await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible();
    await expect(tourNote).toHaveCount(0);
  });

  test('About awards in the account menu explains tiers, badges and signature awards', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    await useAccountMenu(page, 'About awards');
    await expect(page).toHaveURL(/\/about-awards$/);
    await expect(page.getByRole('heading', { name: 'About awards', level: 1 })).toBeVisible();

    await expect(page.getByRole('region', { name: 'Achievement tiers' })).toContainText('Certified Carry');
    await expect(page.getByRole('region', { name: 'Achievement tiers' })).toContainText('4.5+ stars on average');
    await expect(page.getByRole('region', { name: 'Badges' })).toContainText('Top Groupmate');
    await expect(page.getByRole('region', { name: 'Signature awards' })).toContainText('Assigned a task. Entered witness protection.');

    // The help page links here too.
    await page.goto(`${appUrl()}/help`);
    await page.getByRole('link', { name: 'About awards →' }).click();
    await expect(page).toHaveURL(/\/about-awards$/);
  });
});
