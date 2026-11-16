import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { api, appUrl, createGroup, expect, joinGroup, launchBrowser, newUser, pickCourse, uniqueEmail } from '../setup/helpers';

let browser: Browser;

/** Clicks a class chip's × on your profile, then confirms in its popover. */
async function removeClass(page: Page, code: string) {
  await page.getByRole('button', { name: `Remove ${code}` }).click();
  await page.getByRole('dialog', { name: `Remove ${code}?` }).getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Classes' }).getByText(code, { exact: true })).toHaveCount(0);
}
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

describe('groups are for real UCI courses', () => {
  test('a made-up course is rejected; a real one is stored as its course code', async () => {
    const kent = await newUser(browser, 'Kent');
    const token = await kent.token();
    const emails = [uniqueEmail('mate')];

    const fake = await api(token, 'POST', '/teams', { name: 'Fake', course: 'a class that’s cool', emails });
    expect(fake.status).toBe(400);
    expect(fake.body.message).toBe('Pick a course from the list');

    const real = await api(token, 'POST', '/teams', { name: 'Real', course: ' compsci  161 ', emails });
    expect(real.status).toBe(201);
    expect(real.body.course).toBe('COMPSCI 161');
  });

  test('typing in the create-group form brings up matching departments and courses', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    await page.goto(`${appUrl()}/groups/new`);

    const department = page.getByRole('combobox', { name: 'Department' });
    const course = page.getByRole('combobox', { name: 'Course' });
    await expect(course).toBeDisabled();

    // A department's name works too; the best match comes first.
    await department.fill('software');
    await expect(page.getByRole('option').first()).toHaveAccessibleName(/^SWE/);
    await department.press('Enter');
    await expect(department).toHaveValue('SWE · Software Engineering');

    // The course box opens (and gets focus) on its own once the department is picked.
    await expect(course).toBeFocused();
    await course.fill('requirements analysis');
    await expect(page.getByRole('option')).toHaveCount(1);
    await course.press('Tab'); // the only match counts as picked
    await expect(course).toHaveValue('113 · Requirements Analysis and Engineering');
  });

  test('the dropdown buttons still list everything, ICS departments first', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    await page.goto(`${appUrl()}/groups/new`);

    await page.getByRole('button', { name: 'Show all department options' }).click();
    await expect(page.getByRole('option').first()).toHaveAccessibleName(/^COMPSCI/);
    await page.getByRole('option', { name: /^IN4MATX/ }).click();

    // The course list is already open; its button closes and reopens it.
    const course = page.getByRole('combobox', { name: 'Course' });
    const options = page.getByRole('option', { name: /^151 Project Management/ });
    await expect(options).toBeVisible();
    await page.getByRole('button', { name: 'Show all course options' }).click();
    await expect(options).toBeHidden();
    await page.getByRole('button', { name: 'Show all course options' }).click();
    await options.click();
    await expect(course).toHaveValue('151 · Project Management');
  });

  test('text that matches nothing never becomes the course', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    await page.goto(`${appUrl()}/groups/new`);
    const department = page.getByRole('combobox', { name: 'Department' });
    await department.fill('zzz not a department');
    await expect(page.getByText('No matches for “zzz not a department”')).toBeVisible();
    await department.press('Tab');
    await expect(department).toHaveValue('');
  });
});

describe('finding groupmates by class', () => {
  test('class is the default; typing suggests courses and picking one lists who joined a group for it', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const group = await createGroup(kent, 'Algorithms crew', [omar], 'COMPSCI 161');
    await joinGroup(omar, group);
    // Everyone (both of them) has accepted once reviews open.
    await expect.poll(async () => (await api(await omar.token(), 'GET', `/teams/${group.id}`)).body?.status).toBe('reviewing');

    const { page } = kent;
    await page.goto(`${appUrl()}/profiles`);
    const box = page.getByRole('combobox', { name: 'Search people by class' });
    await box.fill('cs 161');
    const option = page.getByRole('option', { name: /COMPSCI 161/ });
    await expect(option).toBeVisible();
    await option.click();

    await expect(box).toHaveValue('COMPSCI 161');
    const results = page.locator('.search-results');
    await expect(results).toContainText('Kent Testerson');
    await expect(results).toContainText('Omar Testerson');
  });

  test('switching the filter to email searches people by email as you type', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    await page.goto(`${appUrl()}/profiles`);
    await page.getByRole('button', { name: /Search filter/ }).click();
    await page.getByRole('menuitemradio', { name: 'Email', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search people by email' }).fill(kent.email.split('@')[0]);
    await expect(page.locator('.search-results')).toContainText('Kent Testerson');
  });
});

