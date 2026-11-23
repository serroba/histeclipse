// Deep time: Pangaea, milestones, temperature, sea level, the ice ages and the sketched eons.

import type { Locator } from '@playwright/test';

import {
  collectProblems,
  expect,
  globeRendered,
  GPU,
  openSources,
  pickSpan,
  showDeepDetails,
  turnOnLayer,
  test,
  spanPreset,
} from './support';

/** The period bands' names, as their labels say them: on a phone the bands show symbols. */
async function bandNames(bar: Locator): Promise<string[]> {
  return bar
    .locator('.period-band')
    .evaluateAll((bands) =>
      bands.map((band) => (band.getAttribute('aria-label') ?? '').split(',')[0] ?? ''),
    );
}

test('Back steps through deep time: milestones and layers, and its layers stay on in the years', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?t=2024-04-08T18:17');
  await globeRendered(page);
  await pickSpan(page, '540 Myr');
  await showDeepDetails(page);
  await expect(page).toHaveURL(/&ma=540(&|$)/);
  await page.getByRole('slider', { name: 'Millions of years ago' }).fill('-250');
  await expect(page).toHaveURL(/&ma=250(&|$)/);
  await page.getByRole('button', { name: 'Later milestone' }).click();
  await expect(page).not.toHaveURL(/&ma=250(&|$)/);
  await turnOnLayer(page, 'Temperature');
  await expect(page).toHaveURL(/layers=[^&]*temperature/);
  // Back undoes the layer, then the milestone, and stays in deep time.
  await page.goBack();
  await expect(page).not.toHaveURL(/temperature/);
  await page.goBack();
  await expect(page).toHaveURL(/&ma=250(&|$)/);
  // One set of layers for all of time: going to the years leaves Temperature on, resting.
  await page.goForward();
  await page.goForward();
  await expect(page).toHaveURL(/temperature/);
  await pickSpan(page, 'Years');
  await expect(page).not.toHaveURL(/ma=/);
  await expect(page).toHaveURL(/temperature/);
  expect(problems).toEqual([]);
});

test('leaving deep time brings back the date and the eclipse that was picked', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
  await globeRendered(page);
  await pickSpan(page, '540 Myr');
  await page.getByRole('slider', { name: 'Millions of years ago' }).fill('-250');
  await expect(page.locator('.hud-date')).toHaveText(/million years ago/);
  await pickSpan(page, 'Years');
  await expect(page.locator('.hud-date')).toHaveText('8 April 2024 CE');
  await expect(page).toHaveURL(/sel=solar:2024-04-08/);
  // ΔT and UT explain themselves on hover.
  await expect(page.locator('.hud-detail abbr')).toHaveAttribute('title', /^ΔT: /);
  await expect(page.locator('.hud-time')).toHaveAttribute('title', /Universal Time/);
  // A tap shows what they mean too, for phones with no hover; another tap hides it.
  const note = page.getByTestId('term-note');
  await expect(note).toBeHidden();
  await page.locator('.hud-detail abbr').click();
  await expect(note).toContainText('Earth’s slowing spin');
  await page.locator('.hud-time').click();
  await expect(note).toContainText('Universal Time');
  await page.locator('.hud-time').click();
  await expect(note).toBeHidden();
  expect(problems).toEqual([]);
});

