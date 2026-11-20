/**
 * The reference journeys of #724, as a visitor takes them with no knowledge of the spans:
 * found by topic in Explore, arrived at, moved through in time, onward to a related discovery,
 * and back (docs/navigation.md §7). Human origins is in `journeys.spec.ts`.
 */

import { collectProblems, expect, globeRendered, test } from './support';

/** A transparent pixel, for the pictures cards fetch from Wikimedia. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('a visitor finds the Moon landings by topic and comes down with Eagle, then Back @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await test.step('Given today on the globe', async () => {
    await page.goto('./?t=2026-01-01T12:00Z&cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they open Explore and pick Moon landings under Space', async () => {
    await page.getByRole('button', { name: 'Explore' }).click();
    const panel = page.getByRole('dialog', { name: 'Explore' });
    await expect(panel.getByRole('tab', { name: 'Space' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await panel.getByRole('button', { name: 'Moon landings', exact: true }).click();
  });
  await test.step('Then the Moon is shown the day Eagle came down, its site marked', async () => {
    await expect(page.locator('.hud-date')).toHaveText('20 July 1969 CE');
    await expect(
      page.getByTestId('landing-sites').getByRole('button', { name: 'Apollo 11: Eagle' }),
    ).toBeAttached();
    await expect(page.locator('.explore-context')).toContainText('Moon landings');
  });
  await test.step('When they go Back, Then today is back', async () => {
    await page.goBack();
    await expect(page.locator('.hud-date')).toHaveText('1 January 2026 CE');
  });
  expect(problems).toEqual([]);
});

test('a visitor explores ancient Australia: an age, its fossils, the climate then, and back to its time @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
  await test.step('Given today on the globe', async () => {
    await page.goto('./?t=2026-01-01T12:00Z&cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they pick Ancient Australia under Earth', async () => {
    await page.getByRole('button', { name: 'Explore' }).click();
    const panel = page.getByRole('dialog', { name: 'Explore' });
    await panel.getByRole('tab', { name: 'Earth' }).click();
    await panel.getByRole('button', { name: 'Ancient Australia', exact: true }).click();
    // On a wide screen Explore stays open after a pick; on a phone it has closed for the globe.
    if (await panel.isVisible()) await panel.press('Escape');
  });
  await test.step('Then 100 million years ago is shown, with the fossils found from then', async () => {
    await expect(page.locator('.hud-date')).toHaveText('100 million years ago');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-fossils', /^[1-9]\d*$/);
  });
  await test.step('When they open a cell of fossils and follow The climate then', async () => {
    // One clear of the bar at the bottom, which covers the globe's lower half on a laptop.
    const barTop = (await page.locator('.bottom').boundingBox())?.y ?? 0;
    const cells = page.locator('.fossil-cell:visible');
    for (let index = 0; index < (await cells.count()); index += 1) {
      const box = await cells.nth(index).boundingBox();
      if (box !== null && box.y > 0 && box.y + box.height < barTop) {
        // The globe may still be gliding there: the cell moves, so it is tapped where it is.
        await cells.nth(index).dispatchEvent('click');
        break;
      }
    }
    const related = page.getByTestId('marker-card').getByRole('region', { name: 'Related' });
    await related.getByRole('button', { name: 'The climate then' }).click();
  });
  await test.step('Then the same moment is coloured by temperature', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*temperature/);
    await expect(page.locator('.hud-date')).toHaveText('100 million years ago');
  });
  await test.step('When they go to 250 Ma and fit the topic, Then its age is back', async () => {
    await page.locator('.hud-date-button').click();
    await page.getByRole('textbox', { name: 'A year or an age' }).fill('250 Ma');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('.hud-date')).toHaveText('250 million years ago');
    await page.getByRole('button', { name: /^Fit this topic/ }).click();
    await expect(page.locator('.hud-date')).toHaveText('100 million years ago');
  });
  expect(problems).toEqual([]);
});

test('a visitor finds the warming records through All subjects, without knowing a layer’s name (#750) @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await test.step('Given today on the globe', async () => {
    await page.goto('./?t=2016-10-01T12:00Z&cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they open Explore, choose Climate and Warming since 1850 under All subjects', async () => {
    await page.getByRole('button', { name: 'Explore' }).click();
    const panel = page.getByRole('dialog', { name: 'Explore' });
    await panel.getByRole('tab', { name: 'Climate' }).click();
    await expect(panel.getByRole('heading', { name: 'All subjects' })).toBeVisible();
    await panel.getByRole('button', { name: 'Warming since 1850', exact: true }).click();
  });
  await test.step('Then the records are on, side by side, at the year shown', async () => {
    await expect(page).toHaveURL(/layers=[a-zA-Z,]*warming/);
    await expect(
      page.getByRole('region', { name: 'Temperature records side by side' }),
    ).toContainText('2016:');
  });
  expect(problems).toEqual([]);
});

test('a visitor finds an eclipse first: Explore starts with Thales’, and Layers with Space (#949) @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await test.step('Given today on the globe', async () => {
    await page.goto('./?t=2026-01-01T12:00Z&cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they open Explore, Then its first destination under Space is the eclipse of Thales', async () => {
    await page.getByRole('button', { name: 'Explore' }).click();
    const panel = page.getByRole('dialog', { name: 'Explore' });
    await expect(panel.locator('.explore-go:visible').first()).toHaveAttribute(
      'data-destination',
      'eclipse-of-thales',
    );
    await panel.locator('.explore-go:visible').first().click();
  });
  await test.step('Then the eclipse is picked, seen from Anatolia', async () => {
    await expect(page).toHaveURL(/sel=solar:-0584-05-28/);
    await expect(page).toHaveURL(/loc=39\.0000,35\.0000/);
    await expect(page.locator('.eclipse-card')).toContainText('The eclipse of Thales');
  });
  await test.step('And in Layers, Space comes first, with Eclipses at its head', async () => {
    await page.getByRole('button', { name: 'Layers' }).first().click();
    const layers = page.getByRole('dialog', { name: 'Layers' });
    await expect(layers.getByRole('checkbox').first()).toHaveAccessibleName(/Eclipses/);
  });
  expect(problems).toEqual([]);
});
