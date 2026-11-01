import { expect, test, type Page } from '@playwright/test';

import deltaTTable from '../public/data/delta-t.json' with { type: 'json' };
import { subsolarPoint } from '../src/astro/sun';
import { parseViewState } from '../src/state/url';
import { momentJulianDay } from '../src/state/viewState';
import { DeltaT } from '../src/time/deltaT';

// Commit SHA the deployment is expected to serve. Empty or unset skips the release check.
const expectedVersion = process.env['EXPECTED_VERSION'] ?? '';

// The 621 BCE lunar eclipse from Babylon, as someone might share it.
const SHARED_LINK = '?t=-620-04-22T07:20&loc=32.5422,44.4209&cam=30,40,3&sel=lunar:-0620-04-22';

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      problems.push(`HTTP ${String(response.status())}: ${response.url()}`);
    }
  });
  return problems;
}

async function globeRendered(page: Page): Promise<void> {
  await expect(page.getByTestId('globe')).toHaveAttribute('data-rendered', 'true');
}

test('loads the globe without errors or failed requests', async ({ page }) => {
  const problems = collectProblems(page);
  const response = await page.goto('./');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('histeclipse');
  await expect(page.getByRole('heading', { level: 1, name: 'histeclipse' })).toBeVisible();
  await globeRendered(page);
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
});

test('draws the Earth, not an empty canvas', async ({ page }) => {
  await page.goto('./');
  await globeRendered(page);
  // A screenshot captures what is on screen without reading the WebGL buffer back. An empty
  // dark canvas compresses to a few KB of PNG; a textured, lit globe to hundreds of KB.
  const png = await page.locator('canvas').screenshot();
  expect(png.byteLength).toBeGreaterThan(60_000);
});

test('a shared link reproduces the view it describes', async ({ page }) => {
  await page.goto(SHARED_LINK);
  await globeRendered(page);

  await expect(page.locator('.hud-date')).toHaveText('22 April 621 BCE');
  await expect(page.locator('.hud-time')).toHaveText('07:20 UT');
  await expect(page.locator('.hud-detail')).toContainText('Julian calendar');
  await expect(page.locator('.hud-detail')).toContainText('ΔT 5 h 13 min ± 8 min');

  // The Sun on the globe is where the tested astronomy modules say it should be.
  const { state } = parseViewState(SHARED_LINK, new Date());
  const deltaT = new DeltaT(deltaTTable);
  const universal = momentJulianDay(state.time);
  const sun = subsolarPoint(universal, deltaT.terrestrialTime(universal));
  await expect(page.locator('#app')).toHaveAttribute(
    'data-subsolar',
    `${sun.latitude.toFixed(3)},${sun.longitude.toFixed(3)}`,
  );
});

test('rewrites a shared link into its full, explicit form', async ({ page }) => {
  await page.goto(SHARED_LINK);
  await globeRendered(page);
  await expect(page).toHaveURL(
    /\?v=1&mode=globe&t=-0620-04-22T07:20Z&cal=julian&loc=32\.5422,44\.4209&cam=30\.0000,40\.0000,3\.00&layers=lunar,solar,terminator&sel=lunar:-0620-04-22$/,
  );
});

test('dragging the globe updates the camera in the URL', async ({ page }) => {
  await page.goto('./?cam=0,0,3');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  const box = await globe.boundingBox();
  if (box === null) throw new Error('globe has no size');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x - 120, center.y + 60, { steps: 8 });
  await page.mouse.up();
  await expect(page).not.toHaveURL(/cam=0\.0000,0\.0000,3\.00/);
  await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},3\.00/);
});

test('dragging an attached view, even while an eclipse plays, hands over to orbiting', async ({
  page,
}) => {
  await page.goto('./?t=2025-03-14T05:00&sel=lunar:2025-03-14&view=moon-from-earth');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-space', 'moon');
  await page.getByRole('button', { name: 'Play' }).click();
  const box = await page.getByTestId('globe').boundingBox();
  if (box === null) throw new Error('globe has no size');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 3 };
  const drag = async (): Promise<void> => {
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x - 150, center.y + 40, { steps: 10 });
    await page.mouse.up();
  };
  // The first drag releases the view and flies to the Moon it was looking at.
  await drag();
  await expect(page).toHaveURL(/focus=moon/);
  await expect(page).not.toHaveURL(/view=/);
  await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},4\.00/);
  const landed = new URL(page.url()).searchParams.get('cam');
  // Once there, dragging turns the Moon while time keeps moving.
  await drag();
  await expect.poll(() => new URL(page.url()).searchParams.get('cam')).not.toBe(landed);
});

test('a one-finger swipe rotates the globe on touch screens', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile', 'touch gestures are tested on the phone profile');
  await page.goto('./?cam=0,0,3');
  await globeRendered(page);
  const box = await page.getByTestId('globe').boundingBox();
  if (box === null) throw new Error('globe has no size');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  // Real touch events through the DevTools protocol, not an emulated mouse drag.
  const cdp = await context.newCDPSession(page);
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: { x: number; y: number }[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x, y }]);
  for (let step = 1; step <= 8; step += 1) {
    await touch('touchMove', [{ x: x - step * 15, y }]);
  }
  await touch('touchEnd', []);
  await expect(page).not.toHaveURL(/cam=0\.0000,0\.0000,3\.00/);
  await expect(page).toHaveURL(/cam=0\.0000,-?\d+\.\d{4},3\.00|cam=-?0\.\d{4},-?\d+\.\d{4},3\.00/);
});

test('the date panel stays readable on a phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout');
  await page.goto(SHARED_LINK);
  await globeRendered(page);
  const panel = await page.locator('.hud').boundingBox();
  const viewport = page.viewportSize();
  if (panel === null || viewport === null) throw new Error('missing layout');
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
  // The panel must leave most of the screen to the globe.
  expect(panel.height).toBeLessThan(viewport.height * 0.25);
});

test('explains parts of a link it could not use', async ({ page }) => {
  await page.goto('./?t=yesterday');
  await globeRendered(page);
  await expect(page.getByRole('status')).toContainText('Ignored t="yesterday"');
});

