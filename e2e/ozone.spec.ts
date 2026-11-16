/**
 * The ozone hole (#722): each October's ozone over the whole Earth on the globe, the hole an
 * opening in it, and the record beside it.
 */

import { collectProblems, expect, globeRendered, test } from './support';

// The 3D surface is drawn over a whole phone screen, and on CI's software WebGL, shared out among
// workers, a frame can take seconds: a phone's pixel density would multiply that by seven for
// nothing these checks read.
test.use({ deviceScaleFactor: 1 });

test('the ozone hole shows each spring on the globe, with its record beside it, and says when a year is missing @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const panel = page.getByRole('region', { name: 'The ozone hole and the gases' });
  await test.step('Given a March day of 2006 with the ozone hole on', async () => {
    await page.goto('./?t=2006-03-01T12:00Z&layers=ozone&cam=-70,40,3');
    await globeRendered(page);
  });
  await test.step('Then that October’s map is drawn, with the key to its colours and the record beside the globe', async () => {
    await expect(globe).toHaveAttribute('data-ozone', 'map:2006');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('NASA Ozone Watch');
    await expect(panel).toContainText('Globe: ozone in October 2006, Dobson units.');
    await expect(panel).toContainText('Under 220: the hole, left open');
    await expect(panel).toContainText('MSR-2 reanalysis (KNMI)');
  });
  await test.step('When they go to 1977, Then nothing is drawn: the early instrument saw too little', async () => {
    await page.locator('.hud-date-button').click();
    await page.getByRole('textbox', { name: 'A year or an age' }).fill('1977');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(globe).toHaveAttribute('data-ozone', 'off');
  });
  await test.step('Then its chip says so in words, and takes them to the next year measured (#751)', async () => {
    const phone = (page.viewportSize()?.width ?? 1000) < 600;
    if (phone) await page.getByRole('button', { name: 'Layers' }).click();
    const chip = page.getByRole('group', { name: 'Layers on' }).locator('[data-layer="ozone"]');
    await expect(chip).toHaveAttribute('data-coverage', 'gap');
    await expect(chip).toContainText('none in 1977 CE');
    await chip.getByRole('button', { name: /go to 1979 CE/ }).click();
    await expect(globe).not.toHaveAttribute('data-ozone', 'off');
  });
  expect(problems).toEqual([]);
});

test('when the ozone record does not load, its chip says so, and Try again draws it (#751) @mobile', async ({
  page,
}) => {
  const globe = page.getByTestId('globe');
  let fail = true;
  await page.route('**/data/ozone/history.json', (route) =>
    fail ? route.fulfill({ status: 503, body: 'down' }) : route.fallback(),
  );
  await test.step('Given a March day of 2006 with the ozone hole on, and its record unreachable', async () => {
    await page.goto('./?t=2006-03-01T12:00Z&layers=ozone&cam=-70,40,3');
    await globeRendered(page);
  });
  const phone = (page.viewportSize()?.width ?? 1000) < 600;
  if (phone) await page.getByRole('button', { name: 'Layers' }).click();
  const chip = page.getByRole('group', { name: 'Layers on' }).locator('[data-layer="ozone"]');
  await test.step('Then its chip says it could not load, in words', async () => {
    await expect(chip).toHaveAttribute('data-coverage', 'failed');
    await expect(chip).toContainText('could not load');
  });
  await test.step('When the record is back and they try again, Then the ozone is drawn', async () => {
    fail = false;
    await chip.getByRole('button', { name: /try again/ }).click();
    await expect(globe).toHaveAttribute('data-ozone', 'map:2006');
    await expect(chip).toHaveAttribute('data-coverage', 'available');
  });
});

