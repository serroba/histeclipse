/**
 * Feature: an animal's story. Find an animal by the name a reader knows, and its lineage's
 * fossil finds are told on the globe through deep time: where its kinds were found as the
 * continents moved, how warm it was there, and whether land joined the continents it reached.
 */

import { collectProblems, expect, globeRendered, test } from './support';

// A one-pixel image, for PhyloPic's and Wikimedia's pictures: the suite reaches out to neither.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

test('finding the lion tells the cats’ story on the globe, and a dot opens its site’s card @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const panel = page.getByTestId('life-panel');
  const card = page.getByTestId('life-card');
  await page.route(/^https:\/\/(images\.phylopic\.org|(upload|thumb)\.wikimedia\.org)\//, (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
  await test.step('Given the site, and the animals’ finder open', async () => {
    await page.goto('./');
    await globeRendered(page);
    // The header offers the finder where it has room; on a phone, Explore does, under Life.
    const finder = page.getByRole('button', { name: 'Find an animal and follow its story' });
    if (await finder.isVisible()) {
      await finder.click();
    } else {
      await page.getByRole('button', { name: 'Explore' }).click();
      await page.getByRole('tab', { name: 'Life' }).click();
      await page.getByRole('button', { name: /An animal’s story/ }).click();
    }
  });
  await test.step('When they type "lion" and pick it', async () => {
    await page.getByRole('searchbox', { name: 'Find an animal' }).fill('lion');
    const lion = page.locator('.life-found .famous-item').first();
    await expect(lion).toContainText('Panthera, a kind (genus)');
    await lion.click();
  });
  await test.step('Then deep time opens at the oldest cats, the globe coloured by warmth', async () => {
    await expect(page).toHaveURL(/life=mammals:41045:41066/);
    await expect(page).toHaveURL(/layers=[a-z,]*temperature/);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Lion' })).toBeVisible();
    await expect(globe).toHaveAttribute('data-life-marks', /^[1-9]\d*$/);
  });
  await test.step('When they go to 10 million years ago, where the story names Panthera', async () => {
    await page.goto('./?ma=10&life=mammals:41045:41066&cam=30,80,3.4');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-life-marks', /^[1-9]\d*$/);
    // On a phone the panel starts folded to its heading, clear of the globe.
    const show = panel.getByRole('button', { name: 'Show the story' });
    if (await show.isVisible()) await show.click();
  });
  await test.step('Then the panel charts the continents and their doors, and says the moments', async () => {
    await expect(panel.locator('.life-row-name').first()).toBeVisible();
    await expect(panel.locator('.life-row.is-door').first()).toBeAttached();
    await expect(panel.locator('.life-chapter-title').first()).toHaveText('The oldest finds');
    await expect(panel.locator('.life-chapters')).toContainText('First found in South America');
    await expect(panel.locator('.life-chapters')).toContainText('Land joined it to North America');
    await expect(page.locator('.life-callout:visible').first()).toBeVisible();
  });
  await test.step('When they tap a picture of a kind beside the globe', async () => {
    const fold = panel.getByRole('button', { name: 'Fold the story' });
    await fold.click();
    await page.locator('.life-callout:visible').first().click();
  });
  await test.step('Then its site’s card says the finds, the place then and today, and the ways on', async () => {
    await expect(card).toBeVisible();
    await expect(card).toContainText('This site');
    await expect(card).toContainText('million years ago');
    await expect(card).toContainText('today');
    await expect(card.getByRole('button', { name: 'Tell its story' })).toBeVisible();
    await expect(card.getByRole('link', { name: /in the Paleobiology Database/ })).toBeVisible();
    await card.getByRole('button', { name: 'Close' }).click();
    await expect(card).toBeHidden();
  });
  expect(problems).toEqual([]);
});
