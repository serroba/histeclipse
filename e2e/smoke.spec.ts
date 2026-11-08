import type { Page } from '@playwright/test';

import deltaTTable from '../public/data/delta-t.json' with { type: 'json' };
import { subsolarPoint } from '../src/astro/sun';
import { parseViewState } from '../src/state/url';
import { momentJulianDay } from '../src/state/viewState';
import { DeltaT } from '../src/time/deltaT';
import {
  collectProblems,
  expect,
  globeRendered,
  openLayers,
  openSources,
  pickSpan,
  showDeepDetails,
  test,
} from './support';

// Commit SHA the deployment is expected to serve. Empty or unset skips the release check.
const expectedVersion = process.env['EXPECTED_VERSION'] ?? '';

// The 621 BCE lunar eclipse from Babylon, as someone might share it.
const SHARED_LINK = '?t=-620-04-22T07:20&loc=32.5422,44.4209&cam=30,40,3&sel=lunar:-0620-04-22';

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
    /\?v=1&mode=globe&t=-0620-04-22T07:20Z&cal=julian&loc=32\.5422,44\.4209&cam=30\.0000,40\.0000,3\.00&layers=lunar,solar&sel=lunar:-0620-04-22$/,
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
  // Between the panels, where the globe can be dragged, and to one side: the body in the
  // middle has a marker, which a tap flies to rather than drags. Measured for each drag, as
  // the panels change with the body in focus (the Moon's Light switch).
  const drag = async (): Promise<void> => {
    const box = await page.getByTestId('globe').boundingBox();
    const hud = await page.locator('.hud').boundingBox();
    const panels = await page.locator('.bottom').boundingBox();
    if (box === null || hud === null || panels === null) throw new Error('no layout');
    const start = { x: box.x + box.width * 0.2, y: (hud.y + hud.height + panels.y) / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 150, start.y + 40, { steps: 10 });
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

test('the panels fold away for a full view and come back', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
  await globeRendered(page);
  // The eclipse card folds to its title and unfolds again.
  const card = page.locator('.eclipse-card');
  await page.getByRole('button', { name: 'Fold the eclipse card' }).click();
  await expect(card).toHaveAttribute('data-folded', 'true');
  await expect(card.locator('.eclipse-more')).toBeHidden();
  await expect(card.locator('.eclipse-text > :first-child')).toBeVisible();
  await page.getByRole('button', { name: 'Unfold the eclipse card' }).click();
  await expect(card.locator('.eclipse-more')).toBeVisible();
  // Full view hides every panel; one button brings them back.
  await page.getByRole('button', { name: 'Hide the panels for a full view' }).click();
  await expect(page.locator('.hud')).toBeHidden();
  await expect(page.locator('.bottom')).toBeHidden();
  await page.getByRole('button', { name: 'Show controls' }).click();
  await expect(page.locator('.hud')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show controls' })).toBeHidden();
  expect(problems).toEqual([]);
});

test('a first visit is welcomed once, with a place to start', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./');
  await globeRendered(page);
  const welcome = page.getByTestId('welcome');
  await expect(welcome).toBeVisible();
  await welcome.getByRole('button', { name: 'Start with a famous eclipse' }).click();
  await expect(page.getByRole('dialog', { name: 'Famous eclipses' })).toBeVisible();
  // Remembered: not again on the next bare visit, and never on a shared link.
  await page.goto('./');
  await globeRendered(page);
  await expect(welcome).toBeHidden();
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto('./?t=2024-04-08T18:17');
  await globeRendered(page);
  await expect(welcome).toBeHidden();
  expect(problems).toEqual([]);
});

