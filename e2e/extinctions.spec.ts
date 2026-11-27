/**
 * Feature: Mass extinctions (#1189). The great extinctions marked in deep time where their
 * causes and records lay; a place's card, and the end-Permian watched in its own time, the
 * Siberian Traps fuming.
 */

import { collectProblems, expect, globeRendered, test } from './support';

test('the Mass extinctions layer marks the end-Permian’s places, and plays it in its own time, the traps fuming @acceptance', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  const globe = page.getByTestId('globe');
  const clock = page.getByRole('dialog', { name: 'The end-Permian, in its own time' });
  await test.step('Given deep time 252 million years ago, with the extinctions on', async () => {
    await page.goto('./?ma=252&scale=all&layers=extinctions&cam=50,40,2.6');
    await globeRendered(page);
  });
  await test.step('Then the Siberian Traps and Meishan are marked', async () => {
    await expect(globe).toHaveAttribute('data-extinctions', '5');
    await expect(page.locator('[data-pick="extinction:meishan"]')).toBeAttached();
  });
  await test.step('When they open the Siberian Traps’ card, Then it says what was lost and what caused it', async () => {
    await page.locator('[data-pick="extinction:norilsk"]').click({ force: true });
    await expect(card).toBeVisible();
    await expect(card).toContainText('End-Permian mass extinction');
    await expect(card).toContainText('Siberian Traps');
    await expect(card).toContainText('The usual “Big Five”');
  });
  await test.step('When they watch it in its own time, Then its clock opens and the traps fume', async () => {
    await card.getByRole('button', { name: 'Watch it in its own time' }).click();
    await expect(card).toBeHidden();
    await expect(clock).toBeVisible();
    await expect(globe).toHaveAttribute('data-fumes', 'on');
    await expect(clock.locator('.strike-clock-when')).toHaveText(/before the extinction$/);
    await expect(clock).toHaveAttribute('data-playing', 'true');
    // Paused to read it: playing, each frame of the fuming globe takes CI's software graphics
    // so long that every step waits seconds. How it plays is the unit tests'.
    await clock.getByRole('button', { name: 'Pause' }).click();
    // Nothing lost yet (#1223).
    await expect(clock.locator('.loss-gauge-label')).toHaveText('Marine genera left: 100%');
    // The sea's warming at Meishan, measured, above the slider (#1229).
    const record = clock.locator('.proxy-chart:visible');
    await expect(record).toContainText('Sea-surface temperature at Meishan');
    await expect(record.locator('.proxy-dot')).toHaveCount(42);
    // And carbon dioxide, worked out from fossil plants, picked by name.
    await clock.getByRole('button', { name: 'Carbon dioxide' }).click();
    await expect(record).toContainText('Carbon dioxide, ppm, worked out from fossil plants');
    await expect(record.locator('.proxy-dot')).toHaveCount(72);
  });
  await test.step('And the header says the clock’s age, in the Permian, the bar’s own pace set aside (#1222)', async () => {
    await expect(page.locator('.hud-date')).toHaveText(/^252\.\d million years ago$/);
    await expect(page.locator('.hud-detail')).toContainText('Permian');
    await expect(page.locator('.deep-speed')).toBeHidden();
    // What is drawn to illustrate is said so (#1226).
    await expect(clock.locator('.strike-clock-drawn')).toContainText('Drawn to illustrate');
  });
  await test.step('When they move the slider to the extinction, Then it says the phase and its sources', async () => {
    const slider = clock.getByRole('slider');
    await slider.fill('4.1');
    await expect(clock.locator('.strike-clock-phase')).toHaveText('The Great Dying');
    await expect(clock.locator('.strike-clock-sources a').first()).toHaveAttribute(
      'href',
      /^https:\/\/doi\.org\/10\./,
    );
  });
  await test.step('When they move it 200,000 years on, Then the header is in the Triassic', async () => {
    await clock.getByRole('slider').fill('6');
    await expect(page.locator('.hud-date')).toHaveText('251.7 million years ago');
    await expect(page.locator('.hud-detail')).toContainText('Triassic');
    // And the gauge has fallen by what Stanley (2016) estimates was lost (#1223).
    await expect(clock.locator('.loss-gauge-label')).toHaveText('Marine genera left: 38%');
    // The camera has drawn out to see the traps and Meishan on one side of the world (#1266).
    await expect(globe).toHaveAttribute('data-distance', '4.50');
  });
  await test.step('When they close it, the fumes go', async () => {
    await clock.getByRole('button', { name: 'Close' }).click();
    await expect(clock).toBeHidden();
    await expect(globe).toHaveAttribute('data-fumes', 'off');
    await expect(page.locator('.hud-date')).toHaveText('252 million years ago');
    await expect(page.locator('.deep-speed')).toBeVisible();
  });
  expect(problems).toEqual([]);
});