test('the ozone layer is drawn in 3D on a day of its season, and ozone’s own bar plays its years and days (#804, #805) @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const panel = page.getByRole('region', { name: 'The ozone hole and the gases' });
  const bar = page.getByRole('group', { name: 'The ozone layer, 1970 to 2025' });
  await test.step('Given an October of 2002 with the ozone hole on, Then the year’s map, and the bar is ozone’s own, not the years’', async () => {
    await page.goto('./?t=2002-10-01T12:00Z&layers=ozone&cam=-60,40,3.4');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-ozone', 'map:2002');
    await expect(globe).toHaveAttribute('data-ozone-shell', 'off');
    await expect(bar).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Year in the Holocene' })).toBeHidden();
    await expect(bar.getByRole('button', { name: /Montreal Protocol/ })).toBeAttached();
  });
  await test.step('When they play, Then the next step is the first season’s first day, in 3D, and the days go by until they stop', async () => {
    await bar.getByRole('button', { name: 'Play the ozone years' }).click();
    await expect(globe).toHaveAttribute('data-ozone-shell', 'on');
    await expect(page).toHaveURL(/t=2003-07-/);
    await expect(page).not.toHaveURL(/t=2003-07-01/);
    await bar.getByRole('button', { name: 'Stop the ozone years' }).click();
    const stopped = await page.locator('.hud-date').textContent();
    await page.waitForTimeout(500);
    await expect(page.locator('.hud-date')).toHaveText(stopped ?? '');
  });
  await test.step('When they pick the widest hole, Then its day in 2006 is drawn round the Earth, with an opening', async () => {
    const july = Number(await globe.getAttribute('data-ozone-shell-triangles'));
    await bar.getByRole('button', { name: /The widest hole/ }).click();
    await expect(page).toHaveURL(/t=2006-(09|10)-\d\dT12(%3A|:)00/);
    await expect(panel).toContainText('its heights drawn 40 times larger');
    await expect(panel).toContainText('Open: no height holds that much ozone');
    await expect(panel).toContainText('CAMS reanalysis, Copernicus Atmosphere Monitoring Service');
    // The hole open: less of the surface than in July.
    await expect
      .poll(async () => Number(await globe.getAttribute('data-ozone-shell-triangles')))
      .toBeLessThan(july);
  });
  await test.step('When the layer goes off, Then the years’ own bar is back', async () => {
    const phone = (page.viewportSize()?.width ?? 1000) < 600;
    if (phone) await page.getByRole('button', { name: 'Layers' }).click();
    await page
      .getByRole('group', { name: 'Layers on' })
      .getByRole('button', { name: 'Turn off The ozone hole' })
      .click();
    await expect(bar).toBeHidden();
    await expect(globe).toHaveAttribute('data-ozone-shell', 'off');
    await expect(page.getByRole('slider', { name: 'Year in the Holocene' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('Explore leads to the ozone hole: its widest day, with its own bar (#805)', async ({
  page,
}) => {
  await page.goto('./');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Explore' }).click();
  const explore = page.getByRole('dialog', { name: 'Explore' });
  await explore.getByRole('tab', { name: 'Climate' }).click();
  await explore.getByRole('button', { name: 'The ozone hole', exact: true }).first().click();
  await expect(page.getByTestId('globe')).toHaveAttribute('data-ozone-shell', 'on');
  await expect(page).toHaveURL(/t=2006-09-22/);
  await expect(page.getByRole('group', { name: 'The ozone layer, 1970 to 2025' })).toBeVisible();
});

test('in the ozone section a tap on the globe clears the panels, and the panel beside it can be moved (#811) @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const panel = page.getByRole('region', { name: 'The ozone hole and the gases' });
  const grip = page.getByRole('button', { name: 'Move the panels' });
  const tapGlobe = async () => {
    const box = await globe.boundingBox();
    const hud = await page.locator('.hud').boundingBox();
    if (box === null) throw new Error('no globe');
    // On the globe, under the date panel where it is shown and clear of the panel beside it.
    const y = hud === null ? box.height * 0.4 : hud.y + hud.height + 24;
    await page.mouse.click(box.x + box.width * 0.6, box.y + y);
  };
  await test.step('Given the ozone layer on a day of its season', async () => {
    await page.goto('./?t=2006-09-22T12:00Z&layers=ozone&cam=-60,40,3.4');
    await globeRendered(page);
    await expect(panel).toBeVisible();
  });
  await test.step('When they drag the grip up, Then the panel follows it', async () => {
    const before = await panel.boundingBox();
    const hold = await grip.boundingBox();
    if (before === null || hold === null) throw new Error('no panel');
    const x = hold.x + hold.width / 2;
    const y = hold.y + hold.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 60, { steps: 4 });
    await page.mouse.up();
    const after = await panel.boundingBox();
    expect(after?.y).toBeCloseTo(before.y - 60, 0);
  });
  await test.step('And the arrow keys move it too', async () => {
    const before = await panel.boundingBox();
    await grip.press('ArrowDown');
    const after = await panel.boundingBox();
    expect(after?.y).toBeCloseTo((before?.y ?? 0) + 24, 0);
  });
  await test.step('When they tap the globe, Then the panels clear for a full view, and no place is picked', async () => {
    await tapGlobe();
    await expect(page.locator('#app')).toHaveAttribute('data-panels', 'hidden');
    await expect(page.locator('.hud')).toBeHidden();
    await expect(page.locator('.bottom')).toBeHidden();
    await expect(panel).toBeHidden();
    expect(page.url()).not.toContain('loc=');
  });
  await test.step('When they tap it again, Then the panels come back', async () => {
    await tapGlobe();
    await expect(page.locator('.hud')).toBeVisible();
    await expect(panel).toBeVisible();
  });
  expect(problems).toEqual([]);
});
