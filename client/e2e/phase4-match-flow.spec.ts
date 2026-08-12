import { expect, test } from '@playwright/test';

test.describe('Phase 4 match creation flow', () => {
  test('create 10-over match through wizard and start LIVE', async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e_m_${stamp}@example.com`;
    const password = 'Password123!';
    const teamA = `E2E Alpha ${stamp}`;
    const teamB = `E2E Beta ${stamp}`;
    const matchName = `Sunday Turf Clash ${stamp}`;

    await page.goto('/register');
    await page.getByLabel('Name').fill('E2E Match User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Team A + 2 players
    await page.goto('/teams/new');
    await page.getByLabel('Team name').fill(teamA);
    await page.getByLabel('Short name').fill('EA');
    await page.getByRole('button', { name: /^create team$/i }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9]+/i);
    const teamAUrl = page.url();

    for (const name of [`Alpha One ${stamp}`, `Alpha Two ${stamp}`]) {
      await page.goto('/players/new');
      await page.getByLabel('Name').fill(name);
      await page.getByLabel('Role').selectOption('BATTER');
      await page.getByRole('button', { name: /^create player$/i }).click();
      await expect(page).toHaveURL(/\/players\/[a-f0-9]+/i);
      const playerUrl = page.url();
      const playerId = playerUrl.split('/').pop()!;

      await page.goto(teamAUrl);
      await page.getByRole('tab', { name: 'Players' }).click();
      await page.getByRole('button', { name: /add player/i }).click();
      await page.getByPlaceholder('Search players…').fill(name);
      await page.getByRole('button', { name: /^add$/i }).first().click();
      await expect(page.getByRole('link', { name })).toBeVisible();
      void playerId;
    }

    // Team B + 2 players
    await page.goto('/teams/new');
    await page.getByLabel('Team name').fill(teamB);
    await page.getByLabel('Short name').fill('EB');
    await page.getByRole('button', { name: /^create team$/i }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9]+/i);
    const teamBUrl = page.url();

    for (const name of [`Beta One ${stamp}`, `Beta Two ${stamp}`]) {
      await page.goto('/players/new');
      await page.getByLabel('Name').fill(name);
      await page.getByLabel('Role').selectOption('BOWLER');
      await page.getByRole('button', { name: /^create player$/i }).click();
      await expect(page).toHaveURL(/\/players\/[a-f0-9]+/i);

      await page.goto(teamBUrl);
      await page.getByRole('tab', { name: 'Players' }).click();
      await page.getByRole('button', { name: /add player/i }).click();
      await page.getByPlaceholder('Search players…').fill(name);
      await page.getByRole('button', { name: /^add$/i }).first().click();
      await expect(page.getByRole('link', { name })).toBeVisible();
    }

    // Wizard
    await page.goto('/matches/create');
    await page.getByLabel('Match name').fill(matchName);
    await page.getByLabel('Venue').fill('Green Arena');
    await page.getByLabel('Date').fill('2026-08-16');
    await page.getByLabel('Time').fill('18:00');
    await page.getByRole('button', { name: /continue/i }).click();

    await page
      .getByTestId('team-selector-team-a')
      .getByRole('button', { name: new RegExp(teamA, 'i') })
      .click();
    await page
      .getByTestId('team-selector-team-b')
      .getByRole('button', { name: new RegExp(teamB, 'i') })
      .click();
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByRole('button', { name: /^10$/ }).click();
    // shrink XI requirement for E2E speed
    await page.getByLabel('Players per side').selectOption('2');
    await page.getByRole('button', { name: /continue/i }).click();

    // Select all players for both sides
    for (const name of [`Alpha One ${stamp}`, `Alpha Two ${stamp}`]) {
      await page.getByRole('button', { name: new RegExp(name) }).click();
    }
    for (const name of [`Beta One ${stamp}`, `Beta Two ${stamp}`]) {
      await page.getByRole('button', { name: new RegExp(name) }).click();
    }
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByRole('button', { name: new RegExp(`^${teamB}$`, 'i') }).click();
    await page.getByRole('button', { name: /^bat$/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText(/review & start/i)).toBeVisible();

    const startResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/matches') &&
        r.request().method() === 'POST' &&
        !r.url().includes('/start'),
    );
    await page.getByRole('button', { name: /^start match$/i }).click();
    const startResponse = await startResponsePromise;
    if (!startResponse.ok()) {
      const errBody = await startResponse.text();
      throw new Error(`Start match failed (${startResponse.status()}): ${errBody}`);
    }

    await expect(page).toHaveURL(/\/matches\/[a-f0-9]{24}$/i);
    await expect(page.getByText('LIVE').first()).toBeVisible();
    await expect(page.getByTestId('open-scoring')).toBeVisible();
    await expect(page.getByRole('heading', { name: matchName })).toBeVisible();

    await page.goto('/matches');
    await page.getByRole('tab', { name: 'Live' }).click();
    await expect(page.getByRole('link', { name: matchName })).toBeVisible();
  });
});
