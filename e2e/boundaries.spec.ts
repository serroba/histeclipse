/**
 * Feature: the planetary boundaries (#434). The nine boundaries round Earth in 3D, from the
 * Planetary Health Check 2026: at pre-industrial levels, then growing to 2026's values, seven of
 * nine crossed, then beside Richardson et al. (2023), with the table of values and its notes.
 */

import { collectProblems, expect, globeRendered, test } from './support';

// The scene loads with the sheet and plays its chapters; software rendering on CI is slow.
const PLAYED = { timeout: 20_000 };

test('the boundaries open from the header, grow to 2026 and compare with 2023', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const sheet = page.getByRole('dialog', { name: /Planetary boundaries/ });
  const stage = page.getByTestId('boundary-stage');
  await test.step('Given the globe today', async () => {
    await page.goto('./');
    await globeRendered(page);
  });
  await test.step('When they open the boundaries', async () => {
    await page.getByRole('button', { name: 'Boundaries', exact: true }).click();
  });
  await test.step('Then the nine are drawn round Earth, at pre-industrial levels', async () => {
    await expect(page).toHaveURL(/boundaries=safe/);
    await expect(sheet).toBeVisible();
    await expect(stage).toHaveAttribute('data-rendered', 'true', PLAYED);
    await expect(stage).toHaveAttribute('data-crossed', '0');
    await expect(page.getByTestId('boundary-caption')).toContainText('Holocene');
  });
  await test.step('When they turn to the pressure', async () => {
    await sheet.getByRole('button', { name: 'Pressure' }).click();
  });
  await test.step('Then the wedges grow until seven of nine are crossed', async () => {
    await expect(page).toHaveURL(/boundaries=pressure/);
    await expect(stage).toHaveAttribute('data-crossed', '7', PLAYED);
    const table = page.getByTestId('boundary-table');
    await expect(table).toContainText('Climate change: strongly transgressed');
    await expect(table).toContainText('Ocean acidification: transgressed');
    await expect(table).toContainText('Stratospheric ozone: within');
    await expect(table.locator('[data-variable="co2"]')).toContainText('426 ppm');
  });
  await test.step('When they compare with 2023, then close it', async () => {
    await sheet.getByRole('button', { name: '2023 vs 2026' }).click();
    await expect(page).toHaveURL(/boundaries=compare/);
    await expect(page.getByTestId('boundary-caption')).toContainText('six of nine');
    await sheet.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('Then the globe is back, and the link no longer names the boundaries', async () => {
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/boundaries=/);
  });
  expect(problems).toEqual([]);
});

test('a link opens the comparison complete for less motion, with the report’s own caveats', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await test.step('Given a link to the comparison', async () => {
    await page.goto('./?boundaries=compare');
    await globeRendered(page);
  });
  await test.step('Then it opens complete, without playing', async () => {
    const stage = page.getByTestId('boundary-stage');
    await expect(stage).toHaveAttribute('data-chapter', 'compare', PLAYED);
    await expect(stage).toHaveAttribute('data-playing', 'false');
    await expect(stage).toHaveAttribute('data-crossed', '7');
  });
  await test.step('And the table flags where the 2026 report disagrees with itself', async () => {
    const table = page.getByTestId('boundary-table');
    await expect(table).toContainText('The 2026 table gives 4.4 Tg/yr');
    await expect(table).toContainText('not forest recovering');
  });
  expect(problems).toEqual([]);
});
