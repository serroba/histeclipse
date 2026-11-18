/**
 * Feature: A gravitational wave passing (#829). Opened from a link or from Explore, a ring of
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
    await stage.getByRole('button', { name: 'Space' }).click();
    await expect(view).toHaveAttribute('data-chapter', 'space');
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
