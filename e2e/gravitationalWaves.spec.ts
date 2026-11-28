/**
 * Feature: A gravitational wave passing (#829), told as a story (#833). Opened from a link or from Explore, a ring of
 * free masses and the space about it are drawn stretching and squeezing over the globe, in WebGL,
 * its code and LIGO's measured wave fetched only then; the stage always says how far the drawing is from the truth.
 */

import { collectProblems, expect, test } from './support';

test('GW150914 opens over the globe, its 3D view drawn and its scale stated, and closes again @acceptance @mobile', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const fetched: string[] = [];
  const data: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/waveView-')) fetched.push(request.url());
    if (request.url().includes('/gw150914.json')) data.push(request.url());
  });
  const view = page.getByTestId('wave-3d');
  const stage = page.getByRole('region', { name: 'A gravitational wave passing' });
  await test.step('Given the page opened over Livingston on 14 September 2015', async () => {
    await page.goto('./?cam=30.5630,-90.7740,3.00&t=2015-09-14T09:50Z');
    await expect(page.getByTestId('globe')).toBeVisible();
    await expect(view).toBeHidden();
    expect(fetched).toEqual([]);
    expect(data).toEqual([]);
  });
  await test.step('When the wave is named in the link, Then its view is drawn in WebGL and the stage says how far it is stretched', async () => {
    await page.goto('./?cam=30.5630,-90.7740,3.00&t=2015-09-14T09:50Z&wave=gw150914');
    await expect(view).toBeVisible();
    await expect(view).toHaveAttribute('data-drawn', 'true', { timeout: 30_000 });
    await expect(view.getByTestId('wave-canvas')).toBeVisible();
    expect(fetched).toHaveLength(1);
    expect(data).toHaveLength(1);
    await expect(stage.getByTestId('wave-scale')).toContainText('Stretched 4 × 10²⁰ times');
    await expect(stage.getByTestId('wave-moment')).toContainText(/merger|at rest/);
  });
  await test.step('When they choose Livingston, Then the detector is drawn and both detectors’ strain is plotted, the clock running', async () => {
    await stage.getByRole('button', { name: 'At Livingston' }).click();
    await expect(view).toHaveAttribute('data-chapter', 'detector');
    const plot = stage.getByTestId('strain-plot');
    await expect(plot).toBeVisible();
    await expect(plot.getByTestId('strain-l1')).toHaveAttribute('d', /^M/);
    await expect(plot.getByTestId('strain-h1')).toHaveAttribute('d', /^M/);
    await expect(plot.getByTestId('strain-clock')).toHaveText(/^09:50:45\.\d{3} UTC$/);
    await stage.getByRole('button', { name: 'The source' }).click();
    await expect(view).toHaveAttribute('data-chapter', 'source');
    await expect(stage).toContainText('not to scale');
    await expect(plot).toBeHidden();
    await stage.getByRole('button', { name: 'Space' }).click();
    await expect(view).toHaveAttribute('data-chapter', 'space');
  });
  await test.step('When they step on from the source, Then the journey crosses space and reaches Earth, Livingston first, and the link names each chapter', async () => {
    await stage.getByRole('button', { name: 'The source' }).click();
    await expect(page).toHaveURL(/chapter=source|wave=gw150914(?!.*chapter=)/);
    await stage.getByRole('button', { name: 'Next' }).click();
    await expect(view).toHaveAttribute('data-chapter', 'journey');
    await expect(page).toHaveURL(/chapter=journey/);
    await expect(stage.getByTestId('wave-moment')).toContainText('years to go');
    await expect(stage.getByTestId('wave-moment')).toContainText('Livingston hears it first', {
      timeout: 30_000,
    });
    await expect(stage.getByTestId('wave-moment')).toContainText(
      'Hanford hears it, 6.9 ms after Livingston',
      { timeout: 30_000 },
    );
  });
  await test.step('When they ask about it, Then its card gives the two black holes and links the paper and its data', async () => {
    await stage.getByRole('button', { name: 'About GW150914' }).click();
    const card = page.getByTestId('marker-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('36 (+5, −4) and 29 (± 4)');
    await expect(card.getByRole('link', { name: /GWOSC/ })).toHaveAttribute(
      'href',
      'https://gwosc.org/events/GW150914/',
    );
    await card.getByRole('button', { name: 'Close' }).click();
    await expect(card).toBeHidden();
  });
  await test.step('When they close it, Then the globe shows again and the link no longer names it', async () => {
    await stage.getByRole('button', { name: 'Close' }).click();
    await expect(view).toBeHidden();
    await expect(stage).toBeHidden();
    await expect(page).not.toHaveURL(/wave=/);
  });
  expect(problems).toEqual([]);
});

