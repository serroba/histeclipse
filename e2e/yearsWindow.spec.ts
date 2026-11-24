/** The Years bar's range (#749): fitted to a layer turned on, picked, and kept in the link. */

import {
  collectProblems,
  expect,
  globeRendered,
  openLayers,
  test,
  pickSpan,
  spanPreset,
} from './support';

test('turning on El Niño fits the Years bar to its years, and the Years preset shows them all again @acceptance @mobile', async ({
  page,
}) => {
  // 16–25 s on CI's passing runs, mobile: a busy runner took it past 30 s (#1216).
  test.slow();
  const problems = collectProblems(page);
  await test.step('Given today, the bar over the whole Holocene', async () => {
    await page.goto('./?t=2026-06-15T12:00Z&cam=0,-150,3');
    await globeRendered(page);
    await expect(spanPreset(page, 'Years')).toHaveAttribute('aria-pressed', 'true');
  });
  await test.step('When they turn on El Niño and La Niña', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'El Niño and La Niña' }).check();
    await page.keyboard.press('Escape');
  });
  await test.step('Then the bar shows its years, the year shown unmoved, and the link keeps them', async () => {
    await expect(spanPreset(page, 'Years')).toHaveAttribute('aria-pressed', 'false');
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
  await test.step('When they pick the Years preset (#1116)', async () => {
    await pickSpan(page, 'Years');
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
  // 16–25 s on CI's passing runs, mobile: a busy runner took it past 30 s (#1216).
  test.slow();
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
    const preset = spanPreset(page, 'Years');
    await expect(page).toHaveURL(/yw=/);
    await expect(preset).toHaveAttribute('aria-pressed', 'false');
    await pickSpan(page, 'Years');
    await expect(page).not.toHaveURL(/yw=/);
    await expect(preset).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/t=2026-06-15/);
  });
  expect(problems).toEqual([]);
});

test('a sideways swipe slides the Years bar’s window, the year kept, and the link keeps it (#749)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'a trackpad’s swipe');
  const problems = collectProblems(page);
  await test.step('Given 1500 CE, the bar over 1400 to 1600', async () => {
    await page.goto('./?t=1500-06-01T12:00Z&yw=1400,1600');
    await globeRendered(page);
  });
  await test.step('When they swipe the track sideways, towards today', async () => {
    await page.getByRole('group', { name: 'Holocene' }).locator('.history-lane').hover();
    await page.mouse.wheel(60, 0);
  });
  await test.step('Then the window slides later, as long as before, and 1500 stays', async () => {
    await expect(page).not.toHaveURL(/yw=1400,1600/);
    const shown = new URL(page.url()).searchParams.get('yw') ?? '';
    const [first = 0, last = 0] = shown.split(',').map(Number);
    expect(first).toBeGreaterThan(1400);
    expect(last - first).toBe(200);
    await expect(page.locator('.hud-date')).toContainText('1500');
  });
  expect(problems).toEqual([]);
});
