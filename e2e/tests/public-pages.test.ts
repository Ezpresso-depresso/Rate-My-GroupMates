import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { appUrl, expect, launchBrowser, newUser, newVisitor } from '../setup/helpers';

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

// Google's OAuth consent screen links to these, so they must open without signing in.
describe('privacy policy and terms', () => {
  test('the privacy policy opens without signing in and says what is stored', async () => {
    const visitor = await newVisitor(browser, 'Visitor');
    await visitor.page.goto(`${appUrl()}/privacy`);

    await expect(visitor.page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
    await expect(visitor.page.getByText('your name and email address')).toBeVisible();
    await expect(visitor.page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
  });

  test('the terms open without signing in', async () => {
    const visitor = await newVisitor(browser, 'Visitor');
    await visitor.page.goto(`${appUrl()}/terms`);

    await expect(visitor.page.getByRole('heading', { name: 'Terms of use' })).toBeVisible();
    await expect(visitor.page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
  });

  test('the login page links to both', async () => {
    const visitor = await newVisitor(browser, 'Visitor');
    await visitor.page.goto(appUrl());
    await visitor.page.getByRole('link', { name: 'Privacy' }).click();

    await expect(visitor.page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
    await expect(visitor.page.getByRole('link', { name: 'Terms' })).toBeVisible();
  });

  test('signed-in people can open them too', async () => {
    const kent = await newUser(browser, 'Kent');
    await kent.page.goto(`${appUrl()}/privacy`);

    await expect(kent.page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  });
});
