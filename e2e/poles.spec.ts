/**
 * Feature: Poles and the magnetic field in deep time. The globe's poles are the spin axis,
 * fixed by the reconstruction, with the continents moving beneath them; magnetic north is marked
 * at the pole a compass pointed to, and a strip under the chapters draws every reversal the
 * record holds (GTS 2020), the superchrons, and where the field reversed too often to draw.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, showDeepDetails, test } from './support';

const strip = (page: Page) => page.getByTestId('polarity-strip');

async function factsSay(page: Page, text: string | RegExp): Promise<void> {
  await showDeepDetails(page);
  const facts = page.getByTestId('deep-facts');
  if ((await facts.getAttribute('open')) === null) {
    await facts.getByText('Poles, magnetic field, tilt, day and Sun').click();
  }
  await expect(facts.locator('dd').nth(1)).toContainText(text);
}

test('the end-Cretaceous impact came in a reversed chron: magnetic north at the south pole', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  await test.step('Given 66 million years ago', async () => {
    await page.goto('./?ma=66&scale=all');
    await globeRendered(page);
  });
  await test.step('Then magnetic north is marked at the south pole', async () => {
    await expect(globe).toHaveAttribute('data-magnetic-north', 'south');
  });
  await test.step('And the facts name the chron and its source', async () => {
    await factsSay(page, 'Reversed polarity (chron C29r, GTS 2020): a compass would point south.');
  });
  await test.step('And the strip draws the reversals, the superchron and the field before', async () => {
    await expect(strip(page).locator('.polarity-span.is-reversed')).not.toHaveCount(0);
    await expect(strip(page).locator('.polarity-span.is-normal')).not.toHaveCount(0);
    await expect(strip(page).locator('.polarity-span.is-mixed')).not.toHaveCount(0);
    await expect(strip(page)).toHaveAttribute('aria-label', /^Magnetic polarity over the span/);
  });
  expect(problems).toEqual([]);
});

test('through the Cretaceous Normal Superchron the field held as today', async ({ page }) => {
  const globe = page.getByTestId('globe');
  await test.step('Given 100 million years ago', async () => {
    await page.goto('./?ma=100&scale=all');
    await globeRendered(page);
  });
  await test.step('Then magnetic north is at the north pole, in the superchron', async () => {
    await expect(globe).toHaveAttribute('data-magnetic-north', 'north');
    await factsSay(page, 'Cretaceous Normal Superchron');
  });
});

test('in the Kiaman superchron the field was reversed for 50 million years', async ({ page }) => {
  const globe = page.getByTestId('globe');
  await test.step('Given 290 million years ago', async () => {
    await page.goto('./?ma=290&scale=all');
    await globeRendered(page);
  });
  await test.step('Then magnetic north is at the south pole', async () => {
    await expect(globe).toHaveAttribute('data-magnetic-north', 'south');
    await factsSay(page, 'Kiaman Reverse Superchron');
  });
});

test('where the field reversed too often to say, the marker says either pole', async ({ page }) => {
  const globe = page.getByTestId('globe');
  await test.step('Given 150 million years ago, between the superchrons', async () => {
    await page.goto('./?ma=150&scale=all');
    await globeRendered(page);
  });
  await test.step('Then magnetic north is marked as either pole', async () => {
    await expect(globe).toHaveAttribute('data-magnetic-north', 'either');
    await factsSay(page, 'Reversing often');
  });
});

test('in the ice ages: normal since 773,000 years ago, reversed just before', async ({ page }) => {
  const globe = page.getByTestId('globe');
  await test.step('Given 500,000 years ago', async () => {
    await page.goto('./?ma=0.5&scale=ice');
    await globeRendered(page);
  });
  await test.step('Then magnetic north is at the north pole, as today', async () => {
    await expect(globe).toHaveAttribute('data-magnetic-north', 'north');
  });
  await test.step('When they go to 800,000 years ago', async () => {
    await page.goto('./?ma=0.8&scale=ice');
    await globeRendered(page);
  });
  await test.step('Then it is at the south pole: before the Brunhes–Matuyama reversal', async () => {
    await expect(globe).toHaveAttribute('data-magnetic-north', 'south');
  });
});

test('before the record, no magnetic north is marked', async ({ page }) => {
  await page.goto('./?ma=1000&scale=eons');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-magnetic-north', 'unknown');
  await expect(strip(page).locator('.polarity-span.is-unknown')).not.toHaveCount(0);
});
