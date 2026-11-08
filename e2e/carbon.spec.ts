/**
 * Feature: Carbon-14 made in the sky (#269). Where cosmic rays make carbon-14, most over the
 * poles; a card to try another field or Sun and follow it into living things; and, beyond
 * 50,000 years, what radiocarbon cannot date.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

/** The glow's rates by latitude, equator first, as the globe reports them. */
async function glow(page: Page): Promise<number[]> {
  const value = (await page.getByTestId('globe').getAttribute('data-c14-glow')) ?? 'off';
  return value === 'off' ? [] : value.split(' ').map(Number);
}

test('cosmic rays make carbon-14 mostly over the poles, more as the shield weakens', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const note = page.getByTestId('layer-note-carbonMade');
  const dialog = page.getByRole('dialog', { name: 'How is carbon-14 made?' });
  await test.step('Given the years, standing in Europe', async () => {
    await page.goto('./?t=1500-06-01T12:00&loc=48,10');
    await globeRendered(page);
  });
  await test.step('When they turn on Carbon-14 made in the sky', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Carbon-14 made in the sky' }).check();
  });
  await test.step('Then the globe glows, brightest over the poles', async () => {
    await expect(page).toHaveURL(/layers=[a-zA-Z,]*carbonMade/);
    await expect(note).toHaveText(/most is made over the poles/);
    await expect.poll(async () => (await glow(page)).length).toBe(19);
    const rates = await glow(page);
    expect(rates.at(-1)).toBe(1);
    expect(rates[0]).toBeLessThan(0.25);
  });
  await test.step('When they ask how it is made', async () => {
    await page.getByRole('button', { name: 'How is it made?' }).click();
  });
  await test.step('Then the card explains it, and how it reaches living things', async () => {
    await expect(dialog).toContainText('n + ¹⁴N → ¹⁴C + p');
    await expect(dialog.getByRole('radio', { name: 'At the moment shown' })).toBeChecked();
    await expect(dialog.getByTestId('carbon-made-notes')).toContainText('GGF100k');
    await expect(dialog.getByTestId('carbon-made-result')).toContainText(
      /times as much over the poles as over the equator/,
    );
    await expect(dialog.getByTestId('carbon-made-path')).toContainText('every 5,730 years');
    await expect(dialog.getByTestId('carbon-made-path')).toContainText('400–600 radiocarbon years');
  });
  await test.step('When they take the field back to the Laschamp excursion', async () => {
    await dialog.getByRole('radio', { name: 'Laschamp excursion, 41,000 years ago' }).check();
  });
  await test.step('Then about twice as much is made, nearly as much at the equator', async () => {
    await expect(dialog.getByTestId('carbon-made-result')).toContainText(
      /, 2\.\d times today’s average/,
    );
    await expect(dialog.getByTestId('carbon-made-notes')).toContainText('GGF100k');
    await expect.poll(async () => (await glow(page))[0] ?? 0).toBeGreaterThan(0.8);
  });
  await test.step('And the sources name the model', async () => {
    await dialog.getByRole('button', { name: 'Close' }).click();
    await openSources(page);
    await expect(page.getByRole('link', { name: 'Kovaltsov et al. 2012' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1016/j.epsl.2012.05.036',
    );
  });
  expect(problems).toEqual([]);
});