test(
  'deep time shows Pangaea 250 million years ago, steps, plays and returns @acceptance',
  GPU,
  async ({ page }) => {
    const problems = collectProblems(page);
    // Far enough out to see the Moon, which deep time leaves out.
    await page.goto('./?t=2024-06-21T12:00&cam=0,20,400');
    await globeRendered(page);
    const globe = page.getByTestId('globe');
    const moon = page.locator('.space-marker[data-body="moon"]');
    await expect(moon).toBeVisible();
    await pickSpan(page, '540 Myr');
    await showDeepDetails(page);
    await page.getByRole('slider', { name: 'Millions of years ago' }).fill('-250');
    await expect(page).toHaveURL(/&ma=250(&|$)/);
    await expect(page.locator('.hud-date')).toHaveText('250 million years ago');
    await expect(page.getByTestId('deep-period')).toHaveText('Triassic · Mesozoic');
    await expect(globe).toHaveAttribute('data-deep-time', /245\.png .*250\.png$/);
    // No day and night, and no Sun or Moon: their places today say nothing about then.
    await expect(globe).toHaveAttribute('data-light', 'even');
    await expect(moon).toBeHidden();
    // Poles, field, tilt and day, folded away until asked for.
    const facts = page.getByTestId('deep-facts');
    await expect(facts.getByText('Magnetic field', { exact: true })).toBeHidden();
    await facts.getByText('Poles, magnetic field, tilt, day and Sun').click();
    await expect(facts.locator('dd').nth(0)).toContainText('spin axis then');
    await expect(facts.locator('dd').nth(1)).toContainText('Reversing often');
    await expect(facts.locator('dd').nth(2)).toContainText('22.1° and 24.5°');
    await expect(facts.locator('dd').nth(3)).toContainText('23.5 h 70 Ma');
    // What the map's colours and the milestone ticks mean, folded away too.
    const key = page.getByTestId('deep-key');
    await expect(key.getByText('Ice sheets and sea ice')).toBeHidden();
    await key.getByText('What the colours mean').click();
    await expect(key.getByText('Ice sheets and sea ice')).toBeVisible();
    await expect(key.getByText('Extinctions')).toBeVisible();
    // One fold at a time: opening the key closed the facts.
    await expect(facts).not.toHaveAttribute('open', '');
    await openSources(page);
    await expect(page.getByRole('link', { name: 'PALEOMAP PaleoDEMs' })).toBeVisible();
    // The year bar gives way to the deep-time bar.
    await expect(page.getByLabel('Year', { exact: true })).toBeHidden();

    // Five million years earlier is before the end-Permian extinction (251.902 Ma).
    await page.getByRole('button', { name: '5 million years earlier' }).click();
    await expect(page).toHaveURL(/&ma=255(&|$)/);
    await expect(page.getByTestId('deep-period')).toHaveText('Permian · Paleozoic');

    // Playing runs towards the present.
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page).not.toHaveURL(/&ma=255(&|$)/);
    await page.getByRole('button', { name: 'Pause' }).click();
    const ma = Number(new URL(page.url()).searchParams.get('ma'));
    expect(ma).toBeLessThan(255);

    await pickSpan(page, 'Years');
    await expect(page).not.toHaveURL(/ma=/);
    await expect(globe).toHaveAttribute('data-deep-time', 'off');
    await expect(globe).toHaveAttribute('data-light', 'sun');
    await expect(moon).toBeVisible();
    await expect(page.getByLabel('Year', { exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  },
);

test('deep time steps through milestones and shows each estimate with its source', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
  await showDeepDetails(page);
  const milestones = page.getByTestId('deep-milestones');
  // The end-Permian extinction is within reach of 250 Ma.
  await expect(milestones.locator('summary')).toContainText('End-Permian mass extinction');

  await page.getByRole('button', { name: 'Later milestone' }).click();
  await expect(page).toHaveURL(/&ma=245(&|$)/);
  await expect(milestones.locator('summary')).toContainText('First dinosaurs');

  await milestones.locator('summary').click();
  const dinosaurs = milestones.locator('[data-milestone="first-dinosaurs"]');
  await expect(dinosaurs).toContainText('Oldest undisputed, Ischigualasto');
  await expect(dinosaurs).toContainText('Possible older dinosaur, Nyasasaurus');
  await expect(dinosaurs).toContainText('as quoted by a later paper');
  await expect(dinosaurs.getByRole('link', { name: /Martínez et al\. 2011/ })).toHaveAttribute(
    'href',
    'https://doi.org/10.1126/science.1198467',
  );

  await page.getByRole('button', { name: 'Earlier milestone' }).click();
  await expect(page).toHaveURL(/&ma=251\.978(&|$)/);
  await expect(milestones.locator('[data-milestone="end-permian-extinction"]')).toContainText(
    'Burgess, Bowring & Shen 2014',
  );
  // From a milestone, the next one is the next, not the same again.
  await page.getByRole('button', { name: 'Later milestone' }).click();
  await expect(page).toHaveURL(/&ma=245(&|$)/);
  // The slider carries a tick for every milestone.
  await expect(page.locator('.deep-mark')).toHaveCount(17);
  expect(problems).toEqual([]);
});

test(
  'deep time colours the globe by temperature, with the global mean and its caveats @acceptance',
  GPU,
  async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto('./?ma=250');
    await globeRendered(page);
    await showDeepDetails(page);
    const globe = page.getByTestId('globe');
    // Layers switches it on (#1137).
    await turnOnLayer(page, 'Temperature');
    await expect(page).toHaveURL(/layers=[^&]*temperature/);
    await expect(globe).toHaveAttribute(
      'data-temperature',
      /paleotemp\/245\.png .*paleotemp\/250\.png$/,
    );
    // The key says what the colours stand for: each one named, at its temperature.
    const key = page.getByTestId('temperature-key');
    await expect(page.locator('.temperature-heading')).toHaveText(
      'Colours: the average temperature at the surface over a year',
    );
    await expect(key.getByRole('listitem')).toHaveCount(9);
    await expect(key).toContainText('−40 °C or colder: ice-cap cold');
    await expect(key).toContainText('15 °C: mild (today’s global mean)');
    await expect(key).toContainText('45 °C or hotter: extreme heat');
    // The hothouse after the end-Permian extinction, against today's world.
    // Every model's mean, side by side: the two deep-time ones part by seven degrees here, and the
    // ice ages' own (#457), the default, stands down beyond its 800,000 years.
    await expect(page.getByTestId('temperature-mean')).toHaveText(
      'Mean: Krapp et al. 2021, land — covers the last 798,000 years · Scotese 2022 32.9 °C (today 14.6 °C) · CESM, Li et al. 2023 25.5 °C (today 13.2 °C)',
    );
    await expect(page.getByTestId('temperature-map')).toContainText(
      'The globe shows Scotese 2022. Krapp et al. 2021 does not reach this far.',
    );
    // Colour by the second model instead.
    await page.getByLabel('Temperature model').selectOption('cesm');
    await expect(page).toHaveURL(/temp=cesm/);
    await expect(globe).toHaveAttribute('data-temperature', /cesm\/240\.png .*cesm\/250\.png$/);
    await expect(page.getByTestId('temperature-map')).toContainText('about 3.75°');
    // Beyond its reach Scotese's maps stand in, and the bar says so.
    await page.getByRole('button', { name: '5 million years earlier' }).click();
    await expect(globe).toHaveAttribute(
      'data-temperature',
      /paleotemp\/250\.png .*paleotemp\/255\.png$/,
    );
    await expect(page.getByTestId('temperature-map')).toContainText('does not reach this far');
    await page.getByLabel('Temperature model').selectOption('scotese');
    await expect(page.locator('.temperature-note')).toBeHidden();

    // The 65 Ma map stands out, and the site says so.
    await page.goto('./?ma=65&layers=temperature');
    await globeRendered(page);
    await expect(page.locator('.temperature-note')).toContainText('does not say why');

    await turnOnLayer(page, 'Temperature', false);
    await expect(globe).toHaveAttribute('data-temperature', 'off');
    await expect(page.locator('.temperature-legend')).toBeHidden();
    expect(problems).toEqual([]);
  },
);