test('picking an eclipse jumps to it and puts it in the link', async ({ page }) => {
  await page.goto('./?t=-620-01-01T12:00');
  await globeRendered(page);
  await page.getByRole('button', { name: /22 Apr/ }).click();

  await expect(page).toHaveURL(/t=-0620-04-22T02:08Z/);
  await expect(page).toHaveURL(/sel=lunar:-0620-04-22/);
  await expect(page.getByRole('button', { name: /22 Apr/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'Partial lunar eclipse' })).toBeVisible();
  await expect(page.getByTestId('globe')).toHaveAttribute('data-lunar-overlay', 'on');
});

test('a link to an eclipse restores it, with visibility from the chosen place', async ({
  page,
}) => {
  await page.goto('./?t=-620-04-22T02:08&sel=lunar:-0620-04-22&loc=32.5422,44.4209');
  await globeRendered(page);
  await expect(page.getByRole('heading', { name: 'Partial lunar eclipse' })).toBeVisible();
  await expect(page.locator('.eclipse-observer')).toHaveText(
    '32.5°N 44.4°E: The Moon was above the horizon here.',
  );
  await expect(page.getByTestId('globe')).toHaveAttribute('data-lunar-overlay', 'on');
});

test('the Moon-up region follows time and shows only during the eclipse', async ({ page }) => {
  await page.goto('./?t=-620-04-22T02:08&sel=lunar:-0620-04-22');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-lunar-overlay', 'on');
  await expect(page.locator('.eclipse-phase')).toContainText('partial phase');

  const slider = page.getByRole('slider', { name: 'Time relative to greatest eclipse' });
  await slider.fill('80');
  await expect(page.locator('.eclipse-phase')).toContainText('penumbral phase');
  await expect(globe).toHaveAttribute('data-lunar-overlay', 'on');

  // Three hours after greatest eclipse the Moon has left Earth's shadow.
  await slider.fill('180');
  await expect(page.locator('.eclipse-phase')).toContainText('Not now');
  await expect(globe).toHaveAttribute('data-lunar-overlay', 'off');
});

test('a lunar eclipse shows the Moon crossing Earth’s shadow', async ({ page }) => {
  await page.goto('./?t=2025-03-14T06:59&sel=lunar:2025-03-14');
  await globeRendered(page);
  const moon = page.getByRole('img', { name: /Moon entirely inside Earth’s umbra/ });
  await expect(moon).toBeVisible();
  await expect(moon).toHaveAttribute('data-phase', 'total');

  const slider = page.getByRole('slider', { name: 'Time relative to greatest eclipse' });
  await slider.fill('-50');
  await expect(page.getByRole('img', { name: /Moon partly inside/ })).toHaveAttribute(
    'data-phase',
    'partial',
  );
  // Open the background, scrub, and it stays open.
  await page.getByText('More about this eclipse').click();
  await slider.fill('-40');
  await expect(page.locator('.eclipse-more')).toHaveAttribute('open', '');
});

test('solar eclipses have no Moon-in-shadow view', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:30&sel=solar:2024-04-08');
  await globeRendered(page);
  await expect(page.locator('.moon-view')).toHaveCount(0);
});

test('the eclipse card keeps background one tap away', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:30&sel=solar:2024-04-08');
  await globeRendered(page);
  const more = page.getByText('More about this eclipse');
  await expect(more).toBeVisible();
  await expect(page.locator('.famous-card-summary')).toBeHidden();
  await more.click();
  await expect(page.locator('.famous-card-summary')).toBeVisible();
});

test('hiding the lunar layer hides the overlay but keeps the selection', async ({ page }) => {
  await page.goto('./?t=-620-04-22T02:08&sel=lunar:-0620-04-22&layers=terminator');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-lunar-overlay', 'off');
  await expect(page).toHaveURL(/sel=lunar:-0620-04-22/);
});

test("stepping and typing years lists that year's eclipses", async ({ page }) => {
  await page.goto('./?t=2024-03-14T12:00');
  await globeRendered(page);
  const year = page.getByLabel('Year', { exact: true });
  const era = page.getByLabel('Era', { exact: true });
  await page.getByRole('button', { name: 'Next year' }).click();
  await expect(year).toHaveValue('2025');
  await expect(era).toHaveValue('CE');
  await expect(page).toHaveURL(/t=2025-03-14T12:00Z/);
  await expect(page.getByRole('button', { name: /14 Mar\s*Total/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /7 Sep\s*Total/ })).toBeVisible();

  // Picking the era keeps the number: 2025 CE becomes 2025 BCE.
  await year.fill('587');
  await era.selectOption('BCE');
  await expect(page).toHaveURL(/t=-0586-03-14T12:00Z&cal=julian/);
  await expect(year).toHaveValue('587');
  await expect(era).toHaveValue('BCE');

  // Only digits get into the box.
  await year.fill('');
  await year.pressSequentially('6a-2x1');
  await expect(year).toHaveValue('621');
  await year.press('Enter');
  await expect(page).toHaveURL(/t=-0620-03-14T12:00Z/);

  await year.fill('0');
  await year.press('Enter');
  await expect(year).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/t=-0620-03-14T12:00Z/);
});

