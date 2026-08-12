import { expect, test } from '@playwright/test';

test.describe('Phase 3 core flow', () => {
  test('login → dashboard → team → player → roster → profile → logout', async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e_${stamp}@example.com`;
    const password = 'Password123!';
    const teamName = `E2E Titans ${stamp}`;
    const playerName = `E2E Rahul ${stamp}`;

    await page.goto('/register');
    await page.getByLabel('Name').fill('E2E User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 2, name: /hi,/i })).toBeVisible();

    await page.goto('/teams/new');
    await page.getByLabel('Team name').fill(teamName);
    await page.getByLabel('Short name').fill('E2E');
    await page.getByLabel('Description').fill('Playwright team');
    await page.getByRole('button', { name: /^create team$/i }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9]+/i);
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible();
    const teamUrl = page.url();

    await page.goto('/players/new');
    await page.getByLabel('Name').fill(playerName);
    await page.getByLabel('Role').selectOption('BATTER');
    await page.getByLabel('Batting style').selectOption('RIGHT_HAND');
    await page.getByRole('button', { name: /^create player$/i }).click();
    await expect(page).toHaveURL(/\/players\/[a-f0-9]+/i);
    await expect(page.getByRole('heading', { name: playerName })).toBeVisible();

    await page.goto(teamUrl);
    await page.getByRole('tab', { name: 'Players' }).click();
    await page.getByRole('button', { name: /add player/i }).click();
    await page.getByPlaceholder('Search players…').fill(playerName);
    await expect(page.getByText(playerName)).toBeVisible();
    await page.getByRole('button', { name: /^add$/i }).first().click();
    await expect(page.getByRole('link', { name: playerName })).toBeVisible();

    await page.getByRole('link', { name: playerName }).click();
    await expect(page).toHaveURL(/\/players\/[a-f0-9]+/i);
    await expect(page.getByRole('heading', { name: playerName })).toBeVisible();

    await page.getByRole('banner').getByRole('button', { name: /e2e user/i }).click();
    await page.getByRole('banner').getByRole('menuitem', { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