test('deep time charts sea level by four reconstructions, side by side', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
  await showDeepDetails(page);
  await turnOnLayer(page, 'Sea level');
  await expect(page).toHaveURL(/layers=[^&]*sealevel/);
  await expect(page.locator('.sea-line')).toHaveCount(4);
  const legend = page.getByTestId('sea-legend');
  await expect(legend.locator('[data-series="van-der-meer-2022"]')).toContainText(
    '+100 m (+90 to +110)',
  );
  // The Cenozoic curve does not reach 250 Ma, and says so.
  await expect(legend.locator('[data-series="miller-2020"]')).toContainText(
    '— covers 980 ka to 65 Ma',
  );
  await expect(legend.getByRole('link', { name: 'van der Meer et al. 2022' })).toHaveAttribute(
    'href',
    'https://doi.org/10.1016/j.gr.2022.07.014',
  );

  // A click on the chart goes to that moment: the right-hand quarter is the last 135 Myr.
  const chart = page.locator('.sea-chart');
  const box = await chart.boundingBox();
  if (box === null) throw new Error('no chart');
  await chart.click({ position: { x: box.width * 0.75, y: box.height / 2 } });
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('ma'))).toBeLessThan(160);
  expect(Number(new URL(page.url()).searchParams.get('ma'))).toBeGreaterThan(110);

  await turnOnLayer(page, 'Sea level', false);
  await expect(legend).toBeHidden();
  expect(problems).toEqual([]);
});

