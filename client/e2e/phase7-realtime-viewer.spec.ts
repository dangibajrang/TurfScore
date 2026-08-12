import { expect, test } from '@playwright/test';

test.describe('Phase 7 realtime public viewer', () => {
  test('scorer delivery updates public viewer without refresh', async ({ browser }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    const email = `e2e_rt_${stamp}@example.com`;
    const password = 'Password123!';
    const teamA = `RT Alpha ${stamp}`;
    const teamB = `RT Beta ${stamp}`;
    const matchName = `Realtime ${stamp}`;

    const scorer = await browser.newContext();
    const scorerPage = await scorer.newPage();

    await scorerPage.goto('/register');
    await scorerPage.getByLabel('Name').fill('E2E RT Scorer');
    await scorerPage.getByLabel('Email').fill(email);
    await scorerPage.getByLabel('Password', { exact: true }).fill(password);
    await scorerPage.getByLabel('Confirm password').fill(password);
    await scorerPage.getByRole('button', { name: /create account/i }).click();
    await expect(scorerPage).toHaveURL(/\/dashboard/);

    async function createTeam(teamName: string, short: string, names: string[]) {
      await scorerPage.goto('/teams/new');
      await scorerPage.getByLabel('Team name').fill(teamName);
      await scorerPage.getByLabel('Short name').fill(short);
      await scorerPage.getByRole('button', { name: /^create team$/i }).click();
      await expect(scorerPage).toHaveURL(/\/teams\/[a-f0-9]+/i);
      const teamUrl = scorerPage.url();
      for (const name of names) {
        await scorerPage.goto('/players/new');
        await scorerPage.getByLabel('Name').fill(name);
        await scorerPage.getByLabel('Role').selectOption('ALL_ROUNDER');
        await scorerPage.getByRole('button', { name: /^create player$/i }).click();
        await expect(scorerPage).toHaveURL(/\/players\/[a-f0-9]+/i);
        await scorerPage.goto(teamUrl);
        await scorerPage.getByRole('tab', { name: 'Players' }).click();
        await scorerPage.getByRole('button', { name: /add player/i }).click();
        await scorerPage.getByPlaceholder('Search players…').fill(name);
        await scorerPage.getByRole('button', { name: /^add$/i }).first().click();
        await expect(scorerPage.getByRole('link', { name })).toBeVisible();
      }
    }

    const aNames = [`RA1 ${stamp}`, `RA2 ${stamp}`, `RA3 ${stamp}`];
    const bNames = [`RB1 ${stamp}`, `RB2 ${stamp}`, `RB3 ${stamp}`];
    await createTeam(teamA, 'RA', aNames);
    await createTeam(teamB, 'RB', bNames);

    await scorerPage.goto('/matches/create');
    await scorerPage.getByLabel('Match name').fill(matchName);
    await scorerPage.getByLabel('Venue').fill('Live Arena');
    await scorerPage.getByLabel('Date').fill('2026-08-21');
    await scorerPage.getByLabel('Time').fill('19:00');
    await scorerPage.getByRole('button', { name: /continue/i }).click();
    await scorerPage
      .getByTestId('team-selector-team-a')
      .getByRole('button', { name: new RegExp(teamA, 'i') })
      .click();
    await scorerPage
      .getByTestId('team-selector-team-b')
      .getByRole('button', { name: new RegExp(teamB, 'i') })
      .click();
    await scorerPage.getByRole('button', { name: /continue/i }).click();
    await scorerPage.getByRole('button', { name: /^10$/ }).click();
    await scorerPage.getByLabel('Players per side').selectOption('3');
    await scorerPage.getByRole('button', { name: /continue/i }).click();
    for (const name of [...aNames, ...bNames]) {
      await scorerPage.getByRole('button', { name: new RegExp(name) }).click();
    }
    await scorerPage.getByRole('button', { name: /continue/i }).click();
    await scorerPage.getByRole('button', { name: new RegExp(`^${teamA}$`, 'i') }).click();
    await scorerPage.getByRole('button', { name: /^bat$/i }).click();
    await scorerPage.getByRole('button', { name: /continue/i }).click();

    const startPromise = scorerPage.waitForResponse(
      (r) =>
        r.url().includes('/api/matches') &&
        r.request().method() === 'POST' &&
        !r.url().includes('/start'),
    );
    await scorerPage.getByRole('button', { name: /^start match$/i }).click();
    expect((await startPromise).ok()).toBeTruthy();
    await expect(scorerPage).toHaveURL(/\/matches\/[a-f0-9]{24}$/i);

    await scorerPage.getByTestId('enable-live-sharing').click();
    await expect(scorerPage.getByTestId('public-live-url')).toBeVisible({ timeout: 15_000 });
    const publicUrl = await scorerPage.getByTestId('public-live-url').innerText();
    expect(publicUrl).toMatch(/\/live\/TS-/i);
    const publicPath = publicUrl.replace(/^https?:\/\/[^/]+/, '');

    const viewer = await browser.newContext();
    const viewerPage = await viewer.newPage();
    await viewerPage.goto(publicPath);
    await expect(viewerPage.getByTestId('public-live-viewer')).toBeVisible();
    await expect(viewerPage.getByTestId('live-connection-status')).toBeVisible();
    await expect(viewerPage.getByTestId('public-live-score')).toContainText('0');

    await scorerPage.getByTestId('open-scoring').click();
    await expect(scorerPage).toHaveURL(/\/live$/);
    await expect(scorerPage.getByText(/select opening batters/i)).toBeVisible();
    await scorerPage
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(`RA1 ${stamp}`) })
      .first()
      .click();
    await scorerPage
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(`RA2 ${stamp}`) })
      .last()
      .click();
    await scorerPage.getByTestId('confirm-openings').click();
    await expect(scorerPage.getByText(/select bowler/i)).toBeVisible({ timeout: 15_000 });
    await scorerPage
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(`RB1 ${stamp}`) })
      .click();
    await expect(scorerPage.getByTestId('scoring-keypad')).toBeVisible({ timeout: 15_000 });

    const deliveryPromise = scorerPage.waitForResponse(
      (r) => r.url().includes('/deliveries') && r.request().method() === 'POST',
    );
    await scorerPage.getByTestId('score-4').click();
    expect((await deliveryPromise).ok()).toBeTruthy();

    await expect(viewerPage.getByTestId('public-live-score')).toContainText('4/0', {
      timeout: 15_000,
    });

    await scorerPage.getByTestId('score-6').click();
    await expect(viewerPage.getByTestId('public-live-score')).toContainText('10/0', {
      timeout: 15_000,
    });

    await viewer.close();
    await scorer.close();
  });
});
