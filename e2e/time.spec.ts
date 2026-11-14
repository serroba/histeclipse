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
    await page.goto('./?t=2024-04-08T18:17&layers=eclipses');
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

test('a deeper span opens at its oldest moment, and coming back returns to the date and eclipse left @acceptance', async ({
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

test('each time bar names its two ends, reads the moment under the pointer, and brackets the chapter shown', async ({
  page,
}, info) => {
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  await test.step('Given 250 million years ago, on the 540 Myr span', async () => {
    await page.goto('./?ma=250&scale=all');
    await globeRendered(page);
  });
  await test.step('Then the bar’s ends are named', async () => {
    await expect(bar.getByTestId('scale-start')).toHaveText('540 Ma');
    await expect(bar.getByTestId('scale-start')).toHaveAttribute('title', '540 million years ago');
    await expect(bar.getByTestId('scale-end')).toHaveText('now');
  });
  await test.step('And the chapter shown, the Triassic, is bracketed over its length', async () => {
    const triassic = bar.getByRole('button', { name: /^Triassic, / });
    const bracket = bar.locator('.period-bracket');
    await expect(bracket).toBeVisible();
    const [band, mark] = [await triassic.boundingBox(), await bracket.boundingBox()];
    if (band === null || mark === null) throw new Error('no layout');
    expect(Math.abs(mark.x - band.x)).toBeLessThan(2);
    expect(Math.abs(mark.width - band.width)).toBeLessThan(3);
  });
  await test.step('When the pointer rests a third of the way along', async () => {
    test.skip(info.project.name === 'mobile', 'no pointer to rest on a phone');
    const row = await bar.getByRole('group', { name: 'Geological periods' }).boundingBox();
    if (row === null) throw new Error('no bands');
    await page.mouse.move(row.x + row.width / 3, row.y - 20);
    await test.step('Then it reads the moment there and its chapter', async () => {
      await expect(bar.getByTestId('scale-reading')).toHaveText(
        /^3\d\d(\.\d)? million years ago · (Devonian|Carboniferous)$/,
      );
    });
  });
});

test('the years’ bar runs from 9700 BCE to this year, and marks the age shown even after 1950', async ({
  page,
}) => {
  const bar = page.getByRole('group', { name: 'Holocene' });
  await test.step('Given 2000 CE', async () => {
    await page.goto('./?t=2000-06-01T12:00');
    await globeRendered(page);
  });
  await test.step('Then its ends are 9700 BCE and this year, and the Meghalayan is the age shown', async () => {
    await expect(bar.getByTestId('scale-start')).toHaveText('9700 BCE');
    await expect(bar.getByTestId('scale-end')).toHaveText(/^20\d\d$/);
    await expect(bar.getByTestId('scale-end')).toHaveAttribute('title', /^20\d\d CE$/);
    await expect(bar.getByRole('button', { name: /^Meghalayan, / })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

test('playing, the chapter rides over the thumb with how long it lasted; at rest, round marks show', async ({
  page,
}) => {
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const chapter = bar.getByTestId('scale-chapter');
  await test.step('Given 500 million years ago, at rest', async () => {
    await page.goto('./?ma=500&scale=all');
    await globeRendered(page);
  });
  await test.step('Then round marks stand between the ends, and no chapter rides the thumb', async () => {
    await expect(bar.locator('.period-round')).toHaveCount(2);
    await expect(chapter).toBeHidden();
  });
  await test.step('When they play', async () => {
    await bar.getByRole('button', { name: 'Play', exact: true }).click();
  });
  await test.step('Then the chapter shown rides over the thumb, named with its length', async () => {
    await expect(chapter).toBeVisible();
    await expect(chapter).toHaveText(/^[A-Z][a-z]+ · [\d.,]+ Myr$/);
  });
  await test.step('When they pause, it goes', async () => {
    await bar.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(chapter).toBeHidden();
  });
});

test('at a span’s oldest moment, the thumb covers no label', async ({ page }) => {
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  await test.step('Given the 540 Myr span at its oldest moment, where the thumb rests on its end', async () => {
    await page.goto('./?ma=540&scale=all');
    await globeRendered(page);
  });
  await test.step('Then the oldest end’s name steps aside, and the newest stays', async () => {
    await expect(bar.getByTestId('scale-start')).toHaveCSS('opacity', '0');
    await expect(bar.getByTestId('scale-end')).toHaveCSS('opacity', '1');
  });
  await test.step('When the moment moves to the middle, the name comes back', async () => {
    await page.goto('./?ma=250&scale=all');
    await globeRendered(page);
    await expect(bar.getByTestId('scale-start')).toHaveCSS('opacity', '1');
  });
});

test('the year turns on a wheel kept to the era, and can still be typed @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const year = page.getByLabel('Year', { exact: true });
  const wheel = page.getByRole('group', { name: 'Turn to a year' });
  await test.step('Given a reader in 587 CE', async () => {
    await page.goto('./?t=0587-06-01T12:00');
    await globeRendered(page);
    await expect(year).toHaveValue('587');
  });
  await test.step('When they open the wheel beside the year', async () => {
    await page.getByRole('button', { name: 'Turn to a year' }).click();
    await expect(wheel).toBeVisible();
    // The wheel stays on screen, above the bar, on a phone too.
    const box = await wheel.boundingBox();
    const viewport = page.viewportSize();
    expect(box !== null && viewport !== null && box.x >= 0).toBe(true);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
  });
  await test.step('Then its columns read 5 | 87, and turn a year or a hundred at a time', async () => {
    const hundreds = wheel.getByRole('spinbutton', { name: 'Hundreds of years' });
    const years = wheel.getByRole('spinbutton', { name: 'Years', exact: true });
    await expect(hundreds).toHaveAttribute('aria-valuenow', '5');
    await expect(years).toHaveAttribute('aria-valuenow', '87');
    await years.press('ArrowDown');
    await expect(year).toHaveValue('588');
    await hundreds.press('ArrowDown');
    await expect(year).toHaveValue('688');
  });
  await test.step('And in BCE it goes no further back than 9700', async () => {
    await page.getByRole('combobox', { name: 'Era', exact: true }).selectOption('BCE');
    await expect(year).toHaveValue('688');
    const hundreds = wheel.getByRole('spinbutton', { name: 'Hundreds of years' });
    await expect(hundreds).toHaveAttribute('aria-valuemax', '97');
    await hundreds.evaluate((column) => {
      column.scrollTop = column.scrollHeight;
    });
    await expect(year).toHaveValue('9700');
  });
  await test.step('And Escape closes it; typing a year still works', async () => {
    await page.keyboard.press('Escape');
    await expect(wheel).toBeHidden();
    await year.fill('753');
    await year.press('Enter');
    await expect(year).toHaveValue('753');
    await expect(page.getByRole('combobox', { name: 'Era', exact: true })).toHaveValue('BCE');
  });
  expect(problems).toEqual([]);
});