test('GW170817 opens as two neutron stars, its own story, card and scale, with nothing fetched for its wave @acceptance', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const data: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/gw150914')) data.push(request.url());
  });
  const view = page.getByTestId('wave-3d');
  const stage = page.getByRole('region', { name: 'A gravitational wave passing' });
  await test.step('When GW170817 is named in the link, Then its neutron stars are drawn and the stage tells its story', async () => {
    await page.goto('./?cam=30.5630,-90.7740,3.00&t=2017-08-17T12:41Z&wave=gw170817');
    await expect(view).toHaveAttribute('data-drawn', 'true', { timeout: 30_000 });
    await expect(view).toHaveAttribute('data-chapter', 'source');
    await expect(stage.getByRole('heading')).toHaveText('GW170817: two neutron stars merge');
    await expect(stage).toContainText('two neutron stars');
    await expect(stage.getByTestId('wave-scale')).toContainText('under a thousandth');
    await expect(stage.getByTestId('wave-moment')).toContainText(/Hz|merger|at rest/);
    expect(data).toEqual([]);
  });
  await test.step('When they ask about it, Then its card gives the neutron stars, the gamma rays and the kilonova', async () => {
    await stage.getByRole('button', { name: 'About GW170817' }).click();
    const card = page.getByTestId('marker-card');
    await expect(card).toContainText('1.36 to 1.60 and 1.17 to 1.36');
    await expect(card).toContainText('GRB 170817A');
    await expect(card).toContainText('AT 2017gfo');
    await card.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('When they step to the journey, Then Virgo hears it first, then Livingston and Hanford', async () => {
    await stage.getByRole('button', { name: 'The journey' }).click();
    await expect(view).toHaveAttribute('data-chapter', 'journey');
    await expect(stage.getByTestId('wave-moment')).toContainText('million years to go');
    await expect(stage.getByTestId('wave-moment')).toContainText('Virgo hears it first', {
      timeout: 30_000,
    });
    await expect(stage.getByTestId('wave-moment')).toContainText('Hanford hears it', {
      timeout: 30_000,
    });
  });
  await test.step('When they go to Livingston, Then what the three detectors recorded is plotted, time against frequency', async () => {
    await stage.getByRole('button', { name: 'At Livingston' }).click();
    await expect(view).toHaveAttribute('data-chapter', 'detector');
    const plot = stage.getByTestId('strain-plot');
    await expect(plot).toBeVisible();
    await expect(plot.getByTestId('recorded-h1')).toBeVisible();
    await expect(plot.getByTestId('recorded-v1')).toContainText('Virgo');
    await expect(plot.getByTestId('strain-clock')).toHaveText(/^12:41:\d\d\.\d{3} UTC$/);
  });
  await test.step('When they go to the kilonova, Then its glow is drawn, its clock runs in days, and its gold and platinum card keeps detected apart from inferred', async () => {
    await stage.getByRole('button', { name: 'The kilonova' }).click();
    await expect(view).toHaveAttribute('data-chapter', 'kilonova');
    await expect(page).toHaveURL(/chapter=kilonova/);
    await expect(stage.getByTestId('wave-moment')).toContainText(/after the merger|Day/);
    await stage.getByRole('button', { name: 'Gold and platinum' }).click();
    const card = page.getByTestId('marker-card');
    await expect(card).toContainText('Strontium, the only element named directly');
    await expect(card).toContainText('3 to 13 Earths’ mass of gold');
    await card.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('When it is closed, Then the globe shows again', async () => {
    await stage.getByRole('button', { name: 'Close' }).click();
    await expect(view).toBeHidden();
    await expect(page).not.toHaveURL(/wave=/);
  });
  expect(problems).toEqual([]);
});

test('stepping the years bar to 2015 shows GW150914, and its chip opens the wave (#837) @mobile', async ({
  page,
}) => {
  // The wave's part now loads when first named (#1327), then its 3D view: on CI's software
  // WebGL the test ran past the 30 s budget, up from 16–18 s (#1333).
  test.slow();
  const problems = collectProblems(page);
  const days = page.getByRole('list', { name: 'Events this year' });
  const chip = days.getByRole('button', { name: /GW150914: first gravitational wave/ });
  await test.step('Given 2014, with no single day marked', async () => {
    await page.goto('./?t=2014-06-01T12:00Z&cam=30,-90,3');
    await expect(page.getByTestId('globe')).toBeVisible();
    await expect(days).toBeHidden();
  });
  await test.step('When they step to 2015, Then its chip shows', async () => {
    await page.getByRole('button', { name: 'Next year' }).click();
    await expect(page).toHaveURL(/t=2015-/);
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('14 Sep');
  });
  await test.step('When they tap it, Then the wave opens on its day', async () => {
    await chip.click();
    await expect(page).toHaveURL(/wave=gw150914/);
    await expect(page).toHaveURL(/t=2015-09-14T09:50Z/);
    await expect(page.getByRole('region', { name: 'A gravitational wave passing' })).toBeVisible();
  });
  await test.step('When they step on to 2016, Then it is gone', async () => {
    await page.goto('./?t=2016-06-01T12:00Z&cam=30,-90,3');
    await expect(page.getByTestId('globe')).toBeVisible();
    await expect(days).toBeHidden();
  });
  expect(problems).toEqual([]);
});
