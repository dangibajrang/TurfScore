import { expect, test } from '@playwright/test';

test.describe('Phase 6 live scoring flow', () => {
  test('score deliveries via UI against real API', async ({ page }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    const email = `e2e_s_${stamp}@example.com`;
    const password = 'Password123!';
    const teamA = `Score Alpha ${stamp}`;
    const teamB = `Score Beta ${stamp}`;
    const matchName = `Live Score ${stamp}`;

    await page.goto('/register');
    await page.getByLabel('Name').fill('E2E Scorer');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    async function createTeamWithPlayers(teamName: string, short: string, names: string[]) {
      await page.goto('/teams/new');
      await page.getByLabel('Team name').fill(teamName);
      await page.getByLabel('Short name').fill(short);
      await page.getByRole('button', { name: /^create team$/i }).click();
      await expect(page).toHaveURL(/\/teams\/[a-f0-9]+/i);
      const teamUrl = page.url();

      for (const name of names) {
        await page.goto('/players/new');
        await page.getByLabel('Name').fill(name);
        await page.getByLabel('Role').selectOption('ALL_ROUNDER');
        await page.getByRole('button', { name: /^create player$/i }).click();
        await expect(page).toHaveURL(/\/players\/[a-f0-9]+/i);

        await page.goto(teamUrl);
        await page.getByRole('tab', { name: 'Players' }).click();
        await page.getByRole('button', { name: /add player/i }).click();
        await page.getByPlaceholder('Search players…').fill(name);
        await page.getByRole('button', { name: /^add$/i }).first().click();
        await expect(page.getByRole('link', { name })).toBeVisible();
      }
    }

    const aNames = [`A1 ${stamp}`, `A2 ${stamp}`, `A3 ${stamp}`];
    const bNames = [`B1 ${stamp}`, `B2 ${stamp}`, `B3 ${stamp}`];
    await createTeamWithPlayers(teamA, 'SA', aNames);
    await createTeamWithPlayers(teamB, 'SB', bNames);

    await page.goto('/matches/create');
    await page.getByLabel('Match name').fill(matchName);
    await page.getByLabel('Venue').fill('Turf Arena');
    await page.getByLabel('Date').fill('2026-08-20');
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
    await page.getByLabel('Players per side').selectOption('3');
    await page.getByRole('button', { name: /continue/i }).click();

    for (const name of [...aNames, ...bNames]) {
      await page.getByRole('button', { name: new RegExp(name) }).click();
    }
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByRole('button', { name: new RegExp(`^${teamA}$`, 'i') }).click();
    await page.getByRole('button', { name: /^bat$/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    const startResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/matches') &&
        r.request().method() === 'POST' &&
        !r.url().includes('/start'),
    );
    await page.getByRole('button', { name: /^start match$/i }).click();
    const startResponse = await startResponsePromise;
    expect(startResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/matches\/[a-f0-9]{24}$/i);
    await page.getByTestId('open-scoring').click();
    await expect(page).toHaveURL(/\/live$/);
    await expect(page.getByTestId('live-scoring-screen')).toBeVisible();

    // Openings — striker then non-striker
    await expect(page.getByText(/select opening batters/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`A1 ${stamp}`) }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`A2 ${stamp}`) }).last().click();
    await page.getByTestId('confirm-openings').click();

    await expect(page.getByText(/select bowler/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`B1 ${stamp}`) }).click();

    await expect(page.getByTestId('scoring-keypad')).toBeVisible({ timeout: 15_000 });

    const deliveryPromise = page.waitForResponse(
      (r) => r.url().includes('/deliveries') && r.request().method() === 'POST',
    );
    await page.getByTestId('score-1').click();
    const d1 = await deliveryPromise;
    expect(d1.ok()).toBeTruthy();
    const body1 = await d1.json();
    expect(body1.state.innings[0].totalRuns).toBe(1);
    await expect(page.getByTestId('score-header')).toContainText('1');

    await page.getByTestId('score-4').click();
    await expect(page.getByTestId('score-header')).toContainText(/5/);

    await page.getByTestId('score-0').click();
    await page.getByTestId('score-6').click();
    await expect(page.getByTestId('score-header')).toContainText(/11/);

    await page.getByTestId('score-wide').click();
    await page.getByRole('dialog').getByRole('button', { name: /^1$/ }).click();
    await expect(page.getByTestId('score-header')).toContainText(/12/);

    await page.getByRole('link', { name: /^scorecard$/i }).click();
    await expect(page).toHaveURL(/\/scorecard$/);
    await expect(page.getByTestId('scorecard-view')).toBeVisible();
    await expect(page.getByText('12/0', { exact: true }).first()).toBeVisible();
  });
});