describe('classes on profiles', () => {
  test('your groups’ classes show on your profile, and you can add and drop classes', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    await createGroup(kent, 'Algorithms crew', [omar], 'COMPSCI 161');

    const { page } = kent;
    await page.goto(`${appUrl()}/profile`);
    const classes = page.getByRole('list', { name: 'Classes' });
    await expect(classes).toContainText('COMPSCI 161');

    // Add one.
    await page.getByRole('button', { name: '+ Add a class' }).click();
    await pickCourse(page, 'SWE 113');
    await page.getByRole('button', { name: 'Add class' }).click();
    await expect(classes).toContainText('SWE 113');

    // Still there after a reload (saved), then drop both, including the group's.
    await page.reload();
    await expect(classes).toContainText('SWE 113');
    // Removing asks first, in a small popover (no browser dialog); Cancel keeps it.
    await page.getByRole('button', { name: 'Remove SWE 113' }).click();
    const confirm = page.getByRole('dialog', { name: 'Remove SWE 113?' });
    await expect(confirm).toContainText('Are you sure you want to remove SWE 113?');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toHaveCount(0);
    await expect(classes).toContainText('SWE 113');

    await removeClass(page, 'SWE 113');
    await removeClass(page, 'COMPSCI 161');
    await expect(page.getByText('No classes yet.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('No classes yet.')).toBeVisible();
  });

  test('added classes are searchable, and a dropped class stops matching', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const token = await kent.token();
    // A class nobody else in the test run uses, so the result list is just Kent.
    expect((await api(token, 'POST', '/profile/classes', { code: 'ANTHRO 2A' })).status).toBe(200);

    const { page } = omar;
    await page.goto(`${appUrl()}/profiles`);
    await page.getByRole('combobox', { name: 'Search people by class' }).fill('anthro 2a');
    await page.getByRole('option', { name: /^ANTHRO 2A/ }).click();
    await expect(page.locator('.search-results')).toContainText('Kent Testerson');

    expect((await api(token, 'POST', '/profile/classes/drop', { code: 'ANTHRO 2A' })).status).toBe(200);
    await page.reload();
    await expect(page.getByText('No one lists ANTHRO 2A on their profile yet.')).toBeVisible();
  });

  test('someone else’s classes are read-only and link to Find Groupmates for that class', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    const kentId = (await api(await kent.token(), 'GET', '/auth/me')).body.id;
    await api(await kent.token(), 'POST', '/profile/classes', { code: 'STATS 67' });
    expect((await api(await kent.token(), 'POST', '/profile/classes', { code: 'NOT A CLASS 1' })).status).toBe(400);

    const { page } = omar;
    await page.goto(`${appUrl()}/profiles/${kentId}`);
    await expect(page.getByRole('list', { name: 'Classes' })).toContainText('STATS 67');
    await expect(page.getByRole('button', { name: /Remove/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ Add a class' })).toHaveCount(0);

    await page.getByRole('link', { name: /STATS 67/ }).click();
    await expect(page.getByRole('combobox', { name: 'Search people by class' })).toHaveValue('STATS 67');
    await expect(page.locator('.search-results')).toContainText('Kent Testerson');
  });
});

describe('the "add classes" reminder', () => {
  test('a new account is nudged until it has a class, and again if it drops them all', async () => {
    const kent = await newUser(browser, 'Kent');
    const { page } = kent;
    const nudge = page.getByRole('link', { name: 'Add classes to profile!' });
    await expect(nudge).toBeVisible();

    // The reminder opens the profile's class picker.
    await nudge.click({ force: true }); // it bounces forever, so it's never "stable"
    await expect(page).toHaveURL(/\/profile#classes$/);
    await pickCourse(page, 'SWE 113');
    await page.getByRole('button', { name: 'Add class' }).click();
    await expect(nudge).toHaveCount(0);

    await removeClass(page, 'SWE 113');
    await expect(nudge).toBeVisible();
  });

  test('joining a group gives you its class, so the reminder goes away', async () => {
    const kent = await newUser(browser, 'Kent');
    const omar = await newUser(browser, 'Omar');
    await expect(kent.page.getByRole('link', { name: 'Add classes to profile!' })).toBeVisible();
    await createGroup(kent, 'Group 16', [omar]);
    await expect(kent.page.getByRole('link', { name: 'Add classes to profile!' })).toHaveCount(0);
  });
});