test('controls are large enough to tap and stay on screen', async ({ page }) => {
  // With the empires layer on, so the "Seen from" row is measured too.
  await page.goto('./?t=2024-01-01T00:00&layers=lunar,solar,terminator,empires');
  await globeRendered(page);
  await expect(page.getByRole('button', { name: /8 Apr/ })).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('no viewport');
  await page.getByRole('button', { name: /8 Apr/ }).click();
  for (const control of await page
    .locator(
      '.timeline button, .timeline input, .timeline select, .scrubber button, .scrubber input',
    )
    .all()) {
    const box = await control.boundingBox();
    if (box === null) throw new Error('control without a box');
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
});

test('picking a solar eclipse draws its path and the Moon’s shadow', async ({ page }) => {
  await page.goto('./?t=2024-01-01T00:00&loc=32.7767,-96.797');
  await globeRendered(page);
  await page.getByRole('button', { name: /8 Apr\s*Total solar/ }).click();

  await expect(page).toHaveURL(/t=2024-04-08T18:17Z/);
  await expect(page).toHaveURL(/sel=solar:2024-04-08/);
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-solar-path', 'on');
  await expect(globe).toHaveAttribute('data-solar-shadow', 'on');
  await expect(page.getByRole('heading', { name: 'Total solar eclipse' })).toBeVisible();
  await expect(page.locator('.eclipse-observer')).toContainText('a total eclipse');
});

test('the scrubber moves through the eclipse and back into the link', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
  await globeRendered(page);
  const slider = page.getByRole('slider', { name: 'Time relative to greatest eclipse' });
  await expect(slider).toHaveValue('0');
  await slider.fill('25');
  await expect(page).toHaveURL(/t=2024-04-08T18:42Z/);
  await expect(page.locator('.hud-time')).toHaveText('18:42 UT');
  // Far from greatest eclipse the shadow has left Earth's day side, but the path stays.
  await slider.fill('-180');
  await expect(page).toHaveURL(/t=2024-04-08T15:17Z/);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-solar-path', 'on');
});

test('play animates the eclipse forward in time', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:00&sel=solar:2024-04-08');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page).not.toHaveURL(/t=2024-04-08T18:00Z/);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('famous eclipses: pick one and land on it with its history', async ({ page }) => {
  await page.goto('./?t=2024-01-01T00:00');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Famous eclipses' }).click();
  const dialog = page.getByRole('dialog', { name: 'Famous eclipses' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /The eclipse at Syracuse/ }).click();

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/sel=lunar:-0412-08-27/);
  await expect(page).toHaveURL(/loc=37\.0755,15\.2866/);
  await expect(page.locator('.famous-card-title')).toHaveText('The eclipse at Syracuse');
  await expect(page.locator('.famous-card-source')).toContainText('Thucydides');
  await expect(page.locator('.eclipse-observer')).toContainText('The Moon was above the horizon');
});