test('the welcome goes once the visitor finds their own way in', async ({ page }) => {
  await page.goto('./');
  await globeRendered(page);
  const welcome = page.getByTestId('welcome');
  // Still there after the site settles: nothing the visitor did yet.
  await page.waitForTimeout(1000);
  await expect(welcome).toBeVisible();
  await pickSpan(page, '540 Myr');
  await expect(welcome).toBeHidden();
  await pickSpan(page, 'Years');
  await expect(welcome).toBeHidden();
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
    'Babylon (32.5°N 44.4°E): The Moon was above the horizon here.',
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
  await page.goto('./?t=-620-04-22T02:08&sel=lunar:-0620-04-22&layers=');
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
  await page.goto('./?t=2024-01-01T00:00&layers=lunar,solar,empires');
  await globeRendered(page);
  await expect(page.getByRole('button', { name: /8 Apr/ })).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('no viewport');
  await page.getByRole('button', { name: /8 Apr/ }).click();
  for (const control of await page
    .locator(
      // Visible ones: the tablet check's button waits there for the Babylonian calendar.
      ':is(.timeline, .scrubber) :is(button, input, select):visible',
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

  // Not greatest eclipse (18:17, in Mexico) but mid-totality where the observer stands.
  await expect(page).toHaveURL(/t=2024-04-08T18:43Z/);
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
  // The place the record is linked to is named, and can be changed.
  await expect(page.locator('.eclipse-observer')).toHaveText(
    /^Syracuse.*\(37\.1°N 15\.3°E\): The Moon was above the horizon here\.$/,
  );
  await expect(page.locator('.eclipse-elsewhere')).toBeAttached();
});

test('a famous solar eclipse opens at its deepest where it was seen, and every view agrees', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?t=2024-01-01T00:00');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Famous eclipses' }).click();
  await page
    .getByRole('dialog', { name: 'Famous eclipses' })
    .getByRole('button', { name: /The 2024 North American eclipse/ })
    .click();
  // Dallas is in totality from 18:40 to 18:44 UT, not at greatest eclipse (18:17) in Mexico.
  await expect(page).toHaveURL(/t=2024-04-08T18:4[1-4]/);
  await expect(page.locator('.eclipse-observer')).toContainText('total');
  await page.getByRole('button', { name: 'Sky' }).click();
  await skyRendered(page);
  await expect(page.getByTestId('sky-eclipse')).toHaveText(
    'Totality: the Moon hides the whole Sun.',
  );
  expect(problems).toEqual([]);
});

test('famous eclipses say how firmly each record is tied to its eclipse', async ({ page }) => {
  await page.goto('./?t=-309-08-15T12:00&sel=solar:-0309-08-15');
  await globeRendered(page);
  await expect(page.locator('.famous-card-title')).toHaveText("Agathocles' eclipse");
  await expect(page.locator('.famous-card-confidence')).toHaveText(
    'Link to this eclipse: probable: widely accepted, with some doubt.',
  );
  await page.getByRole('button', { name: 'Famous eclipses' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Famous eclipses' })
      .getByRole('button', { name: /Agathocles.*probable/ }),
  ).toBeVisible();
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
  await expect(page.locator('.famous-card-confidence')).toHaveText(
    'Link to this eclipse: debated.',
  );
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

test('clicking the Sun flies to the side facing Earth, wherever the camera was', async ({
  page,
}) => {
  // Far out, a quarter turn round from the line between Earth and the Sun.
  await page.goto('./?t=2024-05-08T12:00&cam=0,-91,80000');
  await globeRendered(page);
  await page.locator('.space-marker[data-body="sun"]').click();
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-focus', 'sun');
  // Lands where the link for Earth's side of the Sun that day points.
  await expect(page).toHaveURL(/cam=-17\.\d+,-134\.\d+,4\.00&focus=sun/);
  await expect(globe).toHaveAttribute('data-sun-facing', '1.000');
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

/** Open the sky's constellation options, folded away on phones. */
async function openSkyOptions(page: Page): Promise<void> {
  const options = page.locator('details.sky-options');
  if ((await options.getAttribute('open')) === null) await options.locator('> summary').click();
}

async function skyRendered(page: Page): Promise<void> {
  await expect(page.getByTestId('sky')).toHaveAttribute('data-rendered', 'true');
}

test('a page opened before a deploy reloads once when a late part of it is gone', async ({
  page,
}) => {
  // Two whole page loads, the second up to 30 s on a busy machine.
  test.slow();
  let missing = 1;
  // Each request for the page itself, rather than each load event: on the live site a reload
  // can start before the first page's load event, which then never fires (#306).
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) loads += 1;
  });
  await test.step('Given the sky’s code gone from the server once, as after a deploy', async () => {
    await page.route('**/assets/skyScene-*.js', async (route) => {
      if (missing > 0) {
        missing -= 1;
        await route.fulfill({ status: 404, body: 'gone' });
      } else {
        await route.continue();
      }
    });
  });
  await test.step('When they open the sky', async () => {
    await page.goto('./?mode=sky&t=2025-03-20T19:00Z&loc=32.5422,44.4209');
  });
  await test.step('Then the page reloads by itself and the stars come up', async () => {
    // A whole second load: more than the usual wait on a busy machine.
    await expect.poll(() => loads, { timeout: 30_000 }).toBe(2);
    await expect(page.getByTestId('sky')).toHaveAttribute('data-rendered', 'true', {
      timeout: 15_000,
    });
    expect(loads).toBe(2);
  });
});

test('a late part that stays missing says so once, without reloading again and again', async ({
  page,
}) => {
  // Two whole page loads, the second up to 30 s on a busy machine.
  test.slow();
  // Each request for the page itself, rather than each load event: on the live site a reload
  // can start before the first page's load event, which then never fires (#306).
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) loads += 1;
  });
  await test.step('Given the sky’s code missing for good', async () => {
    await page.route('**/assets/skyScene-*.js', (route) =>
      route.fulfill({ status: 404, body: 'gone' }),
    );
  });
  await test.step('When they open the sky', async () => {
    await page.goto('./?mode=sky&t=2025-03-20T19:00Z&loc=32.5422,44.4209');
  });
  await test.step('Then, after one reload, a single notice says the stars could not load', async () => {
    // The first page can show the notice too, just before it reloads: wait for the second.
    await expect.poll(() => loads, { timeout: 30_000 }).toBe(2);
    const notice = page.getByRole('status').getByText(/^Could not load the stars/);
    await expect(notice).toHaveCount(1, { timeout: 15_000 });
    // Drawing again asks again: still one notice, and no further reload.
    await page.getByRole('button', { name: 'Sky', exact: true }).click();
    await expect(notice).toHaveCount(1);
    expect(loads).toBe(2);
  });
});