test('the glow follows the field through the ice ages, and beyond 50,000 years names other clocks', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const note = page.getByTestId('layer-note-carbonMade');
  await test.step('Given the ice ages 30,000 years ago, with the layer on', async () => {
    await page.goto('./?ma=0.03&scale=ice&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
  });
  let equatorThen = 0;
  await test.step('Then it glows for the field then, as GGF100k has it', async () => {
    await expect(note).toContainText(
      /The field at the moment shown, 6\.\d × 10²² A m² \(GGF100k\)/,
    );
    await expect.poll(async () => (await glow(page)).length).toBe(19);
    equatorThen = (await glow(page))[0] ?? 0;
  });
  await test.step('When they go to the Laschamp excursion, 41,000 years ago', async () => {
    await page.goto('./?ma=0.041&scale=ice&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then the field is weak, more is made nearer the equator, and other models are named', async () => {
    await expect(note).toContainText('is weak, 2.');
    await expect(note).toContainText('Korte et al. 2019');
    await expect.poll(async () => (await glow(page))[0] ?? 0).toBeGreaterThan(equatorThen * 1.5);
  });
  await test.step('When they go back 100,000 years', async () => {
    await page.goto('./?ma=0.1&scale=ice&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then nothing glows, and the note names other clocks', async () => {
    await expect(note).toContainText('too little carbon-14 is left to measure');
    await expect(note).toContainText('potassium–argon and uranium–lead');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-c14-glow', 'off');
  });
  await test.step('When they go to 250 million years ago', async () => {
    await page.goto('./?ma=250&scale=all&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then it says so there too', async () => {
    await expect(note).toContainText('uranium–lead');
  });
  expect(problems).toEqual([]);
});

test('a cosmic ray’s shower makes carbon-14, step by step, under the field picked', async ({
  page,
}) => {
  // Two showers, one played to its end: software-rendered phones on CI need the time.
  test.setTimeout(180_000);
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const caption = page.getByTestId('shower-caption');
  const dialog = page.getByRole('dialog', { name: 'How is carbon-14 made?' });
  await test.step('Given the card on how carbon-14 is made, with today’s field', async () => {
    await page.goto('./?t=1500-06-01T12:00&loc=48,10&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
    await page.getByRole('button', { name: 'How is it made?' }).click();
  });
  await test.step('When they watch a cosmic ray make carbon-14', async () => {
    await dialog.getByRole('button', { name: 'Watch a cosmic ray make carbon-14' }).click();
  });
  await test.step('Then the field turns the equator’s ray away, and the caption says so', async () => {
    await expect(dialog).toBeHidden();
    await expect(caption).toContainText('bends this one back out to space', { timeout: 20_000 });
    await expect(globe).toHaveAttribute('data-shower-labels', /Turned away: under \d+ GeV/);
    // Over the place picked, it lands in northern Italy: on land, so a plant takes it in.
    await expect(globe).toHaveAttribute('data-shower-ground', 'land');
    // The place's pin rests while the shower plays, so the plant can be seen.
    await expect(globe).toHaveAttribute('data-pin-shown', 'false');
  });
  const stage = page.getByRole('region', { name: 'How carbon-14 is made, step by step' });
  await test.step('And the panels step aside for its stage', async () => {
    await expect(stage).toBeVisible();
    await expect(page.locator('.hud')).toBeHidden();
  });
  await test.step('When they replay it from the start and pause it', async () => {
    // A slow runner may have played it out by now: replay first, so the pause comes early.
    await stage.getByRole('button', { name: 'Replay' }).click();
    await stage.getByRole('button', { name: 'Pause', exact: true }).click();
  });
  await test.step('And the rays come in in 3D, Earth’s field drawn, each ray named', async () => {
    // A slow runner may have played on before the pause: back to the first step.
    for (let tries = 0; tries < 6; tries += 1) {
      if ((await globe.getAttribute('data-shower-step')) === 'rays') break;
      await stage.getByRole('button', { name: 'Back' }).click();
      await page.waitForTimeout(200);
    }
    await expect(globe).toHaveAttribute('data-shower-step', 'rays');
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-chapter', 'rays', { timeout: 20_000 });
    await expect(story).toHaveAttribute('data-rendered', 'true', { timeout: 20_000 });
    await expect(story).toContainText('Earth’s magnetic field');
    await expect(story).toContainText('Cosmic ray: a proton of a few GeV');
    await expect(story).toContainText(/Turned away: under \d+ GeV/);
  });
  let paused = '';
  await test.step('Then it stands still', async () => {
    await expect(globe).toHaveAttribute('data-shower-playing', 'false');
    // A slow runner may have played on to the last step before the pause: go back one first,
    // so there is a next step to go to.
    // (Back from well into a step goes to its start, so it may take two.)
    for (let tries = 0; tries < 2; tries += 1) {
      if ((await globe.getAttribute('data-shower-step')) !== 'plant') break;
      await stage.getByRole('button', { name: 'Back' }).click();
      await page.waitForTimeout(200);
    }
    await expect(globe).not.toHaveAttribute('data-shower-step', 'plant');
    paused = (await globe.getAttribute('data-shower-step')) ?? '';
    await page.waitForTimeout(1_500);
    await expect(globe).toHaveAttribute('data-shower-step', paused);
  });
  await test.step('When they step on, and back', async () => {
    await stage.getByRole('button', { name: 'Next' }).click();
    await expect(globe).not.toHaveAttribute('data-shower-step', paused);
    await stage.getByRole('button', { name: 'Back' }).click();
  });
  await test.step('Then they are back where they paused, still paused', async () => {
    await expect(globe).toHaveAttribute('data-shower-step', paused);
    await expect(globe).toHaveAttribute('data-shower-playing', 'false');
    await expect(stage.locator('[aria-current="step"]')).toHaveCount(1);
  });
  await test.step('When they step on to the last step', async () => {
    // Stepping, not playing: on a runner that draws a frame every few seconds, playing it out
    // would outlast the scenario.
    for (let tries = 0; tries < 6; tries += 1) {
      if ((await globe.getAttribute('data-shower-step')) === 'plant') break;
      await stage.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(200);
    }
  });
  await test.step('Then the last picture holds with its caption, and there is no next', async () => {
    await expect(globe).toHaveAttribute('data-shower-step', 'plant');
    await expect(caption).toContainText('photosynthesis');
    await expect(stage.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(stage.getByRole('button', { name: 'Replay' })).toBeVisible();
  });
  await test.step('When they close it', async () => {
    await stage.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('Then the panels and the place’s pin come back', async () => {
    await expect(stage).toBeHidden();
    await expect(page.locator('.hud')).toBeVisible();
    await expect(globe).toHaveAttribute('data-pin-shown', 'true');
  });
  expect(problems).toEqual([]);
});

test('where the carbon lands on the sea, algae take it in', async ({ page }) => {
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const caption = page.getByTestId('shower-caption');
  await test.step('Given a place picked in the middle of the North Atlantic', async () => {
    await page.goto('./?t=1500-06-01T12:00&loc=45,-30&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
    await page.getByRole('button', { name: 'How is it made?' }).click();
  });
  await test.step('When they watch a cosmic ray make carbon-14 there', async () => {
    await page
      .getByRole('dialog', { name: 'How is carbon-14 made?' })
      .getByRole('button', { name: 'Watch a cosmic ray make carbon-14' })
      .click();
  });
  await test.step('Then it lands on water, and algae take it in, the sea’s age said', async () => {
    await expect(globe).toHaveAttribute('data-shower-ground', 'water', { timeout: 20_000 });
    // Stepped to the end rather than played out, for slow runners.
    const stage = page.getByRole('region', { name: 'How carbon-14 is made, step by step' });
    const pause = stage.getByRole('button', { name: 'Pause', exact: true });
    if (await pause.isVisible()) await pause.click();
    for (let tries = 0; tries < 6; tries += 1) {
      if ((await globe.getAttribute('data-shower-step')) === 'plant') break;
      await stage.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(200);
    }
    await expect(caption).toContainText('Algae in the sea take it in');
    await expect(caption).toContainText('400–600 radiocarbon years older');
    // In 3D, a single-celled alga under the sea's surface.
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-chapter', 'plant', { timeout: 20_000 });
    await expect(story.getByRole('list', { name: 'Into the alga' })).toContainText('no stomata');
    await expect(story).toContainText('an alga: one cell');
  });
  expect(problems).toEqual([]);
});

test('with reduced motion, each step waits for the reader, its picture complete', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const stage = page.getByRole('region', { name: 'How carbon-14 is made, step by step' });
  await test.step('Given a reader who asks for reduced motion', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./?t=1500-06-01T12:00&loc=48,10&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
    await page.getByRole('button', { name: 'How is it made?' }).click();
  });
  await test.step('When they watch a cosmic ray make carbon-14', async () => {
    await page
      .getByRole('dialog', { name: 'How is carbon-14 made?' })
      .getByRole('button', { name: 'Watch a cosmic ray make carbon-14' })
      .click();
  });
  await test.step('Then the first step waits, with no play button', async () => {
    await expect(globe).toHaveAttribute('data-shower-playing', 'false', { timeout: 20_000 });
    await expect(globe).toHaveAttribute('data-shower-step', 'rays');
    await expect(stage.getByRole('button', { name: /^(Play|Pause)$/ })).toBeHidden();
  });
  await test.step('When they go on with the arrow key', async () => {
    await page.keyboard.press('ArrowRight');
  });
  await test.step('Then the next step shows, still waiting', async () => {
    await expect(globe).toHaveAttribute('data-shower-step', 'shower');
    await expect(globe).toHaveAttribute('data-shower-playing', 'false');
  });
  await test.step('And the shower is drawn in 3D, complete, its front at the ground', async () => {
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-chapter', 'shower', { timeout: 20_000 });
    await expect(story).toHaveAttribute('data-playing', 'false');
    await expect(story).toHaveAttribute('data-microseconds', '57');
    const shower = story.getByRole('list', { name: 'An air shower' });
    await expect(shower).toContainText('First collision about 17 km up');
    await expect(shower).toContainText('some 57 µs later');
    await expect(shower).toContainText('Most carbon-14 is made 9–15 km up');
    await expect(shower).toContainText('Muons μ');
  });
  await test.step('When they go on to the step where carbon-14 is made', async () => {
    await page.keyboard.press('ArrowRight');
  });
  await test.step('Then the nucleus is drawn in 3D, nitrogen-14 become carbon-14', async () => {
    await expect(globe).toHaveAttribute('data-shower-step', 'capture');
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-chapter', 'capture', { timeout: 20_000 });
    // Complete: the proton gone, 6 protons and 8 neutrons left.
    await expect(story).toHaveAttribute('data-protons', '6');
    await expect(story).toHaveAttribute('data-neutrons', '8');
    await expect(story).toContainText('carbon-14: 6 protons, 8 neutrons');
    const reaction = story.getByRole('list', { name: 'The reaction' });
    await expect(reaction).toContainText('n + ¹⁴N → ¹⁴C + p');
    await expect(reaction).toContainText('Nitrogen-14: 7 protons, 7 neutrons');
    await expect(reaction).toContainText('It gives off 0.63 MeV');
    // Drawn in 3D, so not flat on the stage too.
    await expect(stage.getByTestId('reaction-diagram')).toHaveCount(0);
  });
  await test.step('And on to the plant, each step in 3D, complete', async () => {
    const story = page.getByTestId('story-3d');
    await page.keyboard.press('ArrowRight');
    await expect(globe).toHaveAttribute('data-shower-step', 'dioxide');
    await expect(story).toHaveAttribute('data-chapter', 'dioxide', { timeout: 20_000 });
    await expect(story).toHaveAttribute('data-molecule', 'CO2');
    await expect(story.getByRole('list', { name: 'Carbon dioxide made' })).toContainText(
      '¹⁴C + O → ¹⁴CO: carbon monoxide first',
    );
    await page.keyboard.press('ArrowRight');
    await expect(story).toHaveAttribute('data-chapter', 'fall');
    await expect(story.getByRole('list', { name: 'Through the air' })).toContainText(
      '7,808 nitrogen',
    );
    await page.keyboard.press('ArrowRight');
    await expect(story).toHaveAttribute('data-chapter', 'plant');
    await expect(story).toHaveAttribute('data-taken', 'true');
    // Over northern Italy, on land: a leaf, through a stoma.
    await expect(story.getByRole('list', { name: 'Into the leaf' })).toContainText('stoma');
    // Every step drawn in 3D, nothing flat on the stage.
    await expect(stage.getByTestId('reaction-diagram')).toHaveCount(0);
  });
  await test.step('When they press Escape, it closes', async () => {
    await page.keyboard.press('Escape');
    await expect(stage).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('started from the Sun, the story follows a photon from fusion to Earth', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const caption = page.getByTestId('shower-caption');
  const stage = page.getByRole('region', { name: 'How carbon-14 is made, step by step' });
  const next = async (step: string) => {
    await stage.getByRole('button', { name: 'Next' }).click();
    await expect(globe).toHaveAttribute('data-shower-step', step, { timeout: 20_000 });
  };
  /** Pause, and step back to `step` should a slow runner have played on past it first. */
  const pauseOn = async (step: string) => {
    await stage.getByRole('button', { name: 'Pause', exact: true }).click();
    for (let tries = 0; tries < 6; tries += 1) {
      if ((await globe.getAttribute('data-shower-step')) === step) break;
      await stage.getByRole('button', { name: 'Back' }).click();
      await page.waitForTimeout(200);
    }
    await expect(globe).toHaveAttribute('data-shower-step', step);
  };
  await test.step('Given the card on how carbon-14 is made', async () => {
    await page.goto('./?t=1500-06-01T12:00&loc=48,10&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
    await page.getByRole('button', { name: 'How is it made?' }).click();
  });
  await test.step('When they start from the Sun, and pause to read', async () => {
    await page
      .getByRole('dialog', { name: 'How is carbon-14 made?' })
      .getByRole('button', { name: 'Start from the Sun' })
      .click();
    await expect(globe).toHaveAttribute('data-shower-step', /./, { timeout: 30_000 });
    await stage.getByRole('button', { name: 'Replay' }).click();
    await stage.getByRole('button', { name: 'Pause', exact: true }).click();
    // A slow runner may have moved on before the pause: step back to the first step.
    for (let tries = 0; tries < 6; tries += 1) {
      if ((await globe.getAttribute('data-shower-step')) === 'fusion') break;
      await stage.getByRole('button', { name: 'Back' }).click();
      await page.waitForTimeout(200);
    }
  });
  await test.step('Then the Sun shows in 3D, cut open, its core fusing, the chain written out', async () => {
    await expect(globe).toHaveAttribute('data-shower-step', 'fusion');
    await expect(globe).toHaveAttribute('data-focus', 'sun', { timeout: 20_000 });
    await expect(stage.locator('.shower-dots li')).toHaveCount(9);
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-chapter', 'fusion', { timeout: 20_000 });
    await expect(story).toHaveAttribute('data-rendered', 'true', { timeout: 20_000 });
    const chain = story.getByRole('list', { name: 'The proton–proton chain' });
    await expect(chain).toContainText('¹H + ¹H → ²H + e⁺ + ν');
    await expect(chain).toContainText('two gamma rays of 0.511 MeV');
    await expect(chain).toContainText('26.7 MeV');
    // Drawn in 3D, so not flat on the stage too.
    await expect(stage.getByTestId('sun-diagram')).toHaveCount(0);
  });
  await test.step('And, paused, the reader can turn it', async () => {
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-playing', 'false');
    const box = await story.boundingBox();
    if (box === null) throw new Error('no story');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 4, { steps: 8 });
    await page.mouse.up();
    await expect(globe).toHaveAttribute('data-shower-step', 'fusion');
    await expect(story).toHaveAttribute('data-playing', 'false');
  });
  await test.step('And its light walks out over some 170,000 years, in 3D, the years counting', async () => {
    await next('escape');
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-chapter', 'escape');
    await expect(caption).toContainText('Mitalas & Sills 1992');
    const way = story.getByRole('list', { name: 'A photon’s way out' });
    await expect(way).toContainText('X-rays, about 1 keV');
    await expect(way).toContainText('about 170,000 years across the radiative zone');
    await expect(way).toContainText('visible light, about 2.5 eV');
    await expect(story.getByRole('list', { name: 'The proton–proton chain' })).toBeHidden();
    await expect(stage.getByTestId('sun-diagram')).toHaveCount(0);
    // Paused, it stays where it is; played, the walk goes on and the years with it.
    const years = Number(await story.getAttribute('data-years'));
    await stage.getByRole('button', { name: 'Play', exact: true }).click();
    await expect
      .poll(async () => Number(await story.getAttribute('data-years')))
      .toBeGreaterThan(years);
    await pauseOn('escape');
  });
  await test.step('Then its red light crosses to Earth in 3D, the clock saying 8 min 19 s', async () => {
    await next('journey');
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-chapter', 'journey');
    const way = story.getByRole('list', { name: 'Sunlight’s way to Earth' });
    await expect(way).toContainText('8 min 19 s');
    await expect(way).toContainText('red light: 680 nm, 441 THz, 1.8 eV');
    await expect(way).toContainText('215 Sun radii away');
    await expect(stage.getByTestId('sun-diagram')).toHaveCount(0);
    // Played, the clock runs on toward 8 min 19 s (499 s).
    const clock = Number(await story.getAttribute('data-clock'));
    await stage.getByRole('button', { name: 'Play', exact: true }).click();
    await expect
      .poll(async () => Number(await story.getAttribute('data-clock')))
      .toBeGreaterThan(clock);
    await pauseOn('journey');
  });
  await test.step('Then the shower begins on Earth', async () => {
    // (The leaf's caption, where the red photon arrives, is in the unit tests: stepping through
    // the whole shower here would outlast the scenario on a slow runner.)
    await next('rays');
    await expect(globe).toHaveAttribute('data-focus', 'earth', { timeout: 20_000 });
    await expect(caption).toContainText('Cosmic rays');
    // The Sun's scene gives way to the air's.
    const story = page.getByTestId('story-3d');
    await expect(story).toHaveAttribute('data-chapter', 'rays', { timeout: 20_000 });
    await expect(story.getByRole('list', { name: 'Sunlight’s way to Earth' })).toHaveCount(0);
  });
  await test.step('When they close it, Earth stays in view', async () => {
    await stage.getByRole('button', { name: 'Close' }).click();
    await expect(stage).toBeHidden();
    await expect(globe).toHaveAttribute('data-focus', 'earth');
  });
  expect(problems).toEqual([]);
});

test('with the Laschamp field, the equator’s ray reaches the air too', async ({ page }) => {
  test.slow();
  const problems = collectProblems(page);
  const caption = page.getByTestId('shower-caption');
  const dialog = page.getByRole('dialog', { name: 'How is carbon-14 made?' });
  const stage = page.getByRole('region', { name: 'How carbon-14 is made, step by step' });
  await test.step('Given the card on how carbon-14 is made', async () => {
    await page.goto('./?t=1500-06-01T12:00&loc=48,10&layers=carbonMade');
    await globeRendered(page);
    await openLayers(page);
    await page.getByRole('button', { name: 'How is it made?' }).click();
  });
  await test.step('When they pick the Laschamp excursion and watch', async () => {
    await dialog.getByRole('radio', { name: 'Laschamp excursion, 41,000 years ago' }).check();
    await dialog.getByRole('button', { name: 'Watch a cosmic ray make carbon-14' }).click();
  });
  await test.step('Then the rays reach the air at the equator too', async () => {
    await expect(caption).toContainText('reach the air at the equator too', { timeout: 20_000 });
    await stage.getByRole('button', { name: 'Close' }).click();
    await expect(stage).toBeHidden();
  });
  expect(problems).toEqual([]);
});
