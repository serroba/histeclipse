/**
 * Feature: Full view. The reader clears the panels to look at the globe. In deep time a tap on
 * the globe clears them (there is no place to pick), and a strip keeps saying when it is.
 */

import { collectProblems, expect, globeRendered, test } from './support';

test('in deep time a tap on the globe clears the panels, and the strip says when', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const glance = page.getByTestId('deep-glance');
  await test.step('Given deep time 250 million years ago', async () => {
    await page.goto('./?ma=250');
    await globeRendered(page);
    await expect(glance).toBeHidden();
  });
  await test.step('When they tap the globe', async () => {
    await globe.click();
  });
  await test.step('Then the panels go, and a strip shows the time and how far through', async () => {
    await expect(page.locator('.hud')).toBeHidden();
    await expect(glance).toBeVisible();
    await expect(glance).toContainText('250 million years ago');
    await expect(glance).toContainText('Triassic');
    const slider = glance.getByRole('slider', { name: 'Time shown' });
    await expect(slider).toHaveAttribute('aria-valuetext', '250 million years ago');
  });
  await test.step('When they drag the strip to halfway', async () => {
    await glance.getByRole('slider', { name: 'Time shown' }).fill('500');
  });
  await test.step('Then the globe shows that moment, and the panels stay away', async () => {
    await expect(page).toHaveURL(/&ma=270(&|$)/);
    await expect(glance).toContainText('270 million years ago');
    await expect(page.locator('.hud')).toBeHidden();
  });
  await test.step('When they play from the strip', async () => {
    await glance.getByRole('button', { name: 'Play' }).click();
  });
  await test.step('Then the strip follows time towards the present', async () => {
    await expect(glance).not.toContainText('270 million years ago');
    await glance.getByRole('button', { name: 'Pause' }).click();
  });
  await test.step('When they tap the globe again, the panels come back', async () => {
    await globe.click();
    await expect(page.locator('.hud')).toBeVisible();
    await expect(glance).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('in the Holocene a tap on the globe still picks a place, leaving the panels', async ({
  page,
}) => {
  await test.step('Given the globe in 2024, looking at the Earth', async () => {
    await page.goto('./?t=2024-04-08T18:17&loc=0,0');
    await globeRendered(page);
  });
  await test.step('When they tap the globe', async () => {
    await page.getByTestId('globe').click();
  });
  await test.step('Then they stand where they tapped, and the panels stay', async () => {
    await expect(page).not.toHaveURL(/loc=0,0(&|$)/);
    await expect(page.locator('.hud')).toBeVisible();
    await expect(page.getByTestId('deep-glance')).toBeHidden();
  });
});
