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

test('Hubble goes round Earth close up, its card saying how its path is drawn and showing its pictures', async ({
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
    await expect(card).toContainText('Approximate: a circle at that height and tilt');
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
    await page.keyboard.press('Escape');
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