test('famous eclipses: debated entries say so, and the list closes', async ({ page }) => {
  await page.goto('./');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Famous eclipses' }).click();
  const dialog = page.getByRole('dialog', { name: 'Famous eclipses' });
  await expect(
    dialog.getByRole('button', { name: /The eclipse of Thales.*debated/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Famous eclipses' }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('a link to a famous eclipse shows its history', async ({ page }) => {
  await page.goto('./?t=-584-05-28T14:26&sel=solar:-0584-05-28');
  await globeRendered(page);
  await expect(page.locator('.famous-card-title')).toHaveText('The eclipse of Thales');
  await expect(page.locator('.famous-card-debate')).toContainText('Debated');
  await expect(page.getByTestId('globe')).toHaveAttribute('data-solar-path', 'on');
});

test('famous eclipse rows are large enough to tap', async ({ page }) => {
  await page.goto('./');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Famous eclipses' }).click();
  const dialog = page.getByRole('dialog', { name: 'Famous eclipses' });
  for (const control of await dialog.getByRole('button').all()) {
    const box = await control.boundingBox();
    if (box === null) continue;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('zooming out shows the Moon and Sun at their true places, labelled', async ({ page }) => {
  // 8 April 2024, mid-eclipse, seen from 150 Earth radii off to the side: the Moon is a dot
  // 60 radii towards the Sun, too small to see without its marker.
  await page.goto('./?t=2024-04-08T18:17&cam=0,-5,150');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-space', 'moon');
  const earth = page.locator('.space-marker[data-body="earth"]');
  const moon = page.locator('.space-marker[data-body="moon"]');
  await expect(earth).toHaveText('Earth');
  await expect(moon).toHaveText('Moon');
  await expect(moon).toHaveClass(/is-tiny/);
  // From beyond the Sun, all three line up behind one marker (with Mercury, that day, close
  // to the Sun in the sky).
  await page.goto('./?t=2024-04-08T18:17&cam=-7.6,85,60000');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-space', 'moon');
  await expect(page.getByTestId('globe')).toHaveAttribute('data-planets', 'on');
  await expect(earth).toHaveText('Earth, Moon, Sun and Mercury');
  await expect(moon).toBeHidden();
});

test('far out, the view stays put among the stars while Earth turns', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08&cam=0,0,60000');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-space', 'moon');
  await page.getByRole('slider', { name: 'Time relative to greatest eclipse' }).fill('60');
  await expect(page).toHaveURL(/t=2024-04-08T19:17Z/);
  // An hour later Earth has turned 15.04° east, so the camera sits 15.04° further west.
  await expect(page).toHaveURL(/cam=-?0\.00\d\d,-15\.0[3-5]\d\d,60000\.00/);
});

test('one click stands on Earth facing the Moon, and one click returns', async ({ page }) => {
  await page.goto('./?t=2025-11-05T12:00&cam=20,0,4.5');
  await globeRendered(page);
  const views = page.getByRole('group', { name: 'Viewpoint' });
  const moonFromEarth = views.getByRole('button', { name: 'Moon from Earth' });
  // Enabled once the Moon's orbit has loaded.
  await expect(moonFromEarth).toBeEnabled();
  await moonFromEarth.click();
  await expect(moonFromEarth).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('globe')).toHaveAttribute('data-view', 'moon-from-earth');
  await expect(page).toHaveURL(/&view=moon-from-earth&/);
  // The orbiting camera is kept, so going back lands where it was.
  await expect(page).toHaveURL(/cam=20\.0000,0\.0000,4\.50/);
  await views.getByRole('button', { name: 'Orbit' }).click();
  await expect(page.getByTestId('globe')).toHaveAttribute('data-view', 'free');
  await expect(page).not.toHaveURL(/view=/);
});

test('a link can stand on the Moon looking at Earth', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08&view=earth-from-moon');
  await globeRendered(page);
  await expect(
    page.getByRole('group', { name: 'Viewpoint' }).getByRole('button', { name: 'Earth from Moon' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('globe')).toHaveAttribute('data-view', 'earth-from-moon');
  await expect(page.getByTestId('globe')).toHaveAttribute('data-solar-shadow', 'on');
});

test('clicking the Moon flies to it, and the camera then orbits and zooms around it', async ({
  page,
}) => {
  await page.goto('./?t=2024-04-08T18:17&cam=0,-5,150');
  await globeRendered(page);
  await page.locator('.space-marker[data-body="moon"]').click();
  await expect(page.getByTestId('globe')).toHaveAttribute('data-focus', 'moon');
  // Lands four Moon radii out, and the link says so.
  await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},4\.00&focus=moon/);
  // Zooming now moves towards the Moon.
  const canvas = page.getByTestId('globe').locator('canvas');
  await canvas.hover();
  await page.mouse.wheel(0, -400);
  await expect(page).not.toHaveURL(/,4\.00&focus=moon/);
  await expect(page).toHaveURL(/,[123]\.\d\d&focus=moon/);
});

test('a link centred on the Moon opens there, and Earth is one click back', async ({ page }) => {
  // Over the far side, so Earth lies ahead, beyond the Moon.
  await page.goto('./?t=2025-11-05T12:00&cam=0,180,3&focus=moon');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-focus', 'moon');
  await expect(globe).toHaveAttribute('data-space', 'moon');
  await expect(page).toHaveURL(/cam=-?0\.0000,180\.0000,3\.00&focus=moon/);
  await page.locator('.space-marker[data-body="earth"]').click();
  await expect(globe).toHaveAttribute('data-focus', 'earth');
  await expect(page).not.toHaveURL(/focus=/);
});

test('eclipse shadows render on the Moon and on Earth without errors', async ({ page }) => {
  const problems = collectProblems(page);
  // Totality of 14 March 2025, orbiting the Moon: Earth's shadow is drawn on it.
  await page.goto('./?t=2025-03-14T06:59&cam=0,0,3&focus=moon');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-focus', 'moon');
  // 8 April 2024 with no eclipse selected: the Moon's shadow comes from the geometry.
  await page.goto('./?t=2024-04-08T18:17&cam=25.3,-104.1,1.25&layers=');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-space', 'moon');
  // Shader compile errors surface as console errors.
  expect(problems).toEqual([]);
});

test('page fits the viewport without horizontal scroll', async ({ page }) => {
  await page.goto('./');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('serves the expected release', async ({ page }) => {
  test.skip(expectedVersion === '', 'EXPECTED_VERSION is not set');
  await page.goto('./');
  await expect(page.locator('meta[name="histeclipse-version"]')).toHaveAttribute(
    'content',
    expectedVersion,
  );
});

const BABYLON_NIGHT_3000_BCE = './?mode=sky&t=-2999-03-20T19:00&loc=32.5422,44.4209';

async function skyRendered(page: Page): Promise<void> {
  await expect(page.getByTestId('sky')).toHaveAttribute('data-rendered', 'true');
}

test('the Sky button stands you where the globe is looking, and back again', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?t=2025-03-20T19:00Z&cam=32.5,44.4,3');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Sky' }).click();
  await skyRendered(page);
  await expect(page.getByTestId('globe')).toBeHidden();
  await expect(page).toHaveURL(/mode=sky/);
  await expect(page).toHaveURL(/loc=32\.5000,44\.4000/);
  await expect(page).toHaveURL(/look=180\.0,30\.0,90\.0/);
  await expect(page.getByText('Standing at 32.50° N, 44.40° E, facing S.')).toBeVisible();

  await page.getByRole('button', { name: 'Orbit' }).click();
  await expect(page.getByTestId('sky')).toBeHidden();
  await expect(page.getByTestId('globe')).toBeVisible();
  await expect(page).toHaveURL(/mode=globe/);
  expect(problems).toEqual([]);
});

test('a night in 3000 BCE is full of stars, and the Sun hides them by day', async ({ page }) => {
  await page.goto(BABYLON_NIGHT_3000_BCE);
  await skyRendered(page);
  const sky = page.getByTestId('sky');
  await expect(sky).toHaveAttribute('data-sun-altitude', /^-\d\d/);
  const seen = Number(await sky.getAttribute('data-stars-seen'));
  expect(seen).toBeGreaterThan(2000);
  // The Southern Cross's neighbours stood over Babylon then; the hint names them.
  await expect(page.getByText('Centaurus', { exact: true })).toBeVisible();
  // ΔT is uncertain by about half an hour then, and the page says what that means.
  await expect(page.getByText(/the sky may be turned up to ±7\.\d°/)).toBeVisible();

  await page.goto('./?mode=sky&t=2025-03-20T09:00&loc=32.5422,44.4209');
  await skyRendered(page);
  await expect(sky).toHaveAttribute('data-stars-seen', '0');
});

test('dragging and zooming the sky turn the view, and the link follows', async ({ page }) => {
  await page.goto(BABYLON_NIGHT_3000_BCE);
  await skyRendered(page);
  const box = await page.getByTestId('sky').boundingBox();
  if (box === null) throw new Error('sky has no size');
  const center = { x: box.x + box.width / 2, y: box.y + (box.height * 2) / 3 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 200, center.y, { steps: 8 });
  await page.mouse.up();
  // Dragging the sky to the right turns the view from south toward east.
  await expect(page).toHaveURL(/look=1[0-7]\d\.\d,30\.0,90\.0/);
  await page.mouse.wheel(0, -400);
  await expect(page).toHaveURL(/look=1[0-7]\d\.\d,30\.0,[1-8]\d\.\d/);
});

test('the constellation switch draws all 88 figures, and the link keeps it', async ({ page }) => {
  await page.goto(`${BABYLON_NIGHT_3000_BCE}&look=0,30,90`);
  await skyRendered(page);
  // Draco, Thuban's constellation, is not among the famous figures shown by default.
  await expect(page.getByText('Draco', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'All 88' }).click();
  await expect(page).toHaveURL(/figures=all/);
  await expect(page.getByText('Draco', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'None' }).click();
  await expect(page).toHaveURL(/figures=none/);
  await expect(page.locator('.sky-label.is-constellation:visible')).toHaveCount(0);
});

test('from the central line in 2024 the Moon hides the whole Sun; farther north it does not', async ({
  page,
}) => {
  await page.goto('./?mode=sky&t=2024-04-08T18:17&loc=25.29,-104.14');
  await skyRendered(page);
  const sky = page.getByTestId('sky');
  await expect(sky).toHaveAttribute('data-sun-visible', '0.0000');
  await expect(page.getByTestId('sky-eclipse')).toHaveText(
    'Totality: the Moon hides the whole Sun.',
  );
  // In the middle of the day, the brightest stars come out.
  expect(Number(await sky.getAttribute('data-stars-seen'))).toBeGreaterThan(0);

  await page.goto('./?mode=sky&t=2024-04-08T18:17&loc=32,-100');
  await skyRendered(page);
  await expect(page.getByTestId('sky-eclipse')).toHaveText(/The Moon covers \d\d% of the Sun\./);
  await expect(sky).toHaveAttribute('data-stars-seen', '0');
});

test('the Moon turns red in the umbra during a lunar eclipse', async ({ page }) => {
  await page.goto('./?mode=sky&t=2022-11-08T10:59&loc=40.7,-74');
  await skyRendered(page);
  await expect(page.getByTestId('sky')).toHaveAttribute('data-moon-sunlight', '0.000');
  await expect(page.getByTestId('sky-eclipse')).toContainText('darkest shadow');
  await page.getByRole('button', { name: 'Moon', exact: true }).click();
  // Setting in the west at dawn, as New Yorkers saw it.
  await expect(page).toHaveURL(/look=2\d\d\.\d,[0-9]\.\d,/);
});

test('tapping the globe picks where to stand, and the sky faces the eclipse from there', async ({
  page,
}) => {
  await page.goto('./?t=2024-04-08T18:17&cam=25.29,-104.14,4.5&sel=solar:2024-04-08');
  await globeRendered(page);
  const box = await page.getByTestId('globe').boundingBox();
  if (box === null) throw new Error('globe has no size');
  // The globe sits in the middle of the space the panels leave (on phones, below the header).
  const top = await page.evaluate(() =>
    window.innerWidth <= 600
      ? (document.querySelector('.hud')?.getBoundingClientRect().bottom ?? 0)
      : 0,
  );
  const bottom = (await page.locator('.bottom').boundingBox())?.height ?? 0;
  await page.mouse.click(box.x + box.width / 2, box.y + (top + box.height - bottom) / 2);
  // Close to where the camera looks, in the path of totality.
  await expect(page).toHaveURL(/loc=2[0-9]\.\d{4},-10[0-9]\.\d{4}/);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-location', /\d/);

  await page.getByRole('button', { name: 'Sky', exact: true }).click();
  await skyRendered(page);
  const sky = page.getByTestId('sky');
  // Facing the Sun: the look's altitude matches the Sun's.
  const sunAltitude = Number(await sky.getAttribute('data-sun-altitude'));
  const [, altitude] = ((await sky.getAttribute('data-look')) ?? '').split(',').map(Number);
  expect(Math.abs((altitude ?? 0) - sunAltitude)).toBeLessThan(1);
  await expect(page.getByTestId('sky-eclipse')).toBeVisible();
});

/** The middle of the space the panels leave free, at `x` (by default the middle). */
async function freeSpot(page: Page, x?: number): Promise<{ x: number; y: number }> {
  const top = (await page.locator('.hud').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const bottom = (await page.locator('.bottom').boundingBox()) ?? { y: 0 };
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const narrow = viewport.width <= 600;
  const from = narrow ? top.y + top.height : 0;
  // On wide screens the date panel sits at the left, so aim between it and the right edge.
  const left = narrow ? 0 : top.x + top.width;
  return { x: x ?? (left + viewport.width) / 2, y: (from + bottom.y) / 2 };
}

test('tapping the sky hides the panels, and tapping again brings them back', async ({ page }) => {
  await page.goto(BABYLON_NIGHT_3000_BCE);
  await skyRendered(page);
  const hud = page.locator('.hud');
  const bottom = page.locator('.bottom');
  const spot = await freeSpot(page);

  await page.mouse.click(spot.x, spot.y);
  await expect(hud).toBeHidden();
  await expect(bottom).toBeHidden();
  await expect(page.locator('#app')).toHaveAttribute('data-panels', 'hidden');

  // Dragging still turns the sky and leaves the panels as they are.
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.move(spot.x + 120, spot.y, { steps: 6 });
  await page.mouse.up();
  await expect(hud).toBeHidden();

  await page.mouse.click(spot.x, spot.y);
  await expect(hud).toBeVisible();
  await expect(bottom).toBeVisible();

  // A tap on the panel itself does not hide it.
  await page.locator('.hud h1').click();
  await expect(hud).toBeVisible();
});

test('tapping empty space beside the globe toggles the panels', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
  await globeRendered(page);
  const spot = await freeSpot(page, 8);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator('.hud')).toBeHidden();
  await expect(page.locator('.bottom')).toBeHidden();
  // Tapping Earth itself still picks a place, and does not toggle anything.
  const globe = await page.getByTestId('globe').boundingBox();
  if (globe === null) throw new Error('globe has no size');
  await page.mouse.click(globe.x + globe.width / 2, globe.y + globe.height / 2);
  await expect(page).toHaveURL(/loc=/);
  await expect(page.locator('.hud')).toBeHidden();
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator('.hud')).toBeVisible();
});

