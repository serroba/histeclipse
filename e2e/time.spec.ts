/**
 * Feature: Time. One switch at the top says how far back time reaches: the Holocene's years
 * (the calendar, states and eclipses), the ice ages, 540 million years, or all of Earth's
 * history. Going deeper is zooming out, to the same moment; famous eclipses belong to the years.
 */

import { collectProblems, globeRendered, expect, pickSpan, test } from './support';

test('the top row picks how far back time reaches; famous eclipses sit with the years', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const spans = page.getByRole('group', { name: 'Time span' });
  await test.step('Given a reader in 2024', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
  });
  await test.step('Then the top row offers four spans, with Years on', async () => {
    await expect(spans.getByRole('button')).toHaveText(['Years', 'Ice ages', '540 Myr', '4.6 Gyr']);
    await expect(spans.getByRole('button', { name: 'Years' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  await test.step('And Famous eclipses is in the year bar, not the top row', async () => {
    const bar = page.getByRole('navigation', { name: 'Year and eclipses' });
    await expect(bar.getByRole('button', { name: 'Famous eclipses' })).toBeVisible();
    await expect(page.locator('.hud').getByRole('button', { name: 'Famous eclipses' })).toHaveCount(
      0,
    );
  });
  await test.step('When they pick Years again, nothing changes', async () => {
    const before = page.url();
    await pickSpan(page, 'Years');
    expect(page.url()).toBe(before);
  });
  expect(problems).toEqual([]);
});

test('a deeper span opens at its oldest moment, and coming back returns to the date and eclipse left', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const spans = page.getByRole('group', { name: 'Time span' });
  await test.step('Given a reader at the 2024 eclipse', async () => {
    await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
    await globeRendered(page);
  });
  await test.step('When they pick 540 Myr', async () => {
    await pickSpan(page, '540 Myr');
  });
  await test.step('Then deep time opens 540 million years ago, ready to play forward, with no famous eclipses', async () => {
    await expect(page).toHaveURL(/&ma=540(&|$)/);
    await expect(page.locator('.hud-date')).toHaveText('540 million years ago');
    await expect(spans.getByRole('button', { name: '540 Myr' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Famous eclipses' })).toBeHidden();
  });
  await test.step('When they pick Years', async () => {
    await pickSpan(page, 'Years');
  });
  await test.step('Then the date and eclipse they left come back', async () => {
    await expect(page).not.toHaveURL(/ma=/);
    await expect(page.locator('.hud-date')).toHaveText('8 April 2024 CE');
    await expect(page).toHaveURL(/sel=solar:2024-04-08/);
    await expect(page.getByLabel('Year', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Famous eclipses' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('each deeper span opens at its own oldest moment', async ({ page }) => {
  for (const [span, ma, said] of [
    ['Ice ages', '2.6', '2,600,000 years ago'],
    ['540 Myr', '540', '540 million years ago'],
    ['4.6 Gyr', '4568', '4,568 million years ago'],
  ] as const) {
    await test.step(`Given 6000 BCE, when they pick ${span}`, async () => {
      await page.goto('./?t=-5999-06-01T12:00');
      await globeRendered(page);
      await pickSpan(page, span);
    });
    await test.step(`Then it opens ${said}`, async () => {
      await expect(page).toHaveURL(new RegExp(`&ma=${ma.replace('.', '\\.')}(&|$)`));
      await expect(page.locator('.hud-date')).toHaveText(said);
    });
  }
  await test.step('And from one deep span to another, the same', async () => {
    await pickSpan(page, 'Ice ages');
    await expect(page).toHaveURL(/&ma=2\.6&scale=ice/);
  });
});

test('a link in the Holocene’s reach comes back to the years as its year', async ({ page }) => {
  await test.step('Given a link to 10,000 years ago, on the ice ages', async () => {
    await page.goto('./?ma=0.01&scale=ice');
    await globeRendered(page);
  });
  await test.step('When they pick Years, the year is 8051 BCE', async () => {
    await pickSpan(page, 'Years');
    await expect(page.getByLabel('Year', { exact: true })).toHaveValue('8051');
  });
});

test('a link to deep time opens with its span picked', async ({ page }) => {
  await test.step('Given a link 985,000 years back', async () => {
    await page.goto('./?ma=0.985&scale=ice');
    await globeRendered(page);
  });
  await test.step('Then Ice ages is the span shown', async () => {
    const spans = page.getByRole('group', { name: 'Time span' });
    await expect(spans.getByRole('button', { name: 'Ice ages' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(spans.getByRole('button', { name: 'Years' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
