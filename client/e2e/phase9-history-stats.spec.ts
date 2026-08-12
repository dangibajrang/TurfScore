import { expect, test } from '@playwright/test';

/**
 * Phase 9 — dashboard → matches → scorecard → player stats → statistics.
 */
test.describe('Phase 9 history and statistics', () => {
  test('dashboard, matches search, statistics empty state for new account', async ({ page }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    const email = `e2e_p9_${stamp}@example.com`;
    const password = 'Password123!';

    await page.goto('/register');
    await page.getByLabel('Name').fill('E2E Phase9');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible();
    await expect(page.getByText('Wins')).toBeVisible();

    await page.goto('/matches');
    await expect(page.getByRole('heading', { name: /my matches/i })).toBeVisible();
    await page.getByTestId('matches-search').fill('nonexistent-xyz');
    await expect(page.getByText(/no matches yet/i)).toBeVisible({ timeout: 10_000 });

    await page.goto('/statistics');
    await expect(page.getByRole('heading', { name: /statistics/i })).toBeVisible();
    await expect(page.getByText(/no completed matches yet|completed/i).first()).toBeVisible();

    // Global search empty results
    await page.getByTestId('global-search').fill('zzzz-no-hit');
    await expect(page.getByText(/no results for/i)).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('global-search').fill('');

    await page.goto('/players');
    await expect(page.getByRole('link', { name: /create|add|new/i }).first()).toBeVisible();
  });
});
