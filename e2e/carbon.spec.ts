/**
 * Feature: Carbon-14 made in the sky (#269). Where cosmic rays make carbon-14, most over the
 * poles; a card to try another field or Sun and follow it into living things; and, beyond
 * 50,000 years, what radiocarbon cannot date.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

/** The glow's rates by latitude, equator first, as the globe reports them. */
async function glow(page: Page): Promise<number[]> {
  const value = (await page.getByTestId('globe').getAttribute('data-c14-glow')) ?? 'off';
  return value === 'off' ? [] : value.split(' ').map(Number);
}

test('cosmic rays make carbon-14 mostly over the poles, more as the shield weakens', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const note = page.getByTestId('layer-note-carbonMade');
  const dialog = page.getByRole('dialog', { name: 'How is carbon-14 made?' });
  await test.step('Given the years, standing in Europe', async () => {
    await page.goto('./?t=1500-06-01T12:00&loc=48,10');
    await globeRendered(page);
  });
  await test.step('When they turn on Carbon-14 made in the sky', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Carbon-14 made in the sky' }).check();
  });
  await test.step('Then the globe glows, brightest over the poles', async () => {
    await expect(page).toHaveURL(/layers=[a-zA-Z,]*carbonMade/);
    await expect(note).toHaveText(/most is made over the poles/);
    await expect.poll(async () => (await glow(page)).length).toBe(19);
    const rates = await glow(page);
    expect(rates.at(-1)).toBe(1);
    expect(rates[0]).toBeLessThan(0.25);
  });
  await test.step('When they ask how it is made', async () => {
    await page.getByRole('button', { name: 'How is it made?' }).click();
  });
  await test.step('Then the card explains it, and how it reaches living things', async () => {
    await expect(dialog).toContainText('n + ¹⁴N → ¹⁴C + p');
    await expect(dialog.getByRole('radio', { name: 'At the moment shown' })).toBeChecked();
    await expect(dialog.getByTestId('carbon-made-notes')).toContainText('GGF100k');
    await expect(dialog.getByTestId('carbon-made-result')).toContainText(
      /times as much over the poles as over the equator/,
    );
    await expect(dialog.getByTestId('carbon-made-path')).toContainText('every 5,730 years');
    await expect(dialog.getByTestId('carbon-made-path')).toContainText('400–600 radiocarbon years');
  });
  await test.step('When they take the field back to the Laschamp excursion', async () => {
    await dialog.getByRole('radio', { name: 'Laschamp excursion, 41,000 years ago' }).check();
  });
  await test.step('Then about twice as much is made, nearly as much at the equator', async () => {
    await expect(dialog.getByTestId('carbon-made-result')).toContainText(
      /, 2\.\d times today’s average/,
    );
    await expect(dialog.getByTestId('carbon-made-notes')).toContainText('GGF100k');
    await expect.poll(async () => (await glow(page))[0] ?? 0).toBeGreaterThan(0.8);
  });
  await test.step('And the sources name the model', async () => {
    await dialog.getByRole('button', { name: 'Close' }).click();
    await openSources(page);
    await expect(page.getByRole('link', { name: 'Kovaltsov et al. 2012' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1016/j.epsl.2012.05.036',
    );
  });
  expect(problems).toEqual([]);
});

test('the glow follows the field through the ice ages, and beyond 50,000 years names other clocks', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const note = page.getByTestId('layer-note-carbonMade');
  await test.step('Given the ice ages 30,000 years ago, with the layer on', async () => {
    await page.goto('./?ma=0.03&scale=ice&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
  });
  let equatorThen = 0;
  await test.step('Then it glows for the field then, as GGF100k has it', async () => {
    await expect(note).toContainText(
      /The field at the moment shown, 6\.\d × 10²² A m² \(GGF100k\)/,
    );
    await expect.poll(async () => (await glow(page)).length).toBe(19);
    equatorThen = (await glow(page))[0] ?? 0;
  });
  await test.step('When they go to the Laschamp excursion, 41,000 years ago', async () => {
    await page.goto('./?ma=0.041&scale=ice&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then the field is weak, more is made nearer the equator, and other models are named', async () => {
    await expect(note).toContainText('is weak, 2.');
    await expect(note).toContainText('Korte et al. 2019');
    await expect.poll(async () => (await glow(page))[0] ?? 0).toBeGreaterThan(equatorThen * 1.5);
  });
  await test.step('When they go back 100,000 years', async () => {
    await page.goto('./?ma=0.1&scale=ice&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then nothing glows, and the note names other clocks', async () => {
    await expect(note).toContainText('too little carbon-14 is left to measure');
    await expect(note).toContainText('potassium–argon and uranium–lead');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-c14-glow', 'off');
  });
  await test.step('When they go to 250 million years ago', async () => {
    await page.goto('./?ma=250&scale=all&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then it says so there too', async () => {
    await expect(note).toContainText('uranium–lead');
  });
  expect(problems).toEqual([]);
});

test('a cosmic ray’s shower makes carbon-14, step by step, under the field picked', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const caption = page.getByTestId('shower-caption');
  const dialog = page.getByRole('dialog', { name: 'How is carbon-14 made?' });
  await test.step('Given the card on how carbon-14 is made, with today’s field', async () => {
    await page.goto('./?t=1500-06-01T12:00&loc=48,10&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
    await page.getByRole('button', { name: 'How is it made?' }).click();
  });
  await test.step('When they watch a cosmic ray make carbon-14', async () => {
    await dialog.getByRole('button', { name: 'Watch a cosmic ray make carbon-14' }).click();
  });
  await test.step('Then the field turns the equator’s ray away, and the caption says so', async () => {
    await expect(dialog).toBeHidden();
    await expect(caption).toContainText('bends this one back out to space', { timeout: 20_000 });
  });
  await test.step('And it plays every step, from the shower to carbon dioxide, then clears', async () => {
    await expect(globe).toHaveAttribute('data-showers-played', '1', { timeout: 60_000 });
    await expect(globe).toHaveAttribute('data-shower-steps', 'rays shower capture dioxide drift');
    await expect(caption).toBeHidden();
  });
  await test.step('When they pick the Laschamp excursion and watch again', async () => {
    await openLayers(page);
    await page.getByRole('button', { name: 'How is it made?' }).click();
    await dialog.getByRole('radio', { name: 'Laschamp excursion, 41,000 years ago' }).check();
    await dialog.getByRole('button', { name: 'Watch a cosmic ray make carbon-14' }).click();
  });
  await test.step('Then the rays reach the air at the equator too', async () => {
    await expect(caption).toContainText('reach the air at the equator too', { timeout: 20_000 });
    await expect(globe).toHaveAttribute('data-showers-played', '2', { timeout: 60_000 });
  });
  expect(problems).toEqual([]);
});
