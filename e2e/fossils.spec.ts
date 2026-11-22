/**
 * Feature: Fossils in deep time. Finds of four groups from the Paleobiology Database, counted
 * by 5 million years, where they lay at the time: on the continents of their own age.
 */

import {
  collectProblems,
  expect,
  globeRendered,
  pickSpan,
  showDeepDetails,
  turnOnLayer,
  test,
} from './support';

test('the Fossils layer marks finds of the moment on the land of their time', async ({ page }) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const note = page.getByTestId('fossils-note');
  await test.step('Given deep time 68 million years ago, in the late Cretaceous', async () => {
    await page.goto('./?ma=68');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('When they turn on Fossils', async () => {
    await turnOnLayer(page, 'Fossils');
  });
  await test.step('Then dinosaurs and others are marked, counted, with the source', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*fossils/);
    await expect(globe).toHaveAttribute('data-fossils', /^[1-9]\d*$/);
    await expect(page.locator('.fossil-cell.is-dinosaurs').first()).toBeAttached();
    await expect(note).toContainText('Fossils, 70–65 million years ago, where they lay then:');
    await expect(note).toContainText('Non-avian dinosaurs');
    await expect(note.getByRole('link', { name: 'the Paleobiology Database' })).toBeVisible();
  });
  await test.step('When they go to the Cambrian, trilobites take their place', async () => {
    await page.goto('./?ma=510&layers=fossils');
    await globeRendered(page);
    await expect(page.locator('.fossil-cell.is-trilobites').first()).toBeAttached();
    await expect(page.locator('.fossil-cell.is-dinosaurs')).toHaveCount(0);
  });
  expect(problems).toEqual([]);
});

// A one-pixel image, for Wikimedia's pictures: the suite does not reach out to Wikimedia.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

test('a cell of fossils opens its card: its genera, linked to the PBDB @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
  await test.step('Given the late Cretaceous with Fossils on', async () => {
    await page.goto('./?ma=68&layers=fossils');
    await globeRendered(page);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-fossils', /^[1-9]\d*$/);
  });
  await test.step('When they tap the cell with the most finds', async () => {
    await page.locator('.fossil-cell:visible').first().click();
  });
  await test.step('Then its card names the genera found most, each linked to the PBDB', async () => {
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading')).toContainText('70–65 million years ago');
    await expect(card).toContainText('Found most');
    await expect(card.getByRole('link', { name: / in the PBDB$/ }).first()).toHaveAttribute(
      'href',
      /^https:\/\/paleobiodb\.org\/classic\/checkTaxonInfo\?taxon_name=/,
    );
    await expect(card).toContainText('not how many animals lived');
  });
  expect(problems).toEqual([]);
});

test('into deep time from the years: the maps’ land in view, no pin from today, and a way to the nearest fossils (#948) @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  await test.step('Given Athens picked, the camera close over it', async () => {
    await page.goto('./?loc=37.97,23.73&cam=37.97,23.73,3&layers=fossils');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-location', /\d/);
  });
  await test.step('When they go to 540 Myr', async () => {
    await pickSpan(page, '540 Myr');
    await expect(page).toHaveURL(/ma=540/);
  });
  await test.step('Then the globe turns to the maps’ land and draws back, and today’s pin rests', async () => {
    await expect
      .poll(
        async () => {
          const [lat = NaN, lon = NaN] = ((await globe.getAttribute('data-target')) ?? '')
            .split(',')
            .map(Number);
          const distance = Number(await globe.getAttribute('data-distance'));
          return Math.abs(lat + 20) < 3 && Math.abs(lon) < 3 && distance >= 4.4;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await expect(globe).not.toHaveAttribute('data-location', /\d/);
  });
  await test.step('When no fossils are found then, Then the note offers the nearest finds, and goes there', async () => {
    await showDeepDetails(page);
    const go = page.getByRole('button', { name: /^Go to the nearest finds, / });
    await expect(go).toBeVisible();
    await go.click();
    await expect.poll(() => Number(new URL(page.url()).searchParams.get('ma'))).toBeLessThan(540);
    await expect(go).toBeHidden();
  });
  expect(problems).toEqual([]);
});
