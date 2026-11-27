/**
 * Feature: temperature through the ice ages (#457). On the ice-age scale the Temperature layer
 * colours the land by Krapp et al.'s (2021) maps, 2,000 years apart: by default as the change
 * from today, blue colder and red warmer; or, switched, as the temperature itself.
 */

import { collectProblems, expect, globeRendered, showDeepDetails, test } from './support';

test('the last ice age shows on the land as cold, against today, or as it was', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  await test.step('Given the last glacial maximum, 22,000 years ago, with Temperature on', async () => {
    await page.goto('./?ma=0.022&scale=ice&layers=temperature');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('Then the land is coloured by its change from today', async () => {
    await expect(globe).toHaveAttribute('data-temperature', /krapp\/20\.png .*krapp\/22\.png$/);
    await expect(globe).toHaveAttribute('data-temperature-change', 'true');
    await expect(page.locator('.temperature-heading')).toContainText(
      'how much warmer or colder than today',
    );
    const key = page.getByTestId('temperature-change-key');
    await expect(key).toBeVisible();
    await expect(key).toContainText('−20 °C or colder: under an ice age’s cold');
    await expect(key).toContainText('+10 °C or warmer: much warmer');
    await expect(page.getByTestId('temperature-key')).toBeHidden();
    await expect(page.getByTestId('temperature-map')).toContainText(
      'The globe shows Krapp et al. 2021.',
    );
    await expect(page.getByTestId('temperature-map')).toContainText('land only');
    await expect(page.getByTestId('temperature-mean')).toContainText(
      'Krapp et al. 2021, land 9.0 °C (today 13.4 °C)',
    );
  });
  await test.step('When they switch the colours to the temperature itself', async () => {
    await page.getByLabel('Colours show').selectOption('actual');
  });
  await test.step('Then the globe shows °C, and the link keeps the choice', async () => {
    await expect(page).toHaveURL(/tshow=actual/);
    await expect(globe).toHaveAttribute('data-temperature-change', 'false');
    await expect(page.getByTestId('temperature-key')).toBeVisible();
    await expect(page.getByTestId('temperature-change-key')).toBeHidden();
  });
  await test.step('And beyond 800,000 years the ice-age scale shows none', async () => {
    await page.goto('./?ma=1.5&scale=ice&layers=temperature');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-temperature', 'off');
  });
  expect(problems).toEqual([]);
});

test('playing the ice ages beside the temperature chart goes at its pace, on to the latest measured year (#1276)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const chart = page.getByTestId('holocene-panel');
  await test.step('Given 3,000 years ago over the ice ages, with Temperature and its chart on', async () => {
    await page.goto('./?ma=0.003&scale=ice&layers=temperature');
    await globeRendered(page);
    await expect(chart).toHaveAttribute('data-year', '-1050');
  });
  await test.step('When they play', async () => {
    await page.getByRole('button', { name: 'Play' }).click();
  });
  await test.step('Then the industrial era has its seconds on the chart, finer than the bar keeps', async () => {
    // At one speed in years it went by in a hundredth of a second (#1276); now about three.
    let year = 0;
    await expect
      .poll(
        async () => {
          year = Number(await chart.getAttribute('data-year'));
          return year;
        },
        { intervals: [100] },
      )
      .toBeGreaterThan(1850);
    // Caught before 1950 and the draw on past it: the year the poll saw, not a later read.
    expect(year).toBeLessThan(1951);
    // And the header says the years, not "Today", through the last thousand (#1285).
    await expect(page.locator('.hud-date')).toHaveText(/^(1[89]\d\d|20\d\d)$/);
  });
  await test.step('And the chart draws on past 1950, deep time’s present, to its latest year', async () => {
    await expect(chart).toHaveAttribute('data-complete', 'true', { timeout: 15_000 });
    expect(Number(await chart.getAttribute('data-year'))).toBeGreaterThan(2020);
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page).toHaveURL(/ma=0(&|$)/);
  });
  await test.step('And the globe shows the measured warming of the chart’s latest years, and says so (#1283)', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute(
      'data-temperature',
      /warming\/2024\.png/,
    );
    await showDeepDetails(page);
    await expect(page.locator('.temperature-note')).toContainText('measured: Berkeley Earth');
    // The header at the chart's latest year, the measured warming named.
    await expect(page.locator('.hud-date')).toHaveText(/^20[2-3]\d$/);
    await expect(page.locator('.hud-detail')).toContainText('measured warming');
  });
  expect(problems).toEqual([]);
});

test('at today on the 540 Myr scale, the globe shows the latest measured warming, and the header says so (#1289)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await test.step('Given today on the 540 Myr scale with Temperature on', async () => {
    await page.goto('./?ma=0&scale=all&layers=temperature');
    await globeRendered(page);
  });
  await test.step('Then the globe is hotter, measured, and the header names it', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute(
      'data-temperature',
      /warming\/2024\.png/,
    );
    await expect(page.locator('.hud-date')).toHaveText('Today');
    await expect(page.locator('.hud-detail')).toContainText('Measured warming since 1850–1900');
    await showDeepDetails(page);
    await expect(page.locator('.temperature-note')).toContainText('measured: Berkeley Earth');
  });
  await test.step('When they go a million years back, Then the models’ maps again', async () => {
    await page.goto('./?ma=1&scale=all&layers=temperature');
    await globeRendered(page);
    await expect(page.getByTestId('globe')).not.toHaveAttribute('data-temperature', /warming/);
    await expect(page.locator('.hud-detail')).not.toContainText('Measured warming');
  });
  expect(problems).toEqual([]);
});