test('the Sky button stands you where the globe is looking, and back again', async ({
  page,
}, info) => {
  const problems = collectProblems(page);
  // An upright phone looks lower, so the horizon shows between the panels.
  const altitude = info.project.name === 'mobile' ? '12' : '30';
  await page.goto('./?t=2025-03-20T19:00Z&cam=32.5,44.4,3');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Sky' }).click();
  await skyRendered(page);
  await expect(page.getByTestId('globe')).toBeHidden();
  await expect(page).toHaveURL(/mode=sky/);
  await expect(page).toHaveURL(/loc=32\.5000,44\.4000/);
  await expect(page).toHaveURL(new RegExp(`look=180\\.0,${altitude}\\.0,90\\.0`));
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
  // Dragging the sky to the right turns the view from south toward east. (On an upright phone
  // the field is narrowed, so it is not the link's 90°.)
  await expect(page).toHaveURL(/look=1[0-7]\d\.\d,30\.0,\d+\.\d/);
  const fov = (): number => Number(/look=[\d.]+,[\d.]+,([\d.]+)/.exec(page.url())?.[1]);
  const before = fov();
  await page.mouse.wheel(0, -400);
  await expect.poll(fov).toBeLessThan(before);
  await expect(page).toHaveURL(/look=1[0-7]\d\.\d,30\.0,/);
});