test('years can be counted in the Hebrew calendar, and the link keeps it', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
  await globeRendered(page);
  const year = page.getByLabel('Year', { exact: true });
  const era = page.getByLabel('Era', { exact: true });
  await era.selectOption('hebrew');
  await expect(page).toHaveURL(/years=hebrew/);
  await expect(year).toHaveValue('5784');
  await expect(page.locator('.hud-detail')).toContainText('29 Adar II 5784 AM');
  // 5784 ran from September 2023 to October 2024: it holds the annular eclipse of October 2023
  // and the total one of April 2024, listed by their Hebrew dates.
  await expect(page.getByRole('button', { name: /29 Tishri\s*Annular solar/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /29 Adar II\s*Total solar/ })).toBeVisible();

  await page.getByRole('button', { name: 'Next year' }).click();
  await expect(year).toHaveValue('5785');
  await expect(page).toHaveURL(/t=2025-/);

  await era.selectOption('CE');
  await expect(page).not.toHaveURL(/years=/);
  await expect(year).toHaveValue('2025');
});

test('Ptolemy’s eclipse of 721 BCE is listed on 29 Thoth in year 27 of Nabonassar', async ({
  page,
}) => {
  await page.goto('./?t=-720-03-19T12:00&years=egyptian');
  await globeRendered(page);
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('27');
  await expect(page.getByLabel('Era', { exact: true })).toHaveValue('egyptian');
  await expect(page.getByRole('button', { name: /29 Thoth\s*Total lunar/ })).toBeVisible();

  // Typing a year jumps to it, in the same calendar.
  const year = page.getByLabel('Year', { exact: true });
  await year.fill('1');
  await year.press('Enter');
  await expect(page).toHaveURL(/t=-0746-/);
});

