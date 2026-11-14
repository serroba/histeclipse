/**
 * Feature: Radiocarbon dates (#149). Where archaeologists have dated remains, from p3k14c,
 * calibrated and counted by square and 250 years; a place's sites, and how one of its dates
 * was found.
 */

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

test('radiocarbon dates shade where remains were dated, and a place’s card dates one @acceptance', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const note = page.getByTestId('layer-note-dates');
  await test.step('Given 2000 BCE, standing in southern England', async () => {
    await page.goto('./?t=-1999-06-01T12:00&loc=51.5,-1.5');
    await globeRendered(page);
  });
  await test.step('When they turn on Radiocarbon dates', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Radiocarbon dates' }).check();
  });
  await test.step('Then squares with dates are shaded, and the note says what they are', async () => {
    await expect(page).toHaveURL(/layers=[a-zA-Z,]*dates/);
    await expect(globe).toHaveAttribute('data-date-cells', /^[1-9]\d*$/, { timeout: 20_000 });
    await expect(note).toHaveText(/^\d+ dates in this square for 2050 BCE–1801 BCE: /, {
      timeout: 20_000,
    });
  });
  await test.step('When they ask how a date here was found', async () => {
    await page.getByRole('button', { name: 'How was a date here found?' }).click();
  });
  await test.step('Then the dating card carries a real sample across the curve', async () => {
    const card = page.getByRole('dialog', { name: 'How was this dated?' });
    await expect(card.getByTestId('dating-note')).toContainText('from p3k14c');
    await expect(card.getByTestId('dating-result')).toContainText('IntCal20');
    await expect(card.getByTestId('dating-ranges').locator('li').first()).toContainText('BCE');
    await card.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('And the sources name the database', async () => {
    await page.locator('.layers-dialog').getByRole('button', { name: 'Close' }).click();
    await openSources(page);
    await expect(page.getByRole('link', { name: 'p3k14c' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1038/s41597-022-01118-7',
    );
  });
  expect(problems).toEqual([]);
});
