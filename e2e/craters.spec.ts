/**
 * Feature: impacts through time (#304). Each crater's path from where it struck to where it lies
 * today, as its plate carried it, in a 3D box of longitude, latitude and time; a plane at the
 * slider's moment; and a way from a crater back to the globe at its strike.
 */

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

const CRATERS = /^[1-9]\d{2,}$/;
// Drawing the paths beside the globe takes seconds on runners that render in software.
const DRAWN = { timeout: 20_000 };

test('Layers opens every crater’s path through time, in 3D', async ({ page }) => {
  // The deep-time globe, then the paths, drawn in software on CI's runners.
  test.slow();
  const problems = collectProblems(page);
  const sheet = page.getByRole('dialog', { name: /Impacts through time/ });
  await test.step('Given the end of the Cretaceous with Impacts on', async () => {
    await page.goto('./?ma=66&layers=impacts');
    await globeRendered(page);
  });
  await test.step('When they ask Layers for the impacts’ paths', async () => {
    await openLayers(page);
    await page.getByRole('button', { name: 'Their paths through time, in 3D' }).click();
  });
  await test.step('Then every dated crater’s path is drawn, with the dating in the legend', async () => {
    await expect(page).toHaveURL(/craters=all/);
    await expect(page.getByTestId('craters-canvas')).toHaveAttribute(
      'data-craters',
      CRATERS,
      DRAWN,
    );
    await expect(sheet).toContainText('Dated to within 10 million years');
    await expect(sheet).toContainText('540 million years back');
  });
  await test.step('When they close it', async () => {
    await sheet.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('Then the globe is back, and the link no longer names the paths', async () => {
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/craters=/);
  });
  expect(problems).toEqual([]);
});

test('a crater’s path says how far its plate carried it, and leads to the globe at its strike', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const focus = page.getByTestId('craters-focus');
  await test.step('Given a link to Chicxulub’s path', async () => {
    await page.goto('./?ma=66&craters=26');
    await globeRendered(page);
  });
  await test.step('Then it is picked out, with its age, width and how far it travelled', async () => {
    await expect(focus.getByRole('heading')).toHaveText('Chicxulub', DRAWN);
    await expect(focus).toContainText('180 km across');
    await expect(focus).toContainText(/Carried about [\d,]+ km by its plate since it struck/);
  });
  await test.step('When they go to see it on the globe', async () => {
    await focus.getByRole('button', { name: /See it on the globe, 66 million years ago/ }).click();
  });
  await test.step('Then deep time opens at its strike, Impacts on, the paths closed', async () => {
    await expect(page).toHaveURL(/ma=66\.038/);
    await expect(page).toHaveURL(/layers=[a-z,]*impacts/);
    await expect(page).not.toHaveURL(/craters=/);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-impacts', /^[1-9]\d*$/);
  });
  expect(problems).toEqual([]);
});

test('the paths’ book credits the reconstruction and the coasts', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given the paths open', async () => {
    await page.goto('./?craters=all');
    await globeRendered(page);
  });
  await test.step('When they open its book', async () => {
    await page
      .getByRole('dialog', { name: /Impacts through time/ })
      .getByRole('button', { name: 'Why: Impact craters' })
      .click();
  });
  await test.step('Then it says how the paths are drawn, and names its sources', async () => {
    await expect(page).toHaveURL(/why=impacts/);
    const why = page.locator('.why-dialog');
    await expect(why).toContainText('Impacts through time');
    await expect(why).toContainText('Natural Earth');
    await expect(why).toContainText('Impact Earth');
  });
  expect(problems).toEqual([]);
});