test('the constellation switch draws all 88 figures, and the link keeps it', async ({ page }) => {
  await page.goto(`${BABYLON_NIGHT_3000_BCE}&look=0,30,90`);
  await skyRendered(page);
  // Draco, Thuban's constellation, is not among the famous figures shown by default.
  await expect(page.getByText('Draco', { exact: true })).toBeHidden();
  await openSkyOptions(page);
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

test('a tap on open sky clears the panels, as on the globe; another brings them back', async ({
  page,
}) => {
  const hud = page.locator('.hud');
  const bottom = page.locator('.bottom');
  let spot = { x: 0, y: 0 };
  await test.step('Given the night sky over Babylon', async () => {
    await page.goto(BABYLON_NIGHT_3000_BCE);
    await skyRendered(page);
    spot = await freeSpot(page);
  });
  await test.step('When they tap open sky, the panels clear', async () => {
    await page.mouse.click(spot.x, spot.y);
    await expect(hud).toBeHidden();
    await expect(bottom).toBeHidden();
    await expect(page.locator('#app')).toHaveAttribute('data-panels', 'hidden');
  });
  await test.step('And dragging still turns the sky, leaving the panels as they are', async () => {
    await page.mouse.move(spot.x, spot.y);
    await page.mouse.down();
    await page.mouse.move(spot.x + 120, spot.y, { steps: 6 });
    await page.mouse.up();
    await expect(hud).toBeHidden();
  });
  await test.step('When they tap again, the panels come back', async () => {
    await page.mouse.click(spot.x, spot.y);
    await expect(hud).toBeVisible();
    await expect(bottom).toBeVisible();
  });
});

test('on a phone held upright the sky opens low, with the horizon in view', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'about an upright phone');
  await test.step('Given the globe, nothing chosen in the sky yet', async () => {
    await page.goto('./?t=2026-11-07T07:49Z&loc=-33.90,151.20&cam=-33.9,151.2,3');
    await globeRendered(page);
  });
  await test.step('When they open the sky', async () => {
    await page.getByRole('button', { name: 'Sky', exact: true }).click();
    await skyRendered(page);
  });
  await test.step('Then it looks low over the horizon, and shows less than a fisheye would', async () => {
    await expect(page).toHaveURL(/look=180\.0,12\.0,/);
    // The field across the screen is narrowed: a tall phone spans no more than 110° top to bottom.
    await expect(page.getByTestId('sky')).toHaveAttribute(
      'data-look',
      /^180\.0,12\.0,(4|5)\d\.\d$/,
    );
  });
});

test('empty space beside the globe never hides the panels; Escape brings them back', async ({
  page,
}) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
  await globeRendered(page);
  const spot = await freeSpot(page, 8);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator('.hud')).toBeVisible();
  await page.getByRole('button', { name: 'Hide the panels for a full view' }).click();
  await expect(page.locator('.hud')).toBeHidden();
  // Tapping Earth itself still picks a place, and does not bring the panels back.
  const globe = await page.getByTestId('globe').boundingBox();
  if (globe === null) throw new Error('globe has no size');
  await page.mouse.click(globe.x + globe.width / 2, globe.y + globe.height / 2);
  await expect(page).toHaveURL(/loc=/);
  await expect(page.locator('.hud')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.hud')).toBeVisible();
  await expect(page.locator('.bottom')).toBeVisible();
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

test('years can be counted in the Chinese calendar, with the cycle names', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08&years=chinese');
  await globeRendered(page);
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('4721');
  // The new moon fell after midnight in Beijing: the eclipse is on the last day of the month.
  await expect(page.locator('.hud-detail')).toContainText(
    '2nd month, day 30, 4721 HE (甲辰 jiǎchén, Wood Dragon)',
  );
  await expect(page.getByRole('button', { name: /2nd month 30\s*Total solar/ })).toBeVisible();
});

test('the Babylonian calendar dates Jerusalem’s capture to 2 Addaru, 16 March 597 BCE', async ({
  page,
}) => {
  await page.goto('./?t=-596-03-16T12:00&years=babylonian');
  await globeRendered(page);
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('150');
  await expect(page.locator('.hud-detail')).toContainText(
    '2 Addaru, year 7 of Nebuchadnezzar II · 150 Bab. (598/597 BCE)',
  );
  // The canon counts Egyptian years, which began in February: there it is already year 8.
  await expect(page.locator('.hud-detail')).toContainText('Ptolemy’s canon: Nabokolassaros 8');
});