for (const rate of [60, 120]) {
  test.describe(`on a ${String(rate)} Hz display`, () => {
    // Frames at exactly this rate, so the step each frame takes is what such a display gives.
    test.use({ refreshRate: rate });
    test('playing the ice ages moves towards the present', async ({ page }) => {
      await page.goto('./?ma=0.5&scale=ice');
      await globeRendered(page);
      await page.getByRole('button', { name: 'Play' }).click();
      // Any frame rate moves it on from 500,000 years ago; a step rounded away would not. (How
      // fast depends on how often a busy machine runs the frames, so the pace is unit-tested.)
      await expect(page).toHaveURL(/&ma=0\.4\d*(&|$)/);
      await page.getByRole('button', { name: 'Pause' }).click();
    });
  });
}

test('a link to a part of deep time shows that part, and a span picked shows it whole (#1074)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  await test.step('Given a link to 124–76 million years ago, at 100', async () => {
    await page.goto('./?ma=100&scale=all&dw=124,76');
    await expect(page.locator('.hud-date')).toHaveText('100 million years ago');
  });
  await test.step('Then the bar runs from 124 to 76 Ma, all of it the Cretaceous, in its two epochs (#1075)', async () => {
    await expect(bar.getByTestId('scale-start')).toHaveText('124 Ma');
    await expect(bar.getByTestId('scale-end')).toHaveText('76 Ma');
    await expect.poll(() => bandNames(bar)).toEqual(['Lower Cretaceous', 'Upper Cretaceous']);
    await expect(spanPreset(page, '540 Myr')).toHaveAttribute('aria-pressed', 'false');
  });
  await test.step('When they zoom out, Then the bar shows twice the time about the moment, 148 to 52 Ma', async () => {
    await bar.getByRole('button', { name: 'Show more time' }).click();
    await expect(bar.getByTestId('scale-start')).toHaveText('148 Ma');
    await expect(bar.getByTestId('scale-end')).toHaveText('52 Ma');
    await expect(page).toHaveURL(/dw=148(,|%2C)52/);
    await expect(page.locator('.hud-date')).toHaveText('100 million years ago');
  });
  await test.step('When the 540 Myr span is picked, Then the bar shows it whole, and the link drops the part', async () => {
    await pickSpan(page, '4.6 Gyr');
    await pickSpan(page, '540 Myr');
    await expect(page).not.toHaveURL(/dw=/);
    await expect.poll(() => bandNames(bar)).toContain('Jurassic');
  });
  expect(problems).toEqual([]);
});

