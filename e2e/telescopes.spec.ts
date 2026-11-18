/**
 * Feature: The space telescopes. A telescope's card shows famous pictures it took (#798), served
 * by the site itself, each opening larger with what it shows, whose it is and its licence. The
 * Hubble Space Telescope goes round Earth (#795), drawn when Earth is close up.
 */

import { collectProblems, expect, test } from './support';

test('Webb’s card shows the pictures it took, and one opens larger with its credit and licence', async ({
  page,
}) => {
  // A data file and a planet theory: slow on a phone drawn in software.
  test.slow();
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  const view = page.getByTestId('picture-view');
  const asked: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/pictures/')) asked.push(new URL(request.url()).pathname);
  });
  await test.step('Given Webb followed, a year after it reached L2, from far enough that the journey’s bar does not cover it', async () => {
    await page.goto(
      './?focus=earth&cam=89,0,1200&layers=spacecraft&mission=d01093&t=2023-01-01T00:00Z',
    );
    await expect(
      page.getByRole('button', { name: 'James Webb Space Telescope', exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    // Nothing of the pictures is asked for until a card opens.
    expect(asked).toEqual([]);
  });
  await test.step('When they tap its name, Then its card lists eight pictures, from ESA/Webb under CC BY 4.0', async () => {
    await page.getByRole('button', { name: 'James Webb Space Telescope', exact: true }).click();
    const strip = card.getByRole('region', { name: 'Pictures it took' });
    await expect(strip.getByRole('button')).toHaveCount(8);
    await expect(strip).toContainText('ESA/Webb, CC BY 4.0.');
    const first = strip.getByRole('button', { name: 'Webb’s First Deep Field: see it larger' });
    await expect(first.locator('img')).toHaveJSProperty('complete', true);
    expect(await first.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(
      192,
    );
    expect(asked.every((path) => path.endsWith('-thumb.webp'))).toBe(true);
  });
  await test.step('When they open the Pillars of Creation, Then it is shown larger with its credit, its licence and its page', async () => {
    await card.getByRole('button', { name: 'The Pillars of Creation: see it larger' }).click();
    await expect(view).toBeVisible();
    await expect(view.getByRole('heading')).toHaveText('The Pillars of Creation');
    await expect(view).toContainText('Eagle Nebula');
    await expect(view).toContainText('Picture: NASA, ESA, CSA, STScI; J. DePasquale');
    await expect(view.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/',
    );
    await expect(view.getByRole('link', { name: 'ESA/Webb' })).toHaveAttribute(
      'href',
      'https://esawebb.org/images/weic2216a/',
    );
    await expect
      .poll(() => view.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(1280);
  });
  await test.step('When they step on and press Escape, Then the next is shown, the picture closes and the card stays', async () => {
    await view.getByRole('button', { name: 'Next' }).click();
    await expect(view.getByRole('heading')).toHaveText('The heart of the Phantom Galaxy');
    await page.keyboard.press('Escape');
    await expect(view).toBeHidden();
    await expect(card).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('Webb’s card shows it in 3D, fetched only then, drawn by WebGL and let go when the card closes @acceptance', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  const model = card.getByRole('img', { name: /James Webb Space Telescope in 3D/ });
  const fetched: string[] = [];
  page.on('request', (request) => {
    if (/\/(webbModel|modelView)-/.test(request.url())) fetched.push(request.url());
  });
  await test.step('Given Webb followed, Then nothing of its model has been fetched', async () => {
    await page.goto(
      './?focus=earth&cam=89,0,1200&layers=spacecraft&mission=d01093&t=2023-01-01T00:00Z',
    );
    await expect(
      page.getByRole('button', { name: 'James Webb Space Telescope', exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    expect(fetched).toEqual([]);
  });
  await test.step('When they open its card, Then the model is drawn in WebGL with a word on how it was made', async () => {
    await page.getByRole('button', { name: 'James Webb Space Telescope', exact: true }).click();
    await expect(model).toHaveAttribute('data-drawn', 'true', { timeout: 30_000 });
    expect(fetched.length).toBeGreaterThan(0);
    const canvas = model.getByTestId('craft-model');
    expect(
      await canvas.evaluate((element: HTMLCanvasElement) => element.getContext('webgl2') !== null),
    ).toBe(true);
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(150);
    await expect(card).toContainText('built here from NASA’s published sizes, at true scale');
  });
  await test.step('When they drag it, Then it turns without a problem', async () => {
    const box = await model.boundingBox();
    if (box === null) throw new Error('the model has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(card).toBeVisible();
  });
  await test.step('When the card closes, Then its canvas is gone', async () => {
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect(page.getByTestId('craft-model')).toHaveCount(0);
  });
  expect(problems).toEqual([]);
});

test('Webb’s card goes to it: the camera orbits its model at L2, the link keeps it, and Back to Earth leaves it (#796) @acceptance', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const card = page.getByTestId('marker-card');
  const webb = page.getByRole('button', { name: 'James Webb Space Telescope', exact: true });
  await test.step('Given Webb followed, a year after it reached L2', async () => {
    await page.goto(
      './?focus=earth&cam=89,0,1200&layers=spacecraft&mission=d01093&t=2023-01-01T00:00Z',
    );
    await expect(webb).toBeVisible({ timeout: 30_000 });
  });
  await test.step('When they open its card and go to it, Then the camera orbits Webb, drawn as its model', async () => {
    await webb.click();
    await card.getByRole('button', { name: 'Go to it' }).click();
    await expect(card).toBeHidden();
    await expect(globe).toHaveAttribute('data-framed', 'craft:d01093', { timeout: 30_000 });
    await expect(globe).toHaveAttribute('data-craft-model', 'd01093', { timeout: 30_000 });
    await expect(page).toHaveURL(/[?&]craft=d01093/);
    // Four of its radii out: some 42 m from a craft 21 m long.
    await expect(globe).toHaveAttribute('data-distance', '4.00');
    // Close up its point and name give way to the model.
    await expect(webb).toHaveCount(0);
    // The rail offers only the way back: no distance, no stops.
    await expect(page.getByRole('button', { name: 'Back to Earth' })).toBeVisible();
    await expect(page.getByTestId('zoom-readout')).toBeHidden();
  });
  await test.step('When the page is loaded again from its link, Then it opens on Webb', async () => {
    await page.reload();
    await expect(globe).toHaveAttribute('data-framed', 'craft:d01093', { timeout: 30_000 });
    await expect(globe).toHaveAttribute('data-craft-model', 'd01093', { timeout: 30_000 });
  });
  await test.step('When they go back to Earth, Then the craft is left and Earth is in view', async () => {
    await page.getByRole('button', { name: 'Back to Earth' }).click();
    await expect(globe).toHaveAttribute('data-framed', 'earth', { timeout: 30_000 });
    await expect(page).not.toHaveURL(/craft=/);
    await expect(globe).not.toHaveAttribute('data-craft-model', /.*/);
  });
  expect(problems).toEqual([]);
});

test('Hubble goes round Earth close up, its card saying how its path is drawn, showing its pictures and going to it', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const hubble = page.getByRole('button', { name: 'Hubble Space Telescope', exact: true });
  await test.step('Given Earth close up in 2009 with the spacecraft on, Then Hubble is named about it', async () => {
    await page.goto('./?focus=earth&cam=-30,60,12&layers=spacecraft&t=2009-05-20T12:00Z');
    await expect(hubble).toBeVisible({ timeout: 30_000 });
  });
  await test.step('When they tap its name, Then its card gives its orbit and says the path is approximate', async () => {
    await hubble.click();
    const card = page.getByTestId('marker-card');
    await expect(card).toContainText('24 April 1990');
    await expect(card).toContainText('611 to 620 km up, tilted 28.47° to the equator');
    await expect(card).toContainText('Approximate: the ellipse of its lowest and highest points');
  });
  await test.step('And its card lists eight pictures it took, from ESA/Hubble under CC BY 4.0, one opening larger with its credit', async () => {
    const card = page.getByTestId('marker-card');
    const view = page.getByTestId('picture-view');
    const strip = card.getByRole('region', { name: 'Pictures it took' });
    await expect(strip.getByRole('button')).toHaveCount(8);
    await expect(strip).toContainText('ESA/Hubble, CC BY 4.0.');
    await card.getByRole('button', { name: 'The Crab Nebula: see it larger' }).click();
    await expect(view.getByRole('heading')).toHaveText('The Crab Nebula');
    await expect(view).toContainText('recorded in 1054');
    await expect(view).toContainText('Picture: NASA, ESA and Allison Loll/Jeff Hester');
    await expect(view.getByRole('link', { name: 'ESA/Hubble' })).toHaveAttribute(
      'href',
      'https://esahubble.org/images/heic0515a/',
    );
    await expect
      .poll(() => view.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(1280);
    await page.keyboard.press('Escape');
    await expect(view).toBeHidden();
  });
  await test.step('When they go to it from its card, Then the camera orbits its model, 615 km over Earth (#796)', async () => {
    const card = page.getByTestId('marker-card');
    await expect(card).toContainText('solar arrays square to the Sun');
    await card.getByRole('button', { name: 'Go to it' }).click();
    const globe = page.getByTestId('globe');
    await expect(globe).toHaveAttribute('data-framed', 'craft:s20580', { timeout: 30_000 });
    await expect(globe).toHaveAttribute('data-craft-model', 's20580', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Back to Earth' }).click();
    await expect(globe).toHaveAttribute('data-framed', 'earth', { timeout: 30_000 });
  });
  await test.step('When the view is five years before it flew, Then it is not there', async () => {
    await page.goto('./?focus=earth&cam=-30,60,12&layers=spacecraft&t=1985-05-20T12:00Z');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-craft', /\d+/, {
      timeout: 30_000,
    });
    await expect(hubble).toHaveCount(0);
  });
  expect(problems).toEqual([]);
});

test('the Telescopes layer shows the great telescopes on the ground from first light, each with its card (#848) @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  const hale = page.getByRole('button', { name: 'Hale Telescope: details' });
  await test.step('Given the layer on in 1950, over California', async () => {
    await page.goto('./?layers=telescopes&t=1950-06-01T12:00Z&cam=34,-117,2.2');
    await expect(hale).toBeAttached({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Arecibo Telescope/ })).toHaveCount(0);
  });
  await test.step('When they tap the Hale Telescope, Then its card says what it is', async () => {
    await hale.click();
    await expect(card.getByRole('heading')).toHaveText('Hale Telescope');
    await expect(card).toContainText('First light');
    await card.getByRole('button', { name: 'Close' }).click();
  });
  expect(problems).toEqual([]);
});

// One view a test: leaving a view while it still loads would cancel its requests (#852).
test('the Telescopes layer takes away those that closed and marks those being built (#848) @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await test.step('Given the layer on in 2026, over Chile, Then Arecibo has gone and the ELT is being built', async () => {
    await page.goto('./?layers=telescopes&t=2026-01-01T12:00Z&cam=-24,-70,2.2');
    await expect(
      page.getByRole('button', { name: 'Extremely Large Telescope (being built): details' }),
    ).toBeAttached({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Arecibo Telescope/ })).toHaveCount(0);
  });
  expect(problems).toEqual([]);
});

test('with the Telescopes layer, the space telescopes go round Earth, and no other craft (#849) @acceptance', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const hubble = page.getByRole('button', { name: 'Hubble Space Telescope', exact: true });
  const chandra = page.locator('[data-pick="craft:S25867"]');
  await test.step('Given Earth in 2009 with only the Telescopes layer on, Then Hubble and Chandra are named about it', async () => {
    await page.goto('./?focus=earth&cam=-30,60,12&layers=telescopes&t=2009-05-20T12:00Z');
    await expect(hubble).toBeVisible({ timeout: 30_000 });
    await expect(chandra).toBeAttached();
    // No craft but telescopes: Voyager 1 is not among them.
    await expect(page.locator('[data-pick="craft:D00578"]')).toHaveCount(0);
    await expect(page.locator('[data-pick^="craft:"]')).toHaveCount(9);
  });
  await test.step('When ten minutes pass, Then Hubble has gone on round its orbit', async () => {
    const before = await hubble.boundingBox();
    await page.goto('./?focus=earth&cam=-30,60,12&layers=telescopes&t=2009-05-20T12:10Z');
    await expect(hubble).toBeVisible({ timeout: 30_000 });
    const after = await hubble.boundingBox();
    const moved = Math.hypot(
      (after?.x ?? 0) - (before?.x ?? 0),
      (after?.y ?? 0) - (before?.y ?? 0),
    );
    expect(moved).toBeGreaterThan(20);
  });
  expect(problems).toEqual([]);
});

test('the Telescopes list finds the most significant, filters them, and goes to one (#850) @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const list = page.getByRole('dialog', { name: 'Telescopes' });
  await test.step('Given the Telescopes layer on, When they open its list from its chip', async () => {
    await page.goto('./?layers=telescopes&t=2026-01-01T12:00Z');
    const open = page.getByRole('button', { name: 'Telescopes: the list' });
    // On a phone, the chips are at the top of the Layers sheet.
    if (!(await open.first().isVisible()))
      await page
        .getByRole('button', { name: /Layers/ })
        .first()
        .click();
    await open.filter({ visible: true }).first().click();
    await expect(list).toBeVisible();
    await expect(list.getByTestId('telescope-list').getByRole('button').first()).toContainText(
      'James Webb Space Telescope',
    );
  });
  await test.step('When they keep only radio telescopes on Earth, Then Arecibo is among them and Webb is not', async () => {
    await list.getByRole('button', { name: 'On Earth' }).click();
    await list.getByRole('button', { name: 'Radio', exact: true }).click();
    await expect(list.getByRole('button', { name: /Arecibo Telescope/ })).toBeVisible();
    await expect(list.getByRole('button', { name: /James Webb/ })).toHaveCount(0);
  });
  await test.step('When they tap Arecibo, Then the view goes to 1963 with its card open, the list shut', async () => {
    await list.getByRole('button', { name: /Arecibo Telescope/ }).click();
    await expect(list).toBeHidden();
    await expect(page.getByTestId('marker-card').getByRole('heading')).toHaveText(
      'Arecibo Telescope',
    );
    await expect(page).toHaveURL(/t=1963-/);
    await expect(page).not.toHaveURL(/list=/);
  });
  await test.step('Then its card shows its model, built from its published sizes (#859)', async () => {
    const card = page.getByTestId('marker-card');
    await expect(card.getByRole('img', { name: /Arecibo telescope in 3D/ })).toBeVisible();
    await expect(card).toContainText('305 m bowl, 51 m deep');
  });
  expect(problems).toEqual([]);
});

test('the great telescopes are found from Explore and from search (#851) @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const list = page.getByRole('dialog', { name: 'Telescopes' });
  await test.step('When they open Explore and pick Great telescopes under Space, Then the layer is on and its list open', async () => {
    await page.goto('./?t=2026-01-01T12:00Z&cam=0,0,3');
    await page.getByRole('button', { name: 'Explore' }).click();
    const panel = page.getByRole('dialog', { name: 'Explore' });
    await panel.getByRole('button', { name: 'Great telescopes', exact: true }).click();
    await expect(list).toBeVisible();
    await expect(page).toHaveURL(/layers=[^&]*telescopes/);
    await list.getByRole('button', { name: 'Close' }).click();
    await expect(list).toBeHidden();
  });
  await test.step('When they search for Keck, Then the telescope is found, as a telescope', async () => {
    const results = page.getByRole('dialog', { name: 'Search' });
    await page.getByRole('button', { name: 'Search the texts' }).click();
    await results.getByRole('searchbox').fill('Keck');
    await expect(results).toContainText('Keck Observatory, since 1990');
    await expect(results).toContainText('Telescope');
  });
  expect(problems).toEqual([]);
});
