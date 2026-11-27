/** Search: the site's texts found by their words, each opening the view of its place (#392). */

import { collectProblems, expect, globeRendered, test } from './support';

test('a reader searches for a record by its place and opens it @acceptance', async ({ page }) => {
  const problems = collectProblems(page);
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe today', async () => {
    await page.goto('./?cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they open search and type a city’s name', async () => {
    await page.getByRole('button', { name: 'Search the texts' }).click();
    await dialog.getByRole('searchbox').fill('Ugarit');
  });
  await test.step('Then its eclipse record comes first, with where and when it is', async () => {
    const first = dialog.locator('.search-hit').first();
    await expect(first).toContainText('The Ugarit eclipse');
    await expect(first).toContainText('35.6°N 35.8°E · 1223 BCE');
  });
  await test.step('When they open it', async () => {
    await dialog.locator('.search-hit').first().click();
  });
  await test.step('Then the eclipse is picked, seen from Ugarit', async () => {
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/sel=solar:-1222-03-05/);
    await expect(page).toHaveURL(/loc=35\.6017,35\.7822/);
  });
  expect(problems).toEqual([]);
});

test('a reader searches with the keyboard for a landing and flies to the Moon @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe today', async () => {
    await page.goto('./?cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they press / and type a mission, still typing', async () => {
    await page.keyboard.press('/');
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    await page.keyboard.type('Apollo 11 Eag');
  });
  await test.step('Then the mission is found first, with where Eagle came down (#716)', async () => {
    const apollo = dialog.locator('[data-passage="mission:d00273"]');
    await expect(dialog.locator('li').first()).toHaveAttribute('data-passage', 'mission:d00273');
    await expect(
      apollo.getByRole('button', { name: /^Where Eagle came down · The Moon/ }),
    ).toBeVisible();
  });
  await test.step('When they open where Eagle came down', async () => {
    await dialog
      .locator('[data-passage="mission:d00273"]')
      .getByRole('button', { name: /^Where Eagle came down/ })
      .click();
  });
  await test.step('Then the view is on the Moon the day it landed, inside the mission, Eagle marked', async () => {
    await expect(page).toHaveURL(/focus=moon/);
    await expect(page).toHaveURL(/t=1969-07-20T20:17Z/);
    await expect(page).toHaveURL(/layers=[^&]*spacecraft/);
    await expect(page).toHaveURL(/mission=d00273/);
    await expect(page.getByRole('group', { name: 'Apollo 11: its journey' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByTestId('landing-sites').getByRole('button', { name: 'Apollo 11: Eagle' }),
    ).toBeVisible({
      timeout: 30_000,
    });
  });
  await test.step('And a step back returns to where they were', async () => {
    await page.goBack();
    await expect(page).not.toHaveURL(/focus=moon/);
  });
  expect(problems).toEqual([]);
});

test('a reader searches for a mission and follows its journey (#712)', async ({ page }) => {
  const problems = collectProblems(page);
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe today', async () => {
    await page.goto('./?cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they search for Voyager 2', async () => {
    await page.getByRole('button', { name: 'Search the texts' }).click();
    await dialog.getByRole('searchbox').fill('Voyager 2');
  });
  await test.step('Then its mission is found, and opening it follows its journey from the start', async () => {
    await dialog.locator('[data-passage="mission:d00574"] .search-hit').click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/mission=d00574/);
    await expect(page).toHaveURL(/focus=sun/);
    await expect(page).toHaveURL(/t=1977-08-20T19:37Z/);
    const journey = page.getByRole('group', { name: 'Voyager 2: its journey' });
    await expect(journey).toBeVisible({ timeout: 30_000 });
    await expect(journey.getByRole('listitem')).toHaveCount(5);
  });
  expect(problems).toEqual([]);
});

test('a reader searches for Hubble and follows it as a mission about Earth, through its servicing flights (#800)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe today', async () => {
    await page.goto('./?cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they search for Hubble', async () => {
    await page.getByRole('button', { name: 'Search the texts' }).click();
    await dialog.getByRole('searchbox').fill('Hubble servicing');
  });
  await test.step('Then its mission is found, and opening it frames Earth close, from its launch', async () => {
    await dialog.locator('[data-passage="mission:s20580"] .search-hit').click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/mission=s20580/);
    // On Earth, close: the link need not name Earth, its default.
    await expect(page).not.toHaveURL(/focus=/);
    await expect(page).toHaveURL(/cam=60\.0000,0\.0000,6\.00/);
    await expect(page).toHaveURL(/t=1990-04-24T00:00Z/);
    const journey = page.getByRole('group', { name: 'Hubble Space Telescope: its journey' });
    await expect(journey).toBeVisible({ timeout: 30_000 });
    await expect(journey.getByRole('listitem')).toHaveCount(7);
    await expect(journey.getByRole('listitem').last()).toHaveText(/^Last servicing 11 May 2009/);
  });
  expect(problems).toEqual([]);
});

test('a reader opens a searched eclipse and the globe turns to its place (#942) @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe facing the other side of the world', async () => {
    await page.goto('./?cam=-34,151,3');
    await globeRendered(page);
  });
  await test.step('When they search for Thucydides’ eclipse and open it', async () => {
    await page.getByRole('button', { name: 'Search the texts' }).click();
    await dialog.getByRole('searchbox').fill('Peloponnesian War');
    await dialog.locator('.search-hit').filter({ hasText: 'first summer' }).first().click();
  });
  await test.step('Then the rendered camera faces Athens, not only the address bar', async () => {
    await expect(page).toHaveURL(/cam=37\.97/);
    await expect
      .poll(
        async () => {
          const [lat = NaN, lon = NaN] = ((await globe.getAttribute('data-target')) ?? '')
            .split(',')
            .map(Number);
          return Math.abs(lat - 38) < 1.5 && Math.abs(lon - 23.7) < 1.5;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  });
  expect(problems).toEqual([]);
});

test('a reader searches for the Great Dying and lands on the end-Permian, the extinctions on (#1210)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe today', async () => {
    await page.goto('./?cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they search for the Great Dying', async () => {
    await page.getByRole('button', { name: 'Search the texts' }).click();
    await dialog.getByRole('searchbox').fill('great dying');
  });
  await test.step('Then the end-Permian comes first, a mass extinction, with its places then', async () => {
    const first = dialog.locator('li').first();
    await expect(first).toHaveAttribute('data-passage', 'extinction:end-permian-extinction');
    await expect(first).toContainText('Mass extinction');
    await expect(first.getByRole('button').first()).toContainText(
      'Siberian Traps, Putorana, 251.9 million years ago',
    );
    await expect(first.getByRole('button').first()).toContainText('The Great Dying.');
  });
  await test.step('When they open the Siberian Traps', async () => {
    await dialog.locator('li').first().getByRole('button').first().click();
  });
  await test.step('Then deep time is at the extinction, the layer on, its places marked', async () => {
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/ma=251\.9/);
    await expect(page).toHaveURL(/layers=[^&]*extinctions/);
    await expect(page.locator('[data-pick="extinction:meishan"]')).toBeAttached();
  });
  await test.step('And its card is open, its own time a tap away (#1233)', async () => {
    const card = page.getByTestId('marker-card');
    await expect(card).toContainText('End-Permian mass extinction');
    await expect(card).toContainText('Siberian Traps, Putorana');
    await expect(card.getByRole('button', { name: 'Watch it in its own time' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});
