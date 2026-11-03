/**
 * Feature: Humans in the ice ages. Dated finds of our species and of its relatives, each with
 * its source; where the evidence is argued over, the competing dates are given side by side.
 */

import { collectProblems, expect, globeRendered, showDeepDetails, test } from './support';

test('the Humans layer marks dated finds, and gives competing dates side by side', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const note = page.getByTestId('humans-note');
  await test.step('Given the ice ages 60,000 years ago', async () => {
    await page.goto('./?ma=0.06&scale=ice&cam=-15,135,3');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('When they turn on Humans', async () => {
    await page.getByRole('button', { name: 'Humans' }).click();
  });
  await test.step('Then the finds of that time are marked, with their dates', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*humans/);
    await expect(globe).toHaveAttribute('data-humans', /^[1-9]\d*$/);
    await expect(page.locator('.human-site', { hasText: 'Madjedbebe' })).toBeVisible();
  });
  await test.step('And the note gives both dates for reaching Australia, with sources', async () => {
    await expect(note).toContainText('When did people first reach Australia?');
    await expect(note).toContainText('Clarkson et al. 2017');
    await expect(note).toContainText('O’Connell et al. 2018');
  });
  await test.step('When they go back to 100,000 years ago', async () => {
    await page.goto('./?ma=0.1&scale=ice&layers=humans');
    await globeRendered(page);
  });
  await test.step('Then Australia is not yet marked, but the finds before are', async () => {
    await expect(page.locator('.human-site', { hasText: 'Madjedbebe' })).toHaveCount(0);
    await expect(page.locator('.human-site', { hasText: 'Misliya' })).toHaveCount(1);
  });
  expect(problems).toEqual([]);
});

test('Humans goes with deep time, and stays out of the link afterwards', async ({ page }) => {
  await page.goto('./?ma=0.06&scale=ice&layers=humans');
  await globeRendered(page);
  await page.getByRole('group', { name: 'Time' }).getByRole('button', { name: 'Holocene' }).click();
  await expect(page).not.toHaveURL(/humans/);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-humans', 'off');
});

test('a dispersal model shades where it has people settled, scenario by scenario', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const words = page.getByTestId('dispersal-words');
  await test.step('Given the ice ages 60,000 years ago with Humans on', async () => {
    await page.goto('./?ma=0.06&scale=ice&layers=humans');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('When they pick the early-exit model', async () => {
    await page.getByLabel('Dispersal model').selectOption('a');
  });
  await test.step('Then it shades its settled land, and says whose, how much and on what terms', async () => {
    await expect(page).toHaveURL(/dispersal=a/);
    await expect(globe).toHaveAttribute('data-settled', 'a 60');
    await expect(words).toHaveText(
      /^Shaded: where Timmermann & Friedrich’s \(2016\) model, early exit from Africa \(scenario A\), has people settled by then: \d+% of the land it ever reaches\. One model’s view, not evidence; its data is CC BY-NC 4\.0 \(non-commercial\)\.$/,
    );
  });
  await test.step('When they pick the late-exit model, it shades that one instead', async () => {
    await page.getByLabel('Dispersal model').selectOption('b');
    await expect(globe).toHaveAttribute('data-settled', 'b 60');
  });
  await test.step('And turning the model off clears the shading', async () => {
    await page.getByLabel('Dispersal model').selectOption('off');
    await expect(globe).toHaveAttribute('data-settled', 'off');
    await expect(page).not.toHaveURL(/dispersal=/);
  });
  expect(problems).toEqual([]);
});

// A one-pixel image, for Wikimedia's pictures: the suite does not reach out to Wikimedia.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

test('a find opens its card: its claim, its source, its rivals and a picture', async ({ page }) => {
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
  await test.step('Given the finds 60,000 years ago, looking at Australia', async () => {
    await page.goto('./?ma=0.06&scale=ice&cam=-15,135,3&layers=humans');
    await globeRendered(page);
  });
  await test.step('When they tap Madjedbebe', async () => {
    await page.locator('.human-site', { hasText: 'Madjedbebe' }).click();
  });
  await test.step('Then its card gives the claim with its source, and the rival date', async () => {
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Madjedbebe' })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Clarkson et al. 2017, Nature' })).toHaveAttribute(
      'href',
      /^https:\/\/doi\.org\/10\./,
    );
    await expect(card).toContainText('One answer to “When did people first reach Australia?”');
    await expect(card).toContainText('O’Connell et al. 2018, PNAS');
    await expect(card.getByRole('link', { name: 'Wikipedia' })).toBeVisible();
  });
  await test.step('When they open a find with a picture, it shows with its credit', async () => {
    await page.getByRole('button', { name: 'Close' }).last().click();
    await page.goto('./?ma=0.3&scale=ice&cam=30,-5,3&layers=humans');
    await globeRendered(page);
    await page.locator('.human-site', { hasText: 'Jebel Irhoud' }).click();
    await expect(card.locator('.marker-card-image figcaption')).toContainText(
      'via Wikimedia Commons.',
    );
  });
  expect(problems).toEqual([]);
});