test('a tap on a period fits the bar to it, and the crumbs above zoom back out a level at a time (#1075) @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const crumbs = bar.getByRole('navigation', { name: 'Where in Earth’s history' });
  await test.step('Given part of the Cretaceous, Then the crumbs say where it lies', async () => {
    await page.goto('./?ma=90&scale=all&dw=124,76');
    await expect(crumbs.getByRole('button')).toHaveText([
      'Earth',
      'Phanerozoic',
      'Mesozoic',
      'Cretaceous',
    ]);
  });
  await test.step('When the Late Cretaceous is tapped, Then the bar shows all of it, in its ages, the moment kept', async () => {
    await bar.getByRole('button', { name: /^Upper Cretaceous, / }).click();
    await expect(page).toHaveURL(/dw=100\.5(,|%2C)66/);
    await expect.poll(() => bandNames(bar)).toContain('Turonian');
    await expect(page.locator('.hud-date')).toHaveText('90 million years ago');
    await expect(crumbs.getByRole('button', { name: 'Upper Cretaceous' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });
  await test.step('When the Mesozoic crumb is tapped, Then its three periods', async () => {
    await crumbs.getByRole('button', { name: 'Mesozoic' }).click();
    await expect.poll(() => bandNames(bar)).toEqual(['Triassic', 'Jurassic', 'Cretaceous']);
  });
  await test.step('When Earth is tapped, Then all of its history, as the 4.6 Gyr preset, and no crumbs', async () => {
    await crumbs.getByRole('button', { name: 'Earth' }).click();
    await expect(page).toHaveURL(/scale=eons/);
    await expect(page).not.toHaveURL(/dw=/);
    await expect(crumbs).toBeHidden();
    await expect(spanPreset(page, '4.6 Gyr')).toHaveAttribute('aria-pressed', 'true');
  });
  expect(problems).toEqual([]);
});

test('deep time narrows to the ice ages, in thousands of years', GPU, async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250&layers=sealevel');
  await globeRendered(page);
  await showDeepDetails(page);
  await pickSpan(page, 'Ice ages');
  // The ice ages open at their oldest moment; then on to the last glacial maximum.
  await expect(page).toHaveURL(/&ma=2\.6&scale=ice/);
  await page.getByLabel('Thousands of years ago').fill('-21');
  await expect(page).toHaveURL(/&ma=0\.021&scale=ice/);
  await expect(page.locator('.hud-date')).toHaveText('21,000 years ago');
  await expect(page.getByTestId('ice-note')).toBeVisible();
  await expect(page.getByLabel('Thousands of years ago')).toHaveValue('-21');
  // The ice ages have temperature maps of their own (#457).
  await turnOnLayer(page, 'Temperature');
  await expect(page).toHaveURL(/layers=[a-z,]*temperature/);
  // Both ice-age reconstructions read the glacial maximum.
  const legend = page.getByTestId('sea-legend');
  await expect(legend.locator('[data-series="bintanja-2008"]')).toContainText('−123 m');
  await expect(legend.locator('[data-series="spratt-2016"]')).toContainText('−119 m (−134 to −91)');

  // The coast is drawn at the glacial maximum's sea level, from the source's own present day.
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-shelf', /shelf\/today\.png$/);
  await expect(globe).toHaveAttribute('data-sea-level', '-121.3');
  await expect(page.getByTestId('coastline')).toHaveText(
    'Coastline at −121 m, following Bintanja & van de Wal 2008.',
  );
  // The ice sheets of the glacial maximum, blended between the 20,000 and 22,500-year maps.
  await expect(globe).toHaveAttribute('data-ice', /icesheets\/20000\.png .*icesheets\/22500\.png$/);
  await expect(page.getByTestId('ice-sheets')).toContainText('PaleoMIST 1.0');
  await page.getByLabel('Coastline follows').selectOption('spratt-2016');
  await expect(page).toHaveURL(/coast=spratt-2016/);
  await expect(page.getByTestId('coastline')).toContainText('−128 m, following Spratt & Lisiecki');

  await page.getByRole('button', { name: '5,000 years earlier' }).click();
  await expect(page).toHaveURL(/&ma=0\.026(&|$)/);

  // Sea ice: the glacial maximum's, by one of three models, which the reader can switch.
  await expect(page.getByTestId('sea-ice')).toContainText('the Last Glacial Maximum’s');
  await expect(globe).toHaveAttribute('data-sea-ice', /seaice\/mpi-esm1-2-lr-most\.png 1\.00$/);
  await page.getByLabel('Ice-age sea ice from').selectOption('miroc-es2l');
  await expect(page).toHaveURL(/seaice=miroc-es2l/);
  await expect(globe).toHaveAttribute('data-sea-ice', /seaice\/miroc-es2l-most\.png /);

  // Before the ice maps reach, a later map stands in, matched by sea level, and the bar says so.
  await page.goto('./?ma=0.377&scale=ice');
  await globeRendered(page);
  await expect(page.getByTestId('ice-sheets')).toContainText('Ice sheets: a stand-in.');
  await expect(page.getByTestId('ice-sheets')).toContainText('when sea level was similar');
  await expect(globe).toHaveAttribute('data-ice', /icesheets\/(\d+)\.png .*icesheets\/\1\.png$/);

  await pickSpan(page, '540 Myr');
  await expect(page).not.toHaveURL(/scale=/);
  await expect(page.getByLabel('Millions of years ago')).toBeVisible();
  await expect(page.getByTestId('ice-note')).toBeHidden();
  expect(problems).toEqual([]);
});

test('deep time draws recent coasts from NOAA’s depths on the 540 Myr scale too', async ({
  page,
}) => {
  const problems = collectProblems(page);
  // Today: shallow straits such as Torres Strait come from the 1-metre depths, at today's sea.
  await page.goto('./?ma=0');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-shelf', /shelf\/today\.png$/);
  await expect(globe).toHaveAttribute('data-sea-level', '0.0');
  await expect(page.getByTestId('coastline')).toHaveText(
    'Coastline at today’s sea level, following Bintanja & van de Wal 2008.',
  );
  // Before the ice ages, the elevation maps' own coasts.
  await page.goto('./?ma=100');
  await globeRendered(page);
  await expect(globe).toHaveAttribute('data-shelf', 'off');
  await expect(page.getByTestId('coast-note')).toBeHidden();
  expect(problems).toEqual([]);
});

test('deep time outlines a second reconstruction’s continents', GPU, async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=252');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await turnOnLayer(page, 'Plates');
  await expect(page).toHaveURL(/layers=[^&]*plates/);
  await expect(globe).toHaveAttribute('data-plates', /plates\/250\.png .*plates\/255\.png$/);
  await expect(page.getByTestId('plates-note')).toContainText('Cao et al. 2024');
  // Lined up with the surface map in longitude, and the bar says by how much.
  await expect(page.getByTestId('plates-note')).toContainText('Turned 2° west');
  await turnOnLayer(page, 'Plates', false);
  await expect(globe).toHaveAttribute('data-plates', 'off');
  await expect(page.getByTestId('plates-note')).toBeHidden();
  expect(problems).toEqual([]);
});

