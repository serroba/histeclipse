/**
 * Feature: a layer on with nothing at the moment shown says so the same way everywhere (#751):
 * its chip, its row in Layers, and deep time's dock, each in words a phone shows, each with the
 * same step to where its data is.
 */

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

test('in 1977, a gap in the ozone record: the chip and the Layers row agree, and the row goes to 1979 @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const panel = page.getByRole('dialog', { name: 'Layers' });
  await test.step('Given October 1977 with the ozone hole on, and Layers open', async () => {
    await page.goto('./?t=1977-10-01T12:00Z&layers=ozone&cam=-70,40,3');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then its chip and its row both say there is none, and offer 1979', async () => {
    const chip = page.getByRole('group', { name: 'Layers on' }).locator('[data-layer="ozone"]');
    await expect(chip.first()).toContainText('none in 1977 CE');
    const row = panel.locator('.layer-item').filter({ has: page.getByTestId('layer-note-ozone') });
    await expect(row).toHaveClass(/is-elsewhere/);
    await expect(page.getByTestId('layer-note-ozone')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Go to 1979 CE' })).toBeVisible();
  });
  await test.step('When they take the row’s step, Then 1979 is shown and drawn; the row says nothing more', async () => {
    await panel
      .locator('.layer-item')
      .filter({ has: page.getByTestId('layer-note-ozone') })
      .getByRole('button', { name: 'Go to 1979 CE' })
      .click();
    await expect(page.locator('.hud-date')).toContainText('1979');
    await expect(globe).not.toHaveAttribute('data-ozone', 'off');
    await expect(
      panel.locator('.layer-item.is-elsewhere [data-testid="layer-note-ozone"]'),
    ).toHaveCount(0);
  });
  expect(problems).toEqual([]);
});

test('before the plates’ record, deep time’s dock says so in words and goes to their oldest @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const line = page.locator('.deep-dock-why');
  await test.step('Given 2,000 million years ago with Plates on', async () => {
    await page.goto('./?ma=2000&scale=eons&layers=plates');
    await globeRendered(page);
  });
  await test.step('Then under the dock, in words, why nothing is drawn, not in a tooltip only', async () => {
    await expect(line).toBeVisible();
    await expect(line).toContainText('Plates: none before 1,800 million years ago');
  });
  await test.step('When they take its step, Then deep time goes to the plates’ oldest, and the line goes', async () => {
    await line.getByRole('button', { name: /^Go to / }).click();
    await expect(page).toHaveURL(/ma=1800/);
    await expect(line).toHaveCount(0);
  });
  expect(problems).toEqual([]);
});
