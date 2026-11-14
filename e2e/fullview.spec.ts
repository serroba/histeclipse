/**
 * Feature: Full view. The reader clears the panels to look at the globe. In deep time a tap on
 * the globe, or on the space around it, clears them (there is no place to pick), and a strip
 * keeps saying when it is.
 */

import { collectProblems, expect, globeRendered, test } from './support';

test('in deep time a tap on the globe clears the panels, and the strip says when @mobile', async ({
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

test('in full view with Temperature on, the strip has a small scale of its colours', async ({
  page,
}) => {
  const glance = page.getByTestId('deep-glance');
  const scale = page.getByTestId('glance-temperature');
  await test.step('Given deep time 375 million years ago, coloured by temperature', async () => {
    await page.goto('./?ma=375&layers=temperature');
    await globeRendered(page);
  });
  await test.step('When they clear the panels', async () => {
    await page.getByRole('button', { name: 'Full view' }).click();
    await expect(glance).toBeVisible();
  });
  await test.step('Then the strip shows the temperature scale, from −40 °C to 45 °C', async () => {
    await expect(scale).toBeVisible();
    await expect(scale).toContainText('−40 °C');
    await expect(scale).toContainText('15 °C');
    await expect(scale).toContainText('45 °C');
  });
  await test.step('And without Temperature, no scale', async () => {
    await page.goto('./?ma=375');
    await globeRendered(page);
    await page.getByRole('button', { name: 'Full view' }).click();
    await expect(glance).toBeVisible();
    await expect(scale).toBeHidden();
  });
});

test('in deep time a tap on the space around the globe clears the panels too', async ({ page }) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  // Beside the globe, at the right edge of the view: empty space.
  const space = async () => {
    const box = await globe.boundingBox();
    if (box === null) throw new Error('no globe');
    await page.mouse.click(box.x + box.width - 4, box.y + box.height * 0.45);
  };
  await test.step('Given deep time 180 million years ago', async () => {
    await page.goto('./?ma=180');
    await globeRendered(page);
  });
  await test.step('When they tap the space beside the globe', async () => {
    await space();
  });
  await test.step('Then the panels go, as with a tap on the globe', async () => {
    await expect(page.locator('.hud')).toBeHidden();
    await expect(page.getByTestId('deep-glance')).toBeVisible();
  });
  await test.step('When they tap it again, the panels come back', async () => {
    await space();
    await expect(page.locator('.hud')).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('in the Holocene a tap on empty space still only brings the panels back', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17');
  await globeRendered(page);
  const box = await page.getByTestId('globe').boundingBox();
  if (box === null) throw new Error('no globe');
  await page.mouse.click(box.x + box.width - 4, box.y + box.height * 0.45);
  await expect(page.locator('.hud')).toBeVisible();
});
