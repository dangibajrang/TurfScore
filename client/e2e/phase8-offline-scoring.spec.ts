import { expect, test } from '@playwright/test';

/**
 * Phase 8 — offline queue persistence + sync.
 *
 * Uses Playwright `setOffline` for scoring. Full document reload while offline cannot
 * fetch the Vite app shell (no service worker); persistence is verified via IndexedDB
 * inspection, then network restore + ordered sync.
 */
test.describe('Phase 8 offline scoring', () => {
  test('queue deliveries offline, persist in IndexedDB, sync when online', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const email = `e2e_off_${stamp}@example.com`;
    const password = 'Password123!';
    const teamA = `Off Alpha ${stamp}`;
    const teamB = `Off Beta ${stamp}`;
    const matchName = `Offline Score ${stamp}`;

    await page.goto('/register');
    await page.getByLabel('Name').fill('E2E Offline');
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

    const aNames = [`OA1 ${stamp}`, `OA2 ${stamp}`, `OA3 ${stamp}`];
    const bNames = [`OB1 ${stamp}`, `OB2 ${stamp}`, `OB3 ${stamp}`];
    await createTeamWithPlayers(teamA, 'OA', aNames);
    await createTeamWithPlayers(teamB, 'OB', bNames);

    await page.goto('/matches/create');
    await page.getByLabel('Match name').fill(matchName);
    await page.getByLabel('Venue').fill('Offline Turf');
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

    await expect(page.getByText(/select opening batters/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`OA1 ${stamp}`) }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`OA2 ${stamp}`) }).last().click();
    await page.getByTestId('confirm-openings').click();

    await expect(page.getByText(/select bowler/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`OB1 ${stamp}`) }).click();

    await expect(page.getByTestId('scoring-keypad')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('score-1').click();
    await expect(page.getByTestId('score-header')).toContainText('1');
    await page.getByTestId('score-4').click();
    await expect(page.getByTestId('score-header')).toContainText(/5/);
    await expect(page.getByTestId('score-1')).toBeEnabled();

    await context.setOffline(true);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('score-1')).toBeEnabled();

    // Three legal balls offline (stay inside the over — avoid bowler sheet mid-test).
    // Online already used 2 legal balls; one more legal → 0.3, still same bowler.
    await page.getByTestId('score-1').click();
    await page.getByTestId('score-4').click();
    await page.getByTestId('score-6').click();

    await expect(page.getByTestId('sync-pending-count')).toContainText(/[1-9]/, {
      timeout: 15_000,
    });

    const idbPending = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const req = indexedDB.open('turfscore-offline-v1');
        req.onerror = () => resolve(-1);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('queue')) {
            resolve(-2);
            return;
          }
          const tx = db.transaction('queue', 'readonly');
          const getAll = tx.objectStore('queue').getAll();
          getAll.onsuccess = () => {
            const rows = (getAll.result as Array<{ status?: string }>) ?? [];
            resolve(rows.filter((r) => r.status === 'PENDING' || r.status === 'SYNCING').length);
          };
          getAll.onerror = () => resolve(-3);
        };
      });
    });
    expect(idbPending).toBeGreaterThanOrEqual(3);

    // Simulate refresh persistence: reopen DB after "reload" by reading again (shell cannot
    // reload fully offline without a service worker). Then restore network and sync.
    await context.setOffline(false);
    await page.waitForTimeout(500);

    // Dismiss any sheet that may have opened from local projection heuristics.
    await page.keyboard.press('Escape').catch(() => undefined);

    const retry = page.getByTestId('retry-failed-sync');
    if (await retry.isVisible().catch(() => false)) {
      await retry.click({ force: true });
    }

    await expect
      .poll(async () => {
        const el = page.getByTestId('sync-pending-count');
        if (!(await el.isVisible().catch(() => false))) return true;
        const text = await el.textContent();
        const failedEl = page.getByTestId('sync-failed-count');
        const failedText = (await failedEl.textContent().catch(() => '0 failed')) ?? '0 failed';
        return (text?.includes('0 pending') ?? false) && failedText.includes('0 failed');
      }, { timeout: 90_000 })
      .toBeTruthy();

    // Authoritative score: 5 (online) + 1+4+6 (offline) = 16
    await expect(page.getByTestId('score-header')).toContainText(/16/, { timeout: 30_000 });
  });
});