test('close to the Sun, SDO’s images show it in six kinds of light', async ({ page }) => {
  // Seen from Earth's side on 8 May 2024: the antisolar direction in the Sun's frame.
  await page.goto('./?t=2024-05-08T12:00&focus=sun&cam=-17.2,-134.2,4');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  // A small frame shows at once; the sharp one follows.
  await expect(globe).toHaveAttribute('data-sun-image', 'large', { timeout: 30_000 });
  await expect(globe).toHaveAttribute('data-sun-layer', 'visible');
  await expect(globe).toHaveAttribute('data-sun-facing', '1.000');
  await expect(page.getByTestId('sun-caption')).toContainText('08 May 2024');
  await expect(page.getByTestId('sun-caption')).toContainText('NASA/SDO');

  await page.getByRole('button', { name: '171 Å' }).click();
  await expect(page).toHaveURL(/sun=171/);
  await expect(globe).toHaveAttribute('data-sun-layer', '171', { timeout: 30_000 });
  await expect(page.getByTestId('sun-caption')).toContainText('600,000 °C');

  // Around Earth, the Sun is a plain disc again and the switch goes away.
  await page.goto('./?t=2024-05-08T12:00&sun=171');
  await globeRendered(page);
  await expect(page.getByRole('group', { name: 'Light' })).toBeHidden();
  await expect(globe).toHaveAttribute('data-sun-image', 'none');
});

