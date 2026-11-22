/** The Years bar's range (#749): fitted to a layer turned on, picked, and kept in the link. */

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

test('turning on El Niño fits the Years bar to its years, and the range can be picked back @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const range = page.getByRole('combobox', { name: 'Years shown' });
  await test.step('Given today, the bar over the whole Holocene', async () => {
    await page.goto('./?t=2026-06-15T12:00Z&cam=0,-150,3');
    await globeRendered(page);
    await expect(range).toHaveValue('all');
  });
  await test.step('When they turn on El Niño and La Niña', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'El Niño and La Niña' }).check();
    await page.keyboard.press('Escape');
  });
  await test.step('Then the bar shows its years, the year shown unmoved, and the link keeps them', async () => {
    await expect(range).toHaveValue('1854,2026');
    await expect(page).toHaveURL(/yw=1854,2026/);
    await expect(page).toHaveURL(/t=2026-06-15/);
    await expect(page.getByRole('slider', { name: 'Year in the Holocene' })).toHaveAttribute(
      'min',
      '1854',
    );
  });
  await test.step('And the speeds are set by those years, the slowest a year a second (#915)', async () => {
    const speed = page.getByRole('navigation', { name: 'Year and eclipses' }).getByLabel('Speed');
    await expect(speed.locator('option')).toHaveText(['2 months/s', '1 yr/s', '10 yr/s']);
  });
  await test.step('And the track reads as those years: its marks named, no age band within one age', async () => {
    const track = page.getByRole('group', { name: 'Holocene' });
    await expect(track.locator('.period-round-label', { hasText: '1900' })).toBeVisible();
    await expect(track.locator('.period-bands')).toBeHidden();
  });
  await test.step('When they play, Then no borders or ways of life come with it: El Niño is what is on', async () => {
    const bar = page.getByRole('group', { name: 'Holocene' });
    await bar.getByRole('button', { name: 'Travel through the years' }).click();
    await expect(page.getByRole('button', { name: 'Leave the travel view' })).toBeVisible();
    await expect(page).toHaveURL(/layers=enso(&|$)/);
    await bar.getByRole('button', { name: 'Stop travelling' }).click();
  });
  await test.step('When they pick the whole Holocene again', async () => {
    await range.selectOption({ label: 'The Holocene, 9700 BCE–2026' });
  });
  await test.step('Then the bar spans it, and the link drops the range', async () => {
    await expect(page).not.toHaveURL(/yw=/);
    await expect(page.getByRole('slider', { name: 'Year in the Holocene' })).not.toHaveAttribute(
      'min',
      '1854',
    );
  });
  expect(problems).toEqual([]);
});

test('zooming out of the years goes on into deep time at the same moment, and zooming in comes back (#1074) @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const years = page.getByRole('slider', { name: 'Year in the Holocene' });
  const deep = page.getByRole('navigation', { name: 'Deep time' });
  await test.step('Given the years since 1854, in 2026', async () => {
    await page.goto('./?t=2026-06-15T12:00Z&cam=0,-150,3&yw=1854,2026');
    await globeRendered(page);
  });
  await test.step('When they zoom in, Then the bar shows fewer years, ending in 2026', async () => {
    await page.getByRole('button', { name: 'Show less time' }).click();
    await expect(years).toHaveAttribute('min', '1940');
    await expect(page).toHaveURL(/yw=1940,2026/);
  });
  await test.step('When they zoom out past the Holocene, Then deep time shows the ice ages’ last part, the moment today', async () => {
    const out = page.getByRole('button', { name: 'Show more time' });
    for (let press = 0; press < 12 && !(await deep.isVisible()); press += 1) await out.click();
    await expect(page).toHaveURL(/ma=0&scale=ice&dw=0\.\d+(,|%2C)0$/);
    await expect(deep).toBeVisible();
    await expect(page).not.toHaveURL(/yw=/);
  });
  await test.step('When they zoom in again, Then the years come back, in 2026', async () => {
    const into = deep.getByRole('button', { name: 'Show less time' });
    for (let press = 0; press < 12 && (await deep.isVisible()); press += 1) await into.click();
    await expect(page).not.toHaveURL(/ma=/);
    await expect(page).toHaveURL(/t=2026-06-15/);
    await expect(years).toBeVisible();
    await expect(years).toHaveAttribute('max', '2026');
  });
  await test.step('And no preset is picked while part of the years shows; Years shows them all again', async () => {
    const presets = page.getByRole('group', { name: 'Time range presets' });
    const preset = presets.getByRole('button', { name: 'Years', exact: true });
    await expect(page).toHaveURL(/yw=/);
    await expect(preset).toHaveAttribute('aria-pressed', 'false');
    await preset.click();
    await expect(page).not.toHaveURL(/yw=/);
    await expect(preset).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/t=2026-06-15/);
  });
  expect(problems).toEqual([]);
});