test('VAT 4956 can be checked against two candidate years, record by record', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?t=-567-04-23T12:00&years=babylonian');
  await globeRendered(page);
  // The check shows with the Babylonian calendar only.
  await page.goto('./?t=-567-04-23T12:00');
  await globeRendered(page);
  await expect(page.getByRole('button', { name: 'Check a tablet' })).toBeHidden();
  await page.getByLabel('Era', { exact: true }).selectOption('babylonian');
  await page.getByRole('button', { name: 'Check a tablet' }).click();
  const summary = page.getByTestId('tablet-summary');
  await expect(summary).toHaveText('20 of 21 records fit 568/567 BCE.', { timeout: 30_000 });
  await page.getByRole('button', { name: '588 BCE' }).click();
  await expect(summary).toHaveText('10 of 21 records fit 588/587 BCE.', { timeout: 30_000 });
  await page.getByRole('button', { name: '568 BCE' }).click();
  await expect(summary).toHaveText('20 of 21 records fit 568/567 BCE.', { timeout: 30_000 });
  // A record opens the sky over Babylon that evening.
  await page.locator('[data-record="II-18-venus"]').click();
  await expect(page).toHaveURL(/mode=sky/);
  await expect(page).toHaveURL(/t=-0567-06-08T/);
  // The record stays on screen with its verdict, its bodies are pointed out, and the way back
  // to the list is one tap.
  const record = page.getByTestId('tablet-record');
  await expect(record).toContainText('Venus');
  await expect(record).toContainText('✓ fits');
  await expect(page.locator('.sky-label.is-mark', { hasText: 'Venus' })).toBeVisible();
  await record.getByRole('button', { name: 'Back to the tablet' }).click();
  await expect(page.getByRole('dialog', { name: /VAT 4956/ })).toBeVisible();
  await expect(page.locator('[data-record="II-18-venus"]')).toBeFocused();
  await page.keyboard.press('Escape');
  // Leaving the sky lets the record go.
  await page.getByRole('button', { name: 'Orbit' }).click();
  await expect(record).toBeHidden();
  expect(problems).toEqual([]);
});

test('Back steps through what the reader did, and Forward returns', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?t=2024-04-08T18:17');
  await globeRendered(page);
  await page
    .getByRole('button', { name: /Total solar/ })
    .first()
    .click();
  await expect(page).toHaveURL(/sel=solar:2024-04-08/);
  await page.getByRole('button', { name: 'Sky', exact: true }).click();
  await expect(page).toHaveURL(/mode=sky/);
  // Back: from the sky to the globe, the eclipse still picked; again: before the pick.
  await page.goBack();
  await expect(page).not.toHaveURL(/mode=sky/);
  await expect(page).toHaveURL(/sel=solar:2024-04-08/);
  await page.goBack();
  await expect(page).not.toHaveURL(/sel=/);
  await expect(page.locator('.hud')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/sel=solar:2024-04-08/);
  expect(problems).toEqual([]);
});

test('newcomers find their way: the tablet from the famous list, years typed, picking a place', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
  await globeRendered(page);
  // Until a place is picked, the card says how to pick one.
  // Click with a mouse, tap on a phone.
  await expect(page.locator('.eclipse-hint')).toHaveText(
    /^(Click|Tap) the globe to see this eclipse from there\.$/,
  );
  const touch = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
  await expect(page.locator('.eclipse-hint')).toContainText(touch ? 'Tap' : 'Click');
  // A year typed and left applies without Enter.
  const year = page.getByLabel('Year', { exact: true });
  await year.fill('1999');
  await year.blur();
  await expect(page).toHaveURL(/t=1999-/);
  // The tablet check is one of the famous list's entries, and opens in the Babylonian calendar.
  await page.getByRole('button', { name: 'Famous eclipses' }).click();
  await page.getByRole('button', { name: /Check a Babylonian tablet against the sky/ }).click();
  await expect(page).toHaveURL(/years=babylonian/);
  await expect(page.getByTestId('tablet-summary')).toHaveText('20 of 21 records fit 568/567 BCE.', {
    timeout: 30_000,
  });
  expect(problems).toEqual([]);
});

test('the card names the place an eclipse is seen from, or calls it your spot', async ({
  page,
}) => {
  await page.goto('./?t=2024-04-08T18:30&sel=solar:2024-04-08&loc=32.7767,-96.797');
  await globeRendered(page);
  await expect(page.locator('.eclipse-observer')).toHaveText(
    /^Dallas \(32\.8°N 96\.8°W\): a total eclipse\./,
  );
  await page.goto('./?t=2024-04-08T18:30&sel=solar:2024-04-08&loc=40.7128,-74.006');
  await globeRendered(page);
  await expect(page.locator('.eclipse-observer')).toHaveText(/^Your spot \(40\.7°N 74\.0°W\): /);
});

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
  await page.getByRole('button', { name: 'Temperature', exact: true }).click();
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
  // The surface is stitched from frames of three weeks, ending that day.
  await expect(page.getByTestId('sun-caption')).toContainText('18 Apr 2024 – 08 May 2024');
  await expect(page.getByTestId('sun-caption')).toContainText('NASA/SDO');

  // From behind, the far side is SDO's too, from earlier frames, not a plain surface.
  await page.goto('./?t=2024-05-08T12:00&focus=sun&cam=17.2,45.8,4');
  await expect(globe).toHaveAttribute('data-sun-image', 'large', { timeout: 30_000 });
  await expect(globe).toHaveAttribute('data-sun-facing', '-1.000');

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