test('the empires layer draws the states of the year shown, and the link keeps it', async ({
  page,
}) => {
  await page.goto('./?t=-586-07-29T12:00&cam=33,40,3');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  const empires = page.getByRole('button', { name: 'Empires' });
  await expect(empires).toHaveAttribute('aria-pressed', 'false');
  await expect(globe).not.toHaveAttribute('data-empires', /\d/);

  await empires.click();
  await expect(page).toHaveURL(/layers=[a-z,]*empires/);
  await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  await expect(page.locator('.empire-label', { hasText: /^Neo-Babylonian Empire$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cliopatria' })).toBeVisible();

  // Fifty years later, Persia holds the Near East.
  const year = page.getByLabel('Year', { exact: true });
  await year.fill('500');
  await year.press('Enter');
  await expect(page.locator('.empire-label', { hasText: /^Achaemenid Empire$/ })).toBeVisible();

  await empires.click();
  await expect(globe).toHaveAttribute('data-empires', 'off');
  await expect(page.getByRole('link', { name: 'Cliopatria' })).toBeHidden();
});

test('the sky can be drawn as other cultures saw it, credited, and the link keeps it', async ({
  page,
}) => {
  await page.goto('./?mode=sky&t=-586-01-15T20:00&loc=32.54,44.42&look=200,45,100');
  await skyRendered(page);
  const culture = page.getByLabel('Sky culture');
  await expect(culture).toHaveValue('modern');
  await culture.selectOption('babylonian_mulapin');
  await expect(page).toHaveURL(/culture=babylonian_mulapin/);
  // Names in English and in cuneiform, from the unmodified Stellarium file.
  await expect(
    page.locator('.sky-label.is-constellation:visible', { hasText: ' · ' }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
  await page.getByText('About these figures').click();
  await expect(page.getByTestId('culture-caption')).toContainText('CC BY-ND 4.0');
  await expect(page.getByRole('link', { name: 'authors and sources' })).toHaveAttribute(
    'href',
    /skycultures\/babylonian_mulapin\/description\.md$/,
  );

  await culture.selectOption('modern');
  await expect(page).not.toHaveURL(/culture=/);
  await expect(page.getByRole('button', { name: 'All 88' })).toBeVisible();
});

/** The planets as the sky view reports them: altitude, azimuth, magnitude and visibility. */
async function planetsIn(
  page: Page,
): Promise<Map<string, { alt: number; az: number; seen: boolean }>> {
  const report = (await page.getByTestId('sky').getAttribute('data-planets')) ?? '';
  return new Map(
    report
      .split(' ')
      .filter((entry) => entry !== '')
      .map((entry) => {
        const [name = '', alt = '0', az = '0', , seen = ''] = entry.split(':');
        return [name, { alt: Number(alt), az: Number(az), seen: seen === 'seen' }] as const;
      }),
  );
}

test('Jupiter and Saturn meet low in the south-west in the great conjunction of December 2020', async ({
  page,
}) => {
  await page.goto('./?mode=sky&t=2020-12-21T17:00&loc=51.5,-0.12&look=208,14,24');
  await skyRendered(page);
  await expect(page.getByTestId('sky')).toHaveAttribute('data-planets', /Saturn/);
  const planets = await planetsIn(page);
  const jupiter = planets.get('Jupiter');
  const saturn = planets.get('Saturn');
  if (jupiter === undefined || saturn === undefined) throw new Error('planets missing');
  expect(jupiter.seen && saturn.seen).toBe(true);
  // Seen from London after sunset: about 9° up in the south-west, a tenth of a degree apart.
  expect(jupiter.alt).toBeGreaterThan(5);
  expect(jupiter.alt).toBeLessThan(13);
  expect(jupiter.az).toBeGreaterThan(210);
  expect(jupiter.az).toBeLessThan(230);
  const apart = Math.hypot(
    (jupiter.az - saturn.az) * Math.cos((jupiter.alt * Math.PI) / 180),
    jupiter.alt - saturn.alt,
  );
  expect(apart).toBeLessThan(0.15);
  await expect(page.locator('.sky-label.is-planet:visible')).toHaveText(['Jupiter & Saturn']);
});

test('far back in time, the sky says how far the planets can be trusted', async ({ page }) => {
  await page.goto('./?mode=sky&t=-2499-03-20T19:00&loc=32.5422,44.4209');
  await skyRendered(page);
  await expect(page.locator('.sky-caption')).toContainText('Jupiter ±3′, Saturn ±6′');
  await page.goto('./?mode=sky&t=-586-03-20T19:00&loc=32.5422,44.4209');
  await skyRendered(page);
  await expect(page.locator('.sky-caption')).not.toContainText('planet positions');
});

test('the Moon hides Mars from Berlin in the occultation of 8 December 2022', async ({ page }) => {
  // Mars disappeared behind the full Moon at about 05:00 UT and came back at about 05:56.
  await page.goto('./?mode=sky&t=2022-12-08T05:28&loc=52.52,13.4&look=290,20,30');
  await skyRendered(page);
  await expect(page.getByTestId('sky')).toHaveAttribute(
    'data-planets',
    /Mars:[\d.-]+:[\d.-]+:[\d.-]+:covered/,
  );
  await expect(page.locator('.sky-label.is-planet', { hasText: 'Mars' })).toBeHidden();

  await page.goto('./?mode=sky&t=2022-12-08T04:30&loc=52.52,13.4&look=290,20,30');
  await skyRendered(page);
  await expect(page.getByTestId('sky')).toHaveAttribute(
    'data-planets',
    /Mars:[\d.-]+:[\d.-]+:[\d.-]+:seen/,
  );
});

test('picking a culture puts you where its sky-watchers stood', async ({ page }) => {
  await page.goto('./?mode=sky&t=-586-01-15T20:00&loc=51.5,-0.12&look=180,40,90');
  await skyRendered(page);
  await page.getByLabel('Sky culture').selectOption('chinese');
  await expect(page).toHaveURL(/loc=34\.6197,112\.4540/);
  await expect(page.locator('.sky-caption')).toContainText(
    'Standing in Luoyang (34.62° N, 112.45° E)',
  );
  // The date stays where it was.
  await expect(page).toHaveURL(/t=-0586-01-15T20:00Z/);
  await page.getByLabel('Sky culture').selectOption('babylonian_mulapin');
  await expect(page.locator('.sky-caption')).toContainText('Standing in Babylon');
});

test('past borders can come from Cliopatria, OpenHistoricalMap, or both to compare', async ({
  page,
}) => {
  await page.goto('./?t=1500-06-01T12:00&cam=5,20,2.6&layers=lunar,solar,terminator,empires');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  const source = page.getByLabel('Borders from');
  await expect(source).toHaveValue('cliopatria');
  await expect(globe).toHaveAttribute('data-ohm-borders', 'off');

  await source.selectOption('both');
  await expect(page).toHaveURL(/borders=both/);
  await expect(globe).toHaveAttribute('data-ohm-borders', /^[1-9]\d*$/);
  await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  await expect(page.getByRole('link', { name: 'OpenHistoricalMap' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cliopatria' })).toBeVisible();

  await source.selectOption('ohm');
  await expect(globe).toHaveAttribute('data-empires', '0');
  await expect(page.getByRole('link', { name: 'Cliopatria' })).toBeHidden();
  // OpenHistoricalMap has kingdoms Cliopatria lacks, such as Mutapa.
  await expect(page.locator('.empire-label.is-ohm', { hasText: /Mutapa/ }).first()).toBeAttached();
});

test('picking a state marks the eclipses seen from it, and steps through them', async ({
  page,
}) => {
  // 763 BCE: the eclipse of the Assyrian eponym list, total in Assyria on 15 June.
  await page.goto('./?t=-762-06-15T12:00&cam=35,43,3&layers=lunar,solar,terminator,empires');
  await globeRendered(page);
  const seen = page.getByLabel('Seen from', { exact: true });
  await expect(seen.locator('option', { hasText: 'Neo-Assyrian Empire' })).toHaveCount(1);
  await seen.selectOption('Neo-Assyrian Empire');
  await expect(page).toHaveURL(/seen=Neo-Assyrian\+Empire/);
  await expect(page.getByRole('button', { name: /Total solar\s*seen, total/ })).toBeVisible();
  await expect(page.getByTestId('seen-status')).toHaveText(/^[1-9]\d* of \d+ seen$/);

  // The next one seen from Assyria: the Moon, eclipsed a fortnight later.
  await page.getByRole('button', { name: 'Next eclipse seen from there' }).click();
  await expect(page).toHaveURL(/sel=lunar:-0762-06-30/);
  await expect(page.locator('.eclipse-chip[aria-pressed="true"]')).toContainText(/seen|maybe/);

  await seen.selectOption('Anywhere');
  await expect(page).not.toHaveURL(/seen=/);
  await expect(page.locator('.eclipse-seen')).toHaveCount(0);
});

test('far out, the planets appear, and clicking one flies to it', async ({ page }) => {
  const problems = collectProblems(page);
  // Two and a half AU out, over the north side of the Solar System.
  await page.goto('./?t=2020-12-21T18:00&cam=60,0,60000');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-planets', 'on');
  const mars = page.locator('.space-marker[data-body="mars"]');
  await expect(mars).toBeVisible();
  await mars.click();
  await expect(globe).toHaveAttribute('data-focus', 'mars');
  await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},4\.00&focus=mars/);
  expect(problems).toEqual([]);
});

test('a link can centre on Saturn, rings and all', async ({ page }) => {
  await page.goto('./?t=2020-12-21T18:00&focus=saturn&cam=25,120,4');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-planets', 'on');
  await expect(globe).toHaveAttribute('data-focus', 'saturn');
  await expect(page).toHaveURL(/focus=saturn/);
});

test('deep time shows Pangaea 250 million years ago, steps, plays and returns', async ({
  page,
}) => {
  const problems = collectProblems(page);
  // Far enough out to see the Moon, which deep time leaves out.
  await page.goto('./?t=2024-06-21T12:00&cam=0,20,400');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  const moon = page.locator('.space-marker[data-body="moon"]');
  await expect(moon).toBeVisible();
  await page.getByRole('button', { name: 'Deep time' }).click();
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
  await facts.getByText('Poles, magnetic field, tilt and day').click();
  await expect(facts.locator('dd').nth(0)).toContainText('spin axis then');
  await expect(facts.locator('dd').nth(1)).toContainText('Reversing often');
  await expect(facts.locator('dd').nth(2)).toContainText('22.1° and 24.5°');
  await expect(facts.locator('dd').nth(3)).toContainText('23.5 h 70 Ma');
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

  await page.getByRole('button', { name: 'Back to history' }).click();
  await expect(page).not.toHaveURL(/ma=/);
  await expect(globe).toHaveAttribute('data-deep-time', 'off');
  await expect(globe).toHaveAttribute('data-light', 'sun');
  await expect(moon).toBeVisible();
  await expect(page.getByLabel('Year', { exact: true })).toBeVisible();
  expect(problems).toEqual([]);
});

test('deep time steps through milestones and shows each estimate with its source', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
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

test('deep time colours the globe by temperature, with the global mean and its caveats', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  const toggle = page.getByRole('button', { name: 'Temperature' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/layers=[^&]*temperature/);
  await expect(globe).toHaveAttribute(
    'data-temperature',
    /paleotemp\/245\.png .*paleotemp\/250\.png$/,
  );
  // The hothouse after the end-Permian extinction, against today's world.
  // Both models' global means, side by side: they part by seven degrees here.
  await expect(page.getByTestId('temperature-mean')).toHaveText(
    'Global mean: Scotese 2022 32.9 °C (today 14.6 °C) · CESM, Li et al. 2023 25.5 °C (today 13.2 °C)',
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

  await page.getByRole('button', { name: 'Temperature' }).click();
  await expect(globe).toHaveAttribute('data-temperature', 'off');
  await expect(page.locator('.temperature-legend')).toBeHidden();
  expect(problems).toEqual([]);
});

test('deep time charts sea level by four reconstructions, side by side', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
  const toggle = page.getByRole('button', { name: 'Sea level' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
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

  await toggle.click();
  await expect(legend).toBeHidden();
  expect(problems).toEqual([]);
});

test('deep time narrows to the ice ages, in thousands of years', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250&layers=sealevel');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Ice ages' }).click();
  // From further back, the ice ages open at the last glacial maximum.
  await expect(page).toHaveURL(/&ma=0\.021&scale=ice/);
  await expect(page.locator('.hud-date')).toHaveText('21,000 years ago');
  await expect(page.getByTestId('ice-note')).toBeVisible();
  await expect(page.getByLabel('Thousands of years ago')).toHaveValue('-21');
  await expect(page.getByRole('button', { name: 'Temperature' })).toBeDisabled();
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

  // Before the ice maps reach, the bar says so and draws none.
  await page.goto('./?ma=0.5&scale=ice');
  await globeRendered(page);
  await expect(page.getByTestId('ice-sheets')).toContainText('no openly licensed maps');
  await expect(globe).toHaveAttribute('data-ice', 'off');

  await page.getByRole('button', { name: '540 Myr' }).click();
  await expect(page).not.toHaveURL(/scale=/);
  await expect(page.getByLabel('Millions of years ago')).toBeVisible();
  await expect(page.getByTestId('ice-note')).toBeHidden();
  expect(problems).toEqual([]);
});

test('deep time outlines a second reconstruction’s continents', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=252');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  const toggle = page.getByRole('button', { name: 'Plates' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/layers=[^&]*plates/);
  await expect(globe).toHaveAttribute('data-plates', /plates\/250\.png .*plates\/255\.png$/);
  await expect(page.getByTestId('plates-note')).toContainText('Cao et al. 2024');
  // Lined up with the surface map in longitude, and the bar says by how much.
  await expect(page.getByTestId('plates-note')).toContainText('Turned 2° west');
  await toggle.click();
  await expect(globe).toHaveAttribute('data-plates', 'off');
  await expect(page.getByTestId('plates-note')).toBeHidden();
  expect(problems).toEqual([]);
});

test('deep time reaches back 4.6 billion years, leaving the globe blank before the maps', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await page.getByRole('button', { name: '4.6 Gyr' }).click();
  await expect(page).toHaveURL(/scale=eons/);
  await expect(page.getByTestId('uncharted-note')).toBeHidden();

  // Before the elevation maps reach, no made-up map: a blank globe, and the bar says why.
  await page.goto('./?ma=3000&scale=eons');
  await globeRendered(page);
  await expect(page.locator('.hud-date')).toHaveText('3,000 million years ago');
  await expect(page.locator('.hud-detail')).toHaveText('Mesoarchean era · Archean eon');
  await expect(globe).toHaveAttribute('data-uncharted', 'true');
  await expect(page.getByTestId('uncharted-note')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Temperature' })).toBeDisabled();

  // Milestones reach back too: the next older is the Late Heavy Bombardment's oldest view.
  await page.getByRole('button', { name: 'Earlier milestone' }).click();
  await expect(page).toHaveURL(/&ma=4200(&|$)/);
  const milestones = page.getByTestId('deep-milestones');
  await milestones.locator('summary').click();
  await expect(milestones.locator('[data-milestone="late-heavy-bombardment"]')).toContainText(
    'Boehnke & Harrison 2016',
  );

  // Back to the 540 Myr scale: it opens at the elevation maps' oldest.
  await page.getByRole('button', { name: '540 Myr' }).click();
  await expect(page).toHaveURL(/&ma=540(&|$)/);
  await expect(globe).toHaveAttribute('data-uncharted', 'false');
  expect(problems).toEqual([]);
});
