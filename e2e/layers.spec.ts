/**
 * Feature: Layers. The reader chooses what the globe overlays, from one panel, and combines
 * them as they travel through time.
 */

import { collectProblems, globeRendered, openLayers, openSources, expect, test } from './support';

test('the reader finds every layer in one panel, grouped by what it shows', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given the globe in 586 BCE', async () => {
    await page.goto('./?t=-585-07-29T12:00&cam=33,40,3');
    await globeRendered(page);
  });
  await test.step('When they open Layers', async () => {
    await openLayers(page);
  });
  await test.step('Then each group lists its layers, with what is on by default', async () => {
    const panel = page.getByRole('dialog', { name: 'Layers' });
    const people = panel.getByRole('group', { name: 'People' });
    await expect(people.getByRole('checkbox', { name: 'States and empires' })).not.toBeChecked();
    const sky = panel.getByRole('group', { name: 'Sky and events' });
    await expect(sky.getByRole('checkbox', { name: 'Eclipse shadows' })).toBeChecked();
    await expect(sky.getByRole('checkbox', { name: 'Moon in Earth’s shadow' })).toBeChecked();
  });
  await test.step('And closing the panel leaves the globe as it was', async () => {
    await page
      .getByRole('dialog', { name: 'Layers' })
      .getByRole('button', { name: 'Close' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Layers' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Layers' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
  expect(problems).toEqual([]);
});

test('turning on states and empires draws the year’s states, and the link keeps it', async ({
  page,
}) => {
  const globe = page.getByTestId('globe');
  const states = page.getByRole('checkbox', { name: 'States and empires' });
  await test.step('Given the globe in 586 BCE with no states drawn', async () => {
    await page.goto('./?t=-585-07-29T12:00&cam=33,40,3');
    await globeRendered(page);
    await expect(globe).not.toHaveAttribute('data-empires', /\d/);
  });
  await test.step('When they turn on States and empires', async () => {
    await openLayers(page);
    await states.check();
  });
  await test.step('Then the states of that year are drawn and credited', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*empires/);
    await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
    await expect(
      page.locator('.empire-label', { hasText: /^Neo-Babylonian Empire$/ }),
    ).toBeVisible();
    await expect(page.getByLabel('Borders from')).toHaveValue('cliopatria');
    await openSources(page);
    await expect(page.getByRole('link', { name: 'Cliopatria' })).toBeVisible();
  });
  await test.step('And the link brings them back', async () => {
    await page.reload();
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
    await openLayers(page);
    await expect(states).toBeChecked();
  });
  await test.step('And turning the layer off clears the map and its credit', async () => {
    await states.uncheck();
    await expect(globe).toHaveAttribute('data-empires', 'off');
    await expect(page.getByLabel('Borders from')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Cliopatria' })).toBeHidden();
  });
});

test('a layer says when its data begins, and draws once the time reaches it', async ({ page }) => {
  const globe = page.getByTestId('globe');
  const year = page.getByLabel('Year', { exact: true });
  await test.step('Given 3500 BCE with States and empires on', async () => {
    await page.goto('./?t=-3499-06-01T12:00&cam=30,35,3&layers=lunar,solar,empires');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then the layer says when its borders begin, and draws none', async () => {
    await expect(page.getByTestId('layer-note-empires')).toHaveText(
      'Nothing to draw yet: Cliopatria begins in 3400 BCE.',
    );
    await expect(globe).toHaveAttribute('data-empires', '0');
  });
  await test.step('When the year moves to 3000 BCE', async () => {
    await year.fill('3000');
    await year.press('Enter');
  });
  await test.step('Then the states of that year are drawn', async () => {
    await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
    await expect(page.getByTestId('layer-note-empires')).toBeHidden();
  });
});

test('eclipse shadows can be switched off, and the link keeps that', async ({ page }) => {
  const globe = page.getByTestId('globe');
  await test.step('Given the 2024 total solar eclipse, its shadow on the globe', async () => {
    await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-solar-shadow', 'on');
  });
  await test.step('When they turn off Eclipse shadows', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Eclipse shadows' }).uncheck();
  });
  await test.step('Then the shadow is gone, and the link says so', async () => {
    await expect(globe).toHaveAttribute('data-solar-shadow', 'off');
    await expect(page).not.toHaveURL(/layers=[^&]*solar/);
  });
});

test('the Layers panel leaves the globe usable while it is open', async ({ page }, info) => {
  await test.step('Given the Layers panel open', async () => {
    await page.goto('./?t=1500-06-01T12:00&cam=5,20,2.6');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then the date can still be changed behind it', async () => {
    const year = page.getByLabel('Year', { exact: true });
    // On a phone the panel is a sheet over the bottom bar: the year is reached after closing.
    if (info.project.name === 'mobile') await page.keyboard.press('Escape');
    await year.fill('1600');
    await year.press('Enter');
    await expect(page).toHaveURL(/t=1600-/);
  });
  await test.step('And Escape closes the panel', async () => {
    await openLayers(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Layers' })).toBeHidden();
  });
});

test('today shows the states as Cliopatria last drew them, and says so', async ({ page }) => {
  const globe = page.getByTestId('globe');
  await test.step('Given the globe in 2026 with states and empires on', async () => {
    await page.goto('./?t=2026-06-01T12:00&layers=lunar,solar,empires');
    await globeRendered(page);
  });
  await test.step('Then the states of 2024 are drawn', async () => {
    await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  });
  await test.step('And the Layers panel says the borders are as of 2024', async () => {
    await openLayers(page);
    await expect(page.getByTestId('layer-note-empires')).toHaveText(
      'Borders as of 2024 CE, Cliopatria’s latest year.',
    );
  });
  await test.step('And the states can be picked to see their eclipses', async () => {
    await expect(
      page.getByTestId('seen-select').locator('option', { hasText: /^French Fifth Republic$/ }),
    ).toHaveCount(1);
  });
});