test('before the reconstructions, the reader picks whose hypotheses the globe sketches @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=3000&scale=eons');
  await globeRendered(page);
  await showDeepDetails(page);
  const globe = page.getByTestId('globe');
  // Land of invented shape, its share from a crust-growth curve, with the choice in view.
  await expect(globe).toHaveAttribute('data-sketch', 'ocean 0.184 90');
  await expect(page.getByTestId('sketch-headline')).toContainText('18% of the surface land');
  await page.getByLabel('How much land').selectOption('flooded');
  await expect(page).toHaveURL(/land=flooded/);
  await expect(globe).toHaveAttribute('data-sketch', 'ocean 0.025 90');
  // What it rests on is folded away, with its sources.
  const sources = page.getByTestId('sketch-sources');
  await sources.locator('summary').click();
  await expect(sources).toContainText('Flament, Coltice & Rey 2008');

  // Where the plates reach, their continents are the sketch's, Plates on or not (#1149): as
  // shallow sea, flooded or not; the layer adds its outlines.
  await page.goto('./?ma=1596&scale=eons');
  await globeRendered(page);
  await expect(globe).toHaveAttribute('data-sketch', 'ocean 0.000 90');
  await expect(globe).toHaveAttribute('data-plate-land', /plates\/.+\.png .*plates\/.+\.png$/);
  await expect(globe).toHaveAttribute('data-plates', 'off');
  await expect(page.getByTestId('sketch-headline')).toContainText('Cao et al. 2024');
  await expect(page.getByLabel('How much land')).toBeHidden();
  await page.goto('./?ma=1596&scale=eons&layers=plates');
  await globeRendered(page);
  await expect(globe).toHaveAttribute('data-plates', /plates\/.+\.png .*plates\/.+\.png$/);

  // A snowball: frozen over by default, open tropics in the slushball.
  await page.goto('./?ma=700&scale=eons');
  await globeRendered(page);
  await expect(globe).toHaveAttribute('data-sketch', 'ocean 0.000 -1');
  await expect(page.getByLabel('How much land')).toBeHidden();
  await page.getByLabel('Snowball ice').selectOption('slush');
  await expect(page).toHaveURL(/snowball=slush/);
  await expect(globe).toHaveAttribute('data-sketch', 'ocean 0.000 25');

  // Molten until shortly after the Moon-forming impact, whose date the reader picks.
  await page.goto('./?ma=4450&scale=eons');
  await globeRendered(page);
  await expect(globe).toHaveAttribute('data-sketch', /^ocean/);
  await page.getByLabel('Moon-forming impact').selectOption('young');
  await expect(page).toHaveURL(/impact=young/);
  await expect(globe).toHaveAttribute('data-sketch', /^magma/);
  await expect(page.getByTestId('sketch-headline')).toHaveText(
    'Sketch, not a map: a molten surface.',
  );
  expect(problems).toEqual([]);
});

