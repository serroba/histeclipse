/**
 * Feature: The air in the ice ages. Carbon dioxide and methane from Antarctic ice, each with
 * its level at the moment shown against 1750's, and a small chart along the slider.
 */

import { collectProblems, expect, globeRendered, showDeepDetails, test } from './support';

test('the Air layer gives carbon dioxide and methane at the moment, against 1750', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await test.step('Given the Last Glacial Maximum, 21,000 years ago', async () => {
    await page.goto('./?ma=0.021&scale=ice');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('When they turn on Air', async () => {
    await page.getByRole('button', { name: 'Air' }).click();
  });
  await test.step('Then each gas says its level then and how it compares, with its source', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*air/);
    await expect(page.getByTestId('gas-co2')).toHaveText(
      /^Carbon dioxide \(CO₂\): 1[89]\d ppm \(±\d+\), 6\d% of the 1750 level \(278 ppm\)\. Bereiter et al\. 2015/,
    );
    await expect(page.getByTestId('gas-ch4')).toHaveText(/^Methane \(CH₄\): \d+ ppb/);
    await expect(page.locator('.gas-chart')).toHaveCount(2);
  });
  await test.step('When they go back 1.5 million years, before the cores', async () => {
    await page.goto('./?ma=1.5&scale=ice&layers=air');
    await globeRendered(page);
  });
  await test.step('Then it says how far the ice cores reach', async () => {
    await expect(page.getByTestId('gas-co2')).toContainText(
      'the ice cores reach 805,669 years back, not this far.',
    );
  });
  expect(problems).toEqual([]);
});
