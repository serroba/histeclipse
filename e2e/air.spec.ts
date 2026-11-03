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

test('over 540 million years, Air gives CO₂ and O₂ with their ranges, and nitrogen in words', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const note = page.getByTestId('air-note');
  await test.step('Given 300 million years ago, in the late Paleozoic ice age', async () => {
    await page.goto('./?ma=300');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('When they turn on Air', async () => {
    await page.getByRole('button', { name: 'Air', exact: true }).click();
  });
  await test.step('Then CO₂ is given with its ranges and the estimates near then', async () => {
    await expect(page.getByTestId('deep-co2')).toContainText(
      /^Carbon dioxide \(CO₂\): about \d+ ppm/,
    );
    await expect(page.getByTestId('deep-co2')).toContainText('Estimates within 5 million years:');
    await expect(note.getByRole('link', { name: 'Foster, Royer & Lunt 2017' })).toBeVisible();
    await expect(page.getByTestId('deep-co2-chart')).toBeVisible();
  });
  await test.step('And O₂ with its range, and nitrogen in words with its sources', async () => {
    await expect(page.getByTestId('deep-o2')).toContainText(
      /^Oxygen \(O₂\): about \d+% of the air/,
    );
    await expect(note.getByRole('link', { name: 'Mills et al. 2023' })).toBeVisible();
    await expect(page.getByTestId('deep-n2')).toContainText('no record is firm enough to chart');
    await expect(note.getByRole('link', { name: 'Berner 2006' })).toBeVisible();
  });
  await test.step('When they go back past the CO₂ fit, it says how far it reaches', async () => {
    await page.goto('./?ma=500&layers=air');
    await globeRendered(page);
    await showDeepDetails(page);
    await expect(page.getByTestId('deep-co2')).toContainText('reaches 419 million years back');
    await expect(page.getByTestId('deep-o2')).toContainText('Oxygen (O₂): about');
  });
  expect(problems).toEqual([]);
});