test('in the Hadean the reader picks where the water came from, and delivered water lands as icy impactors (#1142) @acceptance', async ({
  page,
}) => {
  // Deep time plays and impacts play out: slow on a phone drawn in software.
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  await test.step('Given 4,540 million years ago, its sketch in view', async () => {
    await page.goto('./?ma=4540&scale=eons');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('Then Earth’s own rock is the first answer, on its sources’ say-so', async () => {
    const picker = page.getByLabel('Where the water came from');
    await expect(picker).toHaveValue('inherited');
    const sources = page.getByTestId('sketch-sources');
    await sources.locator('summary').click();
    await expect(sources).toContainText('Piani et al. 2020');
  });
  await test.step('When they pick delivered water and play', async () => {
    await page.getByLabel('Where the water came from').selectOption('delivered');
    await expect(page).toHaveURL(/water=delivered/);
    await expect(page.getByTestId('sketch-sources')).toContainText('Alexander et al. 2012');
    await page
      .getByRole('navigation', { name: 'Deep time' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
  });
  await test.step('Then icy impactors strike as the time passes them', async () => {
    await expect(globe).toHaveAttribute('data-impacts-played', /^[1-9]/, { timeout: 60_000 });
  });
  expect(problems).toEqual([]);
});

test(
  'deep time reaches back 4.6 billion years, sketching hypotheses before the maps',
  GPU,
  async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto('./?ma=250');
    await globeRendered(page);
    await showDeepDetails(page);
    const globe = page.getByTestId('globe');
    await pickSpan(page, '4.6 Gyr');
    await expect(page).toHaveURL(/scale=eons/);
    await expect(page.getByTestId('uncharted-note')).toBeHidden();

    // Before the elevation maps reach, no map: a sketch of a hypothesis, which says so.
    await page.goto('./?ma=3000&scale=eons&layers=temperature');
    await globeRendered(page);
    await showDeepDetails(page);
    await expect(page.locator('.hud-date')).toHaveText('3,000 million years ago');
    await expect(page.locator('.hud-detail')).toHaveText('Mesoarchean era · Archean eon');
    await expect(globe).toHaveAttribute('data-uncharted', 'true');
    await expect(page.getByTestId('sketch-headline')).toContainText('Sketch, not a map');

    // Milestones reach back too: the next older is the Late Heavy Bombardment's oldest view.
    await page.getByRole('button', { name: 'Earlier milestone' }).click();
    await expect(page).toHaveURL(/&ma=4200(&|$)/);
    const milestones = page.getByTestId('deep-milestones');
    await milestones.locator('summary').click();
    await expect(milestones.locator('[data-milestone="late-heavy-bombardment"]')).toContainText(
      'Boehnke & Harrison 2016',
    );

    // Back to the 540 Myr scale: it opens at the elevation maps' oldest.
    // The Plates layer fills in one reconstruction's continents where the masks reach, 1.8 Gyr.
    await page.goto('./?ma=1500&scale=eons&layers=plates');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-uncharted', 'true');
    await expect(globe).toHaveAttribute('data-plates', /plates\/1495\.png .*plates\/1500\.png$/);
    await expect(page.getByTestId('plates-note')).toContainText('No surface map reaches this far');
    await expect(page.getByTestId('uncharted-note')).toBeVisible();
    await expect(page.getByTestId('sketch-note')).toBeHidden();
    await page.goto('./?ma=3000&scale=eons&layers=plates');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-plates', 'off');
    await expect(page.getByTestId('plates-note')).toContainText('reach back 1,800 million years');

    await pickSpan(page, '540 Myr');
    await expect(page).toHaveURL(/&ma=540(&|$)/);
    await expect(globe).toHaveAttribute('data-uncharted', 'false');
    expect(problems).toEqual([]);
  },
);
