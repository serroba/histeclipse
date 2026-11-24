/**
 * Feature: Layers. The reader chooses what the globe overlays, from one panel, and combines
 * them as they travel through time.
 */

import {
  collectProblems,
  expect,
  globeRendered,
  openLayers,
  openSources,
  pickSpan,
  test,
} from './support';

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
    const sky = panel.getByRole('group', { name: 'Space' });
    await expect(sky.getByRole('checkbox', { name: 'Eclipses', exact: true })).not.toBeChecked();
    await expect(sky.getByRole('checkbox', { name: 'Eclipse shadows' })).toHaveCount(0);
    await expect(sky.getByRole('checkbox', { name: 'Moon in Earth’s shadow' })).toHaveCount(0);
  });
  await test.step('And closing the panel leaves the globe as it was', async () => {
    await page
      .getByRole('dialog', { name: 'Layers' })
      .getByRole('button', { name: 'Close' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Layers' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Layers', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
  expect(problems).toEqual([]);
});

test('turning on states and empires draws the year’s states, and the link keeps it @acceptance', async ({
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

test('eclipses can be switched off, letting go of the eclipse, and the link keeps that', async ({
  page,
}) => {
  const globe = page.getByTestId('globe');
  const row = page.locator('.eclipse-row');
  await test.step('Given the 2024 total solar eclipse, its shadow on the globe', async () => {
    await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-solar-shadow', 'on');
    await expect(row).toBeVisible();
  });
  await test.step('When they turn off Eclipses', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Eclipses', exact: true }).uncheck();
  });
  await test.step('Then the shadow and the eclipse row are gone, and the link says so', async () => {
    await expect(globe).toHaveAttribute('data-solar-shadow', 'off');
    await expect(row).toBeHidden();
    await expect(page).not.toHaveURL(/sel=/);
    await expect(page).toHaveURL(/layers=/);
    await expect(page).not.toHaveURL(/layers=[^&]*eclipses/);
  });
});

test('the Layers panel leaves the globe usable while it is open @mobile', async ({
  page,
}, info) => {
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

test('the ground shows one fill at a time: rocks, ways of life or radiocarbon dates', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const panel = page.getByRole('dialog', { name: 'Layers' });
  await test.step('Given 2000 BCE with Rocks at the surface on', async () => {
    await page.goto('./?t=-1999-06-01T12:00&layers=lunar,solar,rocks');
    await globeRendered(page);
    await openLayers(page);
    await expect(panel.getByRole('checkbox', { name: 'Rocks at the surface' })).toBeChecked();
  });
  await test.step('When they turn on Ways of life', async () => {
    await panel.getByRole('checkbox', { name: 'Ways of life' }).check();
  });
  await test.step('Then the rocks give way: two fills on one map cannot both be read', async () => {
    await expect(panel.getByRole('checkbox', { name: 'Rocks at the surface' })).not.toBeChecked();
    await expect(page).toHaveURL(/layers=[a-z,]*ways/);
    await expect(page).not.toHaveURL(/layers=[a-z,]*rocks/);
  });
  await test.step('When they turn on Radiocarbon dates', async () => {
    await panel.getByRole('checkbox', { name: 'Radiocarbon dates' }).check();
  });
  await test.step('Then ways of life give way too: the dates shade the ground in its colours', async () => {
    await expect(panel.getByRole('checkbox', { name: 'Ways of life' })).not.toBeChecked();
    await expect(page).toHaveURL(/layers=[a-zA-Z,]*dates/);
    await expect(page).not.toHaveURL(/layers=[a-z,]*ways/);
  });
  expect(problems).toEqual([]);
});

test('with Ways of life on, a key names each colour on the map', async ({ page }) => {
  const problems = collectProblems(page);
  const key = page.getByRole('group', { name: 'Ways of life' });
  await test.step('Given 2000 BCE with Ways of life on', async () => {
    await page.goto('./?t=-1999-06-01T12:00&layers=lunar,solar,ways');
    await globeRendered(page);
  });
  await test.step('Then a key beside the years names the ways shown, and how to read them', async () => {
    await expect(key).toBeVisible();
    await expect(key.getByRole('listitem').filter({ hasText: 'foraging' })).toBeVisible();
    await expect(key.getByRole('listitem').filter({ hasText: 'farming' }).first()).toBeVisible();
    await expect(key).toContainText('stronger where more widespread');
  });
  await test.step('When they turn Ways of life off', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Ways of life' }).uncheck();
    await page.keyboard.press('Escape');
  });
  await test.step('Then the key goes with it', async () => {
    await expect(key).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('one set of layers for all of time: the panel and its chips switch the same ones @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const panel = page.getByRole('dialog', { name: 'Layers' });
  await test.step('Given 250 million years ago, with the Layers panel open', async () => {
    await page.goto('./?ma=250&scale=all');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('When they turn on Temperature in the panel', async () => {
    await panel.getByRole('checkbox', { name: /^Temperature/ }).check();
  });
  await test.step('Then Temperature is among the layers on, and the link keeps it', async () => {
    // Beside Layers, or on a phone at the top of its sheet (#1137): the one in view.
    await expect(
      page.getByRole('group', { name: 'Layers on' }).locator('[data-layer="temperature"]'),
    ).toHaveCount(1);
    await expect(page).toHaveURL(/layers=[a-z,]*temperature/);
  });
  await test.step('And the years’ layers are greyed, saying where they draw', async () => {
    await expect(panel.locator('.layer-item.is-elsewhere')).not.toHaveCount(0);
    await panel.getByRole('checkbox', { name: /^States and empires/ }).check();
    await expect(panel.getByTestId('layer-note-empires')).toContainText(
      'Nothing here: drawn on the Years span.',
    );
    await expect(panel.getByRole('checkbox', { name: /^Temperature/ })).toBeChecked();
    await expect(panel.getByTestId('layer-note-temperature')).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('the viewpoints wear icons: icon and word, on a phone too @mobile', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-120hz', 'about layout, not frames');
  await test.step('Given a day in the years, where the viewpoints are offered (#1154)', async () => {
    await page.goto('./?t=2026-01-10T12:00');
    await globeRendered(page);
  });
  await test.step('Then each has its icon and keeps its name', async () => {
    for (const name of ['Orbit', 'Moon from Earth', 'Earth from Moon', 'Sky']) {
      const button = page
        .getByRole('group', { name: 'Viewpoint' })
        .getByRole('button', { name, exact: true });
      await expect(button.locator('svg')).toHaveCount(1);
    }
  });
});

test('the Layers rows, Layers, Explore, Full view and Famous eclipses wear icons too', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'desktop-120hz', 'about layout, not frames');
  const phone = info.project.name === 'mobile';
  const panel = page.getByRole('dialog', { name: 'Layers' });
  await test.step('Given the years, with the eclipses on', async () => {
    await page.goto('./?t=2026-01-10T12:00&layers=eclipses');
    await globeRendered(page);
  });
  await test.step('Then Layers and Explore wear icons, words beside them, or on a phone not', async () => {
    for (const name of ['Layers', 'Explore']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button.locator('svg')).toHaveCount(1);
      const box = await button.locator('.icon-label').boundingBox();
      if (phone) expect(box?.width ?? 0).toBeLessThanOrEqual(1);
      else expect(box?.width ?? 0).toBeGreaterThan(20);
    }
  });
  await test.step('And Full view wears its icon alone beside Explore, its words for screen readers (#727)', async () => {
    const button = page.getByRole('button', {
      name: 'Hide the panels for a full view',
      exact: true,
    });
    await expect(button.locator('svg')).toHaveCount(1);
    expect((await button.locator('.icon-label').boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  });
  await test.step('And Famous eclipses keeps its words everywhere, the icon alone not saying what it is', async () => {
    const famous = page.getByRole('button', { name: 'Famous eclipses', exact: true });
    await expect(famous.locator('svg')).toHaveCount(1);
    expect((await famous.locator('.icon-label').boundingBox())?.width ?? 0).toBeGreaterThan(40);
  });
  await test.step('When they open Layers', async () => {
    await openLayers(page);
  });
  await test.step('Then every row has its icon between the box and the name', async () => {
    const rows = panel.locator('.layer-label');
    const count = await rows.count();
    expect(count).toBeGreaterThan(10);
    await expect(panel.locator('.layer-label > svg')).toHaveCount(count);
    await expect(panel.getByRole('checkbox', { name: /^Volcanic eruptions/ })).toBeVisible();
  });
});

test('the date panel holds the tools, the time bar the presets, and on a phone the panel spans the screen @mobile', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'desktop-120hz', 'about layout, not frames');
  const phone = info.project.name === 'mobile';
  await test.step('Given the years', async () => {
    await page.goto('./?t=2026-01-10T12:00');
    await globeRendered(page);
  });
  await test.step('Then Layers is among the header’s tools, and the presets are in the time bar (#1116)', async () => {
    await expect(
      page.locator('.hud-tools').getByRole('button', { name: 'Layers', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.hud .time-scale')).toHaveCount(0);
    await expect(page.locator('.bottom .time-scale').filter({ visible: true })).toHaveCount(1);
  });
  if (phone) {
    await test.step('And on a phone the panel leaves the same margin on both sides', async () => {
      const hud = await page.locator('.hud').boundingBox();
      const width = page.viewportSize()?.width ?? 0;
      if (hud === null) throw new Error('not laid out');
      expect(Math.abs(hud.x - (width - hud.x - hud.width))).toBeLessThanOrEqual(1);
    });
  }
});

test('the layers on show as chips beside Layers: one off its span offers where it draws, and taking one off moves nothing (#728) @mobile', async ({
  page,
}, info) => {
  // 16–25 s on CI's passing runs, mobile: a busy runner took it past 30 s (#1216).
  test.slow();
  const problems = collectProblems(page);
  const phone = info.project.name === 'mobile';
  const on = page.getByRole('group', { name: 'Layers on' });
  await test.step('Given 100 million years ago with plates and humans on', async () => {
    await page.goto('./?ma=100&scale=all&layers=plates,humans&cam=-46,122,3');
    await expect(page.locator('.hud-date')).toHaveText('100 million years ago');
  });
  await test.step('Then the chips are beside Layers, or on a phone at the top of its sheet: every layer on, in deep time too (#1137)', async () => {
    if (phone) {
      await expect(on).toBeHidden();
      await expect(page.locator('.layers-open')).toHaveAttribute('data-on', '2');
      await openLayers(page);
    }
    await expect(on.locator('.active-chip')).toHaveCount(2);
  });
  await test.step('When plates are taken off, Then time and camera stay', async () => {
    await on.getByRole('button', { name: 'Turn off Plates' }).click();
    await expect(on.locator('[data-layer="plates"]')).toHaveCount(0);
    await expect(page).toHaveURL(/ma=100/);
    await expect(page).toHaveURL(/cam=-46/);
  });
  await test.step('When they go to where humans draw, Then the ice ages open at the earliest Homo sapiens', async () => {
    await on.getByRole('button', { name: 'Humans: go to the earliest Homo sapiens' }).click();
    await expect(page.locator('.hud-date')).toHaveText('315,000 years ago');
    await expect(on.locator('[data-layer="humans"]')).toHaveAttribute('data-draws', 'true');
  });
  expect(problems).toEqual([]);
});

test('the Layers panel reads in plain lines, the sources one tap away, and narrows to a word (#950) @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?t=2026-01-10T12:00');
  await globeRendered(page);
  await openLayers(page);
  const panel = page.getByRole('dialog', { name: 'Layers' });
  const enso = panel.locator('.layer-item').filter({ hasText: 'El Niño and La Niña' });
  await expect(enso.locator('.layer-about')).toHaveText(
    'El Niño and La Niña: the tropical Pacific warming and cooling.',
  );
  await expect(enso.getByText(/RONI/)).toBeHidden();
  await enso.locator('.layer-more > summary').click();
  await expect(enso.getByText(/RONI/)).toBeVisible();
  await panel.getByRole('searchbox', { name: 'Find a layer' }).fill('ozone');
  await expect(panel.locator('.layer-item:visible')).toHaveCount(1);
  await expect(panel.locator('.layer-item:visible')).toContainText('The ozone hole');
  expect(problems).toEqual([]);
});

test('the zoom rail offers the layers the span has data in, a tap turning one on (#1156) @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const rail = page.getByRole('group', { name: 'Layers here' });
  await test.step('Given 250 million years ago', async () => {
    await page.goto('./?ma=250&scale=all');
    await globeRendered(page);
  });
  await test.step('Then the rail offers the 540 Myr span’s layers, fossils among them, humans not', async () => {
    await expect(rail.getByRole('button', { name: 'Fossils', exact: true })).toBeVisible();
    await expect(rail.getByRole('button', { name: 'Humans', exact: true })).toHaveCount(0);
  });
  await test.step('When they tap Temperature, Then it is on, and the link keeps it', async () => {
    const temperature = rail.getByRole('button', { name: /^Temperature/ });
    await temperature.click();
    await expect(temperature).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/layers=[a-z,]*temperature/);
    await expect(page).toHaveURL(/ma=250/);
  });
  await test.step('When they go to the ice ages, Then the rail offers theirs: humans, not fossils', async () => {
    await pickSpan(page, 'Ice ages');
    await expect(rail.getByRole('button', { name: 'Humans', exact: true })).toBeVisible();
    await expect(rail.getByRole('button', { name: 'Fossils', exact: true })).toHaveCount(0);
  });
  await test.step('When they ask for all layers, Then the Layers panel opens', async () => {
    await rail.getByRole('button', { name: 'All layers' }).click();
    await expect(page.getByRole('dialog', { name: 'Layers' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});
