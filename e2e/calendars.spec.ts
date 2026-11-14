// Calendars, tablets and borders: the years counted other ways, records checked, states picked.

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

test('with a long calendar picked, every control in the bar stays within it', async ({ page }) => {
  await page.goto('./?t=2024-01-01T00:00&layers=eclipses');
  await globeRendered(page);
  const bar = page.locator('.timeline');
  for (const calendar of ['babylonian', 'egyptian']) {
    await page.getByRole('combobox', { name: 'Era', exact: true }).selectOption(calendar);
    await expect(page.getByRole('button', { name: 'Famous eclipses' })).toBeVisible();
    const edge = await bar.boundingBox();
    if (edge === null) throw new Error('no bar');
    // The year's eclipses scroll within their own list; everything else must fit (#400).
    for (const control of await bar
      .locator(':is(button, input, select):visible:not(.eclipse-chip)')
      .all()) {
      const box = await control.boundingBox();
      if (box === null) throw new Error('control without a box');
      expect(box.x).toBeGreaterThanOrEqual(edge.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(edge.x + edge.width + 1);
    }
  }
});

test('years can be counted in the Hebrew calendar, and the link keeps it @acceptance', async ({
  page,
}) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
  await globeRendered(page);
  const year = page.getByLabel('Year', { exact: true });
  const era = page.getByLabel('Era', { exact: true });
  await era.selectOption('hebrew');
  await expect(page).toHaveURL(/years=hebrew/);
  await expect(year).toHaveValue('5784');
  await expect(page.locator('.hud-detail')).toContainText('29 Adar II 5784 AM');
  // 5784 ran from September 2023 to October 2024: it holds the annular eclipse of October 2023
  // and the total one of April 2024, listed by their Hebrew dates.
  await expect(page.getByRole('button', { name: /29 Tishri\s*Annular solar/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /29 Adar II\s*Total solar/ })).toBeVisible();

  await page.getByRole('button', { name: 'Next year' }).click();
  await expect(year).toHaveValue('5785');
  await expect(page).toHaveURL(/t=2025-/);

  await era.selectOption('CE');
  await expect(page).not.toHaveURL(/years=/);
  await expect(year).toHaveValue('2025');
});

test('years can be counted in the Chinese calendar, with the cycle names', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08&years=chinese');
  await globeRendered(page);
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('4721');
  // The new moon fell after midnight in Beijing: the eclipse is on the last day of the month.
  await expect(page.locator('.hud-detail')).toContainText(
    '2nd month, day 30, 4721 HE (甲辰 jiǎchén, Wood Dragon)',
  );
  await expect(page.getByRole('button', { name: /2nd month 30\s*Total solar/ })).toBeVisible();
});

test('the Babylonian calendar dates Jerusalem’s capture to 2 Addaru, 16 March 597 BCE', async ({
  page,
}) => {
  await page.goto('./?t=-596-03-16T12:00&years=babylonian');
  await globeRendered(page);
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('150');
  await expect(page.locator('.hud-detail')).toContainText(
    '2 Addaru, year 7 of Nebuchadnezzar II · 150 Bab. (598/597 BCE)',
  );
  // The canon counts Egyptian years, which began in February: there it is already year 8.
  await expect(page.locator('.hud-detail')).toContainText('Ptolemy’s canon: Nabokolassaros 8');
});

test('VAT 4956 can be checked against two candidate years, record by record', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?t=-567-04-23T12:00&years=babylonian&layers=eclipses');
  await globeRendered(page);
  // The check shows with the Babylonian calendar only.
  await page.goto('./?t=-567-04-23T12:00&layers=eclipses');
  await globeRendered(page);
  await expect(page.getByRole('button', { name: 'Check a tablet' })).toBeHidden();
  await page.getByLabel('Era', { exact: true }).selectOption('babylonian');
  await page.getByRole('button', { name: 'Check a tablet' }).click();
  const summary = page.getByTestId('tablet-summary');
  await expect(summary).toHaveText('20 of 21 records fit 568/567 BCE.', { timeout: 30_000 });
  await page.getByRole('button', { name: '588 BCE' }).click();
  await expect(summary).toHaveText('10 of 21 records fit 588/587 BCE.', { timeout: 30_000 });
  await page.getByRole('button', { name: '568 BCE' }).click();
  await expect(summary).toHaveText('20 of 21 records fit 568/567 BCE.', { timeout: 30_000 });
  // A record opens the sky over Babylon that evening.
  await page.locator('[data-record="II-18-venus"]').click();
  await expect(page).toHaveURL(/mode=sky/);
  await expect(page).toHaveURL(/t=-0567-06-08T/);
  // The record stays on screen with its verdict, its bodies are pointed out, and the way back
  // to the list is one tap.
  const record = page.getByTestId('tablet-record');
  await expect(record).toContainText('Venus');
  await expect(record).toContainText('✓ fits');
  await expect(page.locator('.sky-label.is-mark', { hasText: 'Venus' })).toBeVisible();
  await record.getByRole('button', { name: 'Back to the tablet' }).click();
  await expect(page.getByRole('dialog', { name: /VAT 4956/ })).toBeVisible();
  await expect(page.locator('[data-record="II-18-venus"]')).toBeFocused();
  await page.keyboard.press('Escape');
  // Leaving the sky lets the record go.
  await page.getByRole('button', { name: 'Orbit' }).click();
  await expect(record).toBeHidden();
  expect(problems).toEqual([]);
});