test('the Sun’s channels are named by what they show, the light beneath, and Å explained', async ({
  page,
}, info) => {
  const light = page.getByRole('group', { name: 'Light' });
  await test.step('Given the Sun close up, in the hottest flaring light', async () => {
    await page.goto('./?t=2024-05-08T12:00&focus=sun&cam=-17.2,-134.2,4&sun=131');
    await globeRendered(page);
  });
  await test.step('Then each channel says what it shows, and its wavelength and heat beneath', async () => {
    for (const [name, detail] of [
      ['Surface', 'visible light, 617 nm'],
      ['Magnetic field', 'at the surface'],
      ['Chromosphere', '304 Å · 50,000 °C'],
      ['Quiet corona', '171 Å · 600,000 °C'],
      ['Corona and holes', '193 Å · 1 million °C'],
      ['Flares', '131 Å · 10 million °C'],
    ] as const) {
      await expect(light.getByRole('button', { name: `${name} ${detail}` })).toHaveCount(1);
    }
    await expect(light.getByRole('button', { name: /^Flares/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  if (info.project.name === 'mobile') {
    await test.step('And on a phone they are one row, the one picked scrolled into it', async () => {
      const row = await light.boundingBox();
      const flares = await light.getByRole('button', { name: /^Flares/ }).boundingBox();
      if (row === null || flares === null) throw new Error('not laid out');
      expect(row.height).toBeLessThan(60);
      expect(flares.x + flares.width).toBeLessThanOrEqual(row.x + row.width + 1);
    });
  }
  await test.step('When they ask where the light comes from, Å is explained', async () => {
    await light.getByRole('button', { name: 'Why: The Sun close up' }).click();
    const sheet = page.getByRole('dialog', { name: 'The Sun close up' });
    await expect(sheet).toContainText('ångströms (Å), a tenth of a nanometre');
    await expect(sheet.getByRole('link', { name: 'Lemen et al. 2012', exact: true })).toBeVisible();
  });
});

test('close to the Sun, the caption says what the light shows; how it was made is a tap away', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'desktop-120hz', 'about layout, not frames');
  const phone = info.project.name === 'mobile';
  const caption = page.getByTestId('sun-caption');
  const more = caption.getByText('How it was made, and credit');
  const credit = caption.getByText(/Credit: NASA\/SDO/);
  await test.step('Given the Sun close up', async () => {
    await page.goto('./?t=2024-05-08T12:00&focus=sun&cam=-17.2,-134.2,4');
    await globeRendered(page);
  });
  await test.step('Then the first line says what the light shows', async () => {
    await expect(caption).toContainText('617 nm, close to what the eye sees');
  });
  await test.step(
    phone
      ? 'And on a phone the rest is folded, so the panel leaves the Sun in view'
      : 'And on a wide screen the rest shows at once',
    async () => {
      if (phone) {
        await expect(credit).toBeHidden();
        const panel = await page.locator('.hud').boundingBox();
        const height = page.viewportSize()?.height ?? 0;
        expect((panel?.y ?? 0) + (panel?.height ?? 0)).toBeLessThan(height / 2);
      } else {
        await expect(credit).toBeVisible();
      }
    },
  );
  if (phone) {
    await test.step('When they open how it was made, the credit and the caveat show', async () => {
      await more.click();
      await expect(credit).toBeVisible();
      await expect(caption).toContainText('This is the Sun of 2024');
    });
  }
});

test('the sky can be drawn as other cultures saw it, credited, and the link keeps it', async ({
  page,
}) => {
  await page.goto('./?mode=sky&t=-586-01-15T20:00&loc=32.54,44.42&look=200,45,100');
  await skyRendered(page);
  await openSkyOptions(page);
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
  await openSkyOptions(page);
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
  await page.goto('./?t=1500-06-01T12:00&cam=5,20,2.6&layers=lunar,solar,empires');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await openLayers(page);
  const source = page.getByLabel('Borders from');
  await expect(source).toHaveValue('cliopatria');
  await expect(globe).toHaveAttribute('data-ohm-borders', 'off');

  await source.selectOption('both');
  await expect(page).toHaveURL(/borders=both/);
  await expect(globe).toHaveAttribute('data-ohm-borders', /^[1-9]\d*$/);
  await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  await openSources(page);
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
  await page.goto('./?t=-762-06-15T12:00&cam=35,43,3&layers=lunar,solar,empires');
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
});

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

test('deep time colours the globe by temperature, with the global mean and its caveats', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
  await showDeepDetails(page);
  const globe = page.getByTestId('globe');
  const toggle = page.getByRole('button', { name: 'Temperature', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
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

  await page.getByRole('button', { name: 'Temperature', exact: true }).click();
  await expect(globe).toHaveAttribute('data-temperature', 'off');
  await expect(page.locator('.temperature-legend')).toBeHidden();
  expect(problems).toEqual([]);
});

test('deep time charts sea level by four reconstructions, side by side', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
  await showDeepDetails(page);
  const toggle = page.getByRole('button', { name: 'Sea level', exact: true });
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

test('deep time narrows to the ice ages, in thousands of years', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250&layers=sealevel');
  await globeRendered(page);
  await showDeepDetails(page);
  await page.getByRole('button', { name: 'Ice ages' }).click();
  // The ice ages open at their oldest moment; then on to the last glacial maximum.
  await expect(page).toHaveURL(/&ma=2\.6&scale=ice/);
  await page.getByLabel('Thousands of years ago').fill('-21');
  await expect(page).toHaveURL(/&ma=0\.021&scale=ice/);
  await expect(page.locator('.hud-date')).toHaveText('21,000 years ago');
  await expect(page.getByTestId('ice-note')).toBeVisible();
  await expect(page.getByLabel('Thousands of years ago')).toHaveValue('-21');
  await expect(page.getByRole('button', { name: 'Temperature', exact: true })).toBeDisabled();
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

  await page.getByRole('button', { name: '540 Myr' }).click();
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

test('deep time outlines a second reconstruction’s continents', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=252');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  const toggle = page.getByRole('button', { name: 'Plates', exact: true });
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

test('before the reconstructions, the reader picks whose hypotheses the globe sketches', async ({
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

test('deep time reaches back 4.6 billion years, sketching hypotheses before the maps', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?ma=250');
  await globeRendered(page);
  await showDeepDetails(page);
  const globe = page.getByTestId('globe');
  await page.getByRole('button', { name: '4.6 Gyr' }).click();
  await expect(page).toHaveURL(/scale=eons/);
  await expect(page.getByTestId('uncharted-note')).toBeHidden();

  // Before the elevation maps reach, no map: a sketch of a hypothesis, which says so.
  await page.goto('./?ma=3000&scale=eons');
  await globeRendered(page);
  await showDeepDetails(page);
  await expect(page.locator('.hud-date')).toHaveText('3,000 million years ago');
  await expect(page.locator('.hud-detail')).toHaveText('Mesoarchean era · Archean eon');
  await expect(globe).toHaveAttribute('data-uncharted', 'true');
  await expect(page.getByTestId('sketch-headline')).toContainText('Sketch, not a map');
  await expect(page.getByRole('button', { name: 'Temperature', exact: true })).toBeDisabled();

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

  await page.getByRole('button', { name: '540 Myr' }).click();
  await expect(page).toHaveURL(/&ma=540(&|$)/);
  await expect(globe).toHaveAttribute('data-uncharted', 'false');
  expect(problems).toEqual([]);
});

test('tapping the Sun in the sky closes in on it, then goes to it up close', async ({ page }) => {
  const problems = collectProblems(page);
  const sky = page.getByTestId('sky');
  await test.step('Given the sky over Babylon at noon, the Sun high', async () => {
    await page.goto('./?mode=sky&t=2025-03-20T09:00&loc=32.5422,44.4209&look=180,45,90');
    await skyRendered(page);
    await expect(sky).toHaveAttribute('data-sun-at', /^\d+,\d+$/);
  });
  await test.step('When they tap the Sun', async () => {
    const at = (await sky.getAttribute('data-sun-at'))?.split(',').map(Number) ?? [];
    const box = await sky.boundingBox();
    if (box === null) throw new Error('sky has no size');
    await page.mouse.click(box.x + (at[0] ?? 0), box.y + (at[1] ?? 0));
  });
  await test.step('Then the view closes in on it, its disc half the view, and goes to it up close', async () => {
    await expect(page).toHaveURL(/look=\d+\.\d,\d+\.\d,1\.\d/);
    await expect(page).toHaveURL(/mode=globe/);
    await expect(page).toHaveURL(/focus=sun/);
  });
  expect(problems).toEqual([]);
});

test('tapping a planet in the sky goes to it up close, and the way back faces it', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const sky = page.getByTestId('sky');
  const mars = sky.locator('.sky-label.is-planet', { hasText: /^Mars$/ });
  await test.step('Given the sky over Kansas before dawn, Mars up in the south-east', async () => {
    const link = './?mode=sky&t=2026-11-04T10:59&loc=38.62,-100.35';
    await page.goto(`${link}&look=135,25,90`);
    await skyRendered(page);
    // Facing it, whatever the screen's width: the sky reports where each planet stands.
    const report = (await sky.getAttribute('data-planets')) ?? '';
    const [, altitude, azimuth] = /Mars:([-\d.]+):([-\d.]+)/.exec(report) ?? [];
    expect(Number(altitude)).toBeGreaterThan(10);
    await page.goto(`${link}&look=${azimuth ?? ''},${altitude ?? ''},60`);
    await skyRendered(page);
    await expect(mars).toBeVisible();
  });
  await test.step('When they tap Mars', async () => {
    // A label stands at its planet's point on screen.
    const at = await mars.evaluate((label) => {
      const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(label.style.transform);
      return [Number(match?.[1]), Number(match?.[2])];
    });
    const box = await sky.boundingBox();
    if (box === null) throw new Error('sky has no size');
    await page.mouse.click(box.x + (at[0] ?? 0), box.y + (at[1] ?? 0));
  });
  await test.step('Then the space view shows Mars up close, wearing its map', async () => {
    await expect(page).toHaveURL(/focus=mars/);
    await expect(page.getByTestId('body-bar')).toContainText('Mars');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-planet-map', 'mars', {
      timeout: 30_000,
    });
  });
  await test.step('When they go back to the sky', async () => {
    await page.getByRole('button', { name: 'Sky', exact: true }).click();
    await skyRendered(page);
  });
  await test.step('Then the sky faces Mars, closed in on it', async () => {
    await expect(page).toHaveURL(/look=1\d\d\.\d,\d+\.\d,4\.0/);
    await expect(mars).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('no page says null, undefined or NaN where words should be', async ({ page }) => {
  // Six full page loads in one test: software-rendered CI browsers need the room.
  test.setTimeout(60_000);
  const pages = [
    // The Sun close up during the eclipse of 763 BCE, where a stray "null" was once reported.
    './?t=-0762-06-15T08:37Z&cal=julian&loc=36.3594,43.1529&cam=-21.7915,-64.9571,4.91&focus=sun&layers=lunar,solar,orbits&sel=solar:-0762-06-15',
    './?t=-499-06-01T12:00&layers=lunar,solar,empires,ways,genomes,volcanoes',
    './?ma=0.021&scale=ice&layers=humans,sealevel,air',
    './?ma=250&scale=all&layers=temperature,plates,fossils,impacts',
    './?ma=3000&scale=eons',
    './?t=2024-04-08T18:17&cam=60,0,60000',
  ];
  for (const link of pages) {
    await test.step(`Given ${link}`, async () => {
      await page.goto(link);
      await globeRendered(page);
    });
    await test.step('Then no visible text, link or tooltip reads null, undefined or NaN', async () => {
      const found = await page.evaluate(() => {
        const bad = /\b(null|undefined|NaN)\b/;
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const parent = node.parentElement;
          if (parent?.checkVisibility() === true && bad.test(node.textContent ?? '')) {
            out.push(`text: ${(node.textContent ?? '').trim().slice(0, 80)}`);
          }
        }
        for (const element of document.querySelectorAll('[href], [title], [aria-label]')) {
          for (const name of ['href', 'title', 'aria-label']) {
            const value = element.getAttribute(name);
            if (value !== null && bad.test(value)) out.push(`${name}: ${value.slice(0, 80)}`);
          }
        }
        return out;
      });
      expect(found).toEqual([]);
    });
  }
});
