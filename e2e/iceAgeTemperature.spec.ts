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
    await expect(globe).toHaveAttribute('data-temperature', /krapp\/22\.png .*krapp\/22\.png$/);
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