test('Ptolemy’s eclipse of 721 BCE is listed on 29 Thoth in year 27 of Nabonassar', async ({
  page,
}) => {
  await page.goto('./?t=-720-03-19T12:00&years=egyptian&layers=eclipses');
  await globeRendered(page);
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('27');
  await expect(page.getByLabel('Era', { exact: true })).toHaveValue('egyptian');
  await expect(page.getByRole('button', { name: /29 Thoth\s*Total lunar/ })).toBeVisible();

  // Typing a year jumps to it, in the same calendar.
  const year = page.getByLabel('Year', { exact: true });
  await year.fill('1');
  await year.press('Enter');
  await expect(page).toHaveURL(/t=-0746-/);
});

test('past borders can come from Cliopatria, OpenHistoricalMap, or both to compare', async ({
  page,
}) => {
  await page.goto('./?t=1500-06-01T12:00&cam=5,20,2.6&layers=lunar,solar,empires');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await openLayers(page);
  const source = page.getByLabel('Borders from');
  await expect(source).toHaveValue('cliopatria');
  await expect(globe).toHaveAttribute('data-ohm-borders', 'off');

  await source.selectOption('both');
  await expect(page).toHaveURL(/borders=both/);
  await expect(globe).toHaveAttribute('data-ohm-borders', /^[1-9]\d*$/);
  await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  await openSources(page);
  await expect(page.getByRole('link', { name: 'OpenHistoricalMap' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cliopatria' })).toBeVisible();
  // A state both sources name nearby is named once, marked as named by both (#163).
  await expect(page.locator('.empire-label.is-both').first()).toBeAttached();
  const shown = await page.locator('.empire-label:not([hidden])').allTextContents();
  expect(shown.filter((name, index) => shown.indexOf(name) !== index)).toEqual([]);

  await source.selectOption('ohm');
  await expect(globe).toHaveAttribute('data-empires', '0');
  await expect(page.getByRole('link', { name: 'Cliopatria' })).toBeHidden();
  // OpenHistoricalMap has kingdoms Cliopatria lacks, such as Mutapa.
  await expect(page.locator('.empire-label.is-ohm', { hasText: /Mutapa/ }).first()).toBeAttached();
});

test('picking a state marks the eclipses seen from it, and steps through them', async ({
  page,
}) => {
  // 763 BCE: the eclipse of the Assyrian eponym list, total in Assyria on 15 June.
  await page.goto('./?t=-762-06-15T12:00&cam=35,43,3&layers=lunar,solar,empires');
  await globeRendered(page);
  const seen = page.getByLabel('Seen from', { exact: true });
  await expect(seen.locator('option', { hasText: 'Neo-Assyrian Empire' })).toHaveCount(1);
  await seen.selectOption('Neo-Assyrian Empire');
  await expect(page).toHaveURL(/seen=Neo-Assyrian\+Empire/);
  await expect(page.getByRole('button', { name: /Total solar\s*seen, total/ })).toBeVisible();
  await expect(page.getByTestId('seen-status')).toHaveText(/^[1-9]\d* of \d+ seen$/);

  // The next one seen from Assyria: the Moon, eclipsed a fortnight later.
  await page.getByRole('button', { name: 'Next eclipse seen from there' }).click();
  await expect(page).toHaveURL(/sel=lunar:-0762-06-30/);
  await expect(page.locator('.eclipse-chip[aria-pressed="true"]')).toContainText(/seen|maybe/);

  await seen.selectOption('Anywhere');
  await expect(page).not.toHaveURL(/seen=/);
  await expect(page.locator('.eclipse-seen')).toHaveCount(0);
});
