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
  await page.goto('./?t=2024-01-01T00:00');
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
  // From beyond the Sun, all three line up behind one marker.
  await page.goto('./?t=2024-04-08T18:17&cam=-7.6,85,60000');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-space', 'moon');
  await expect(earth).toHaveText('Earth, Moon and Sun');
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
