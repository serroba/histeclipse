import deltaTTable from '../public/data/delta-t.json' with { type: 'json' };
import { subsolarPoint } from '../src/astro/sun';
import { parseViewState } from '../src/state/url';
import { momentJulianDay } from '../src/state/viewState';
import { DeltaT } from '../src/time/deltaT';
import {
  collectProblems,
  expect,
  freeSpot,
  globeRendered,
  GPU,
  LIVE,
  LIVE_GPU,
  pickSpan,
  test,
} from './support';

// Commit SHA the deployment is expected to serve. Empty or unset skips the release check.
const expectedVersion = process.env['EXPECTED_VERSION'] ?? '';

// The 621 BCE lunar eclipse from Babylon, as someone might share it.
const SHARED_LINK = '?t=-620-04-22T07:20&loc=32.5422,44.4209&cam=30,40,3&sel=lunar:-0620-04-22';

test('loads the globe without errors or failed requests @acceptance', LIVE, async ({ page }) => {
  const problems = collectProblems(page);
  const response = await page.goto('./');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('histeclipse');
  await expect(page.getByRole('heading', { level: 1, name: 'histeclipse' })).toBeVisible();
  await globeRendered(page);
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
});

test('draws the Earth, not an empty canvas @acceptance', LIVE_GPU, async ({ page }) => {
  await page.goto('./');
  await globeRendered(page);
  // A screenshot captures what is on screen without reading the WebGL buffer back. An empty
  // dark canvas compresses to a few KB of PNG; a textured, lit globe to hundreds of KB.
  const png = await page.getByTestId('globe').locator('canvas').screenshot();
  expect(png.byteLength).toBeGreaterThan(60_000);
});

test('the years draw today’s sea ice, by the time of year', GPU, async ({ page }) => {
  const globe = page.getByTestId('globe');
  // Mid-March: the north’s March ice (and the south's least), at today’s sea level.
  await page.goto('./?t=2025-03-16T12:00');
  await globeRendered(page);
  await expect(globe).toHaveAttribute(
    'data-sea-ice',
    /^1\.00 .*seaice\/mpi-esm1-2-lr-most\.png 0\.00$/,
  );
  // Mid-September: the north’s September ice.
  await page.goto('./?t=2025-09-15T12:00');
  await globeRendered(page);
  await expect(globe).toHaveAttribute('data-sea-ice', /^0\.00 /);
});

test('a shared link reproduces the view it describes @acceptance', LIVE, async ({ page }) => {
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

test('dragging the globe updates the camera in the URL @acceptance', async ({ page }) => {
  // On CI's software-rendered phone, drawing the globe takes most of 30 s before the drag starts.
  test.slow();
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

test('a one-finger swipe rotates the globe on touch screens @mobile', async ({
  page,
  context,
}, info) => {
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

test('the date panel stays readable on a phone @mobile', async ({ page }, info) => {
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

test('the panels fold away for a full view and come back @acceptance', async ({ page }) => {
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

test('a first visit is welcomed once, with a place to start @acceptance', async ({ page }) => {
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

test('controls are large enough to tap and stay on screen @mobile', async ({ page }) => {
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

test('page fits the viewport without horizontal scroll @mobile', async ({ page }) => {
  await page.goto('./');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('serves the expected release', LIVE, async ({ page }) => {
  test.skip(expectedVersion === '', 'EXPECTED_VERSION is not set');
  await page.goto('./');
  await expect(page.locator('meta[name="histeclipse-version"]')).toHaveAttribute(
    'content',
    expectedVersion,
  );
});

test('the live site is served with its security and caching headers', LIVE, async ({ page }) => {
  // Cloudflare sets these in front of GitHub Pages (#240); a local preview has none of them.
  test.skip(process.env['BASE_URL'] === undefined, 'only the live site sets these headers');
  const scripts: string[] = [];
  page.on('response', (response) => {
    if (/\/assets\/[^/]+\.js$/.test(response.url())) scripts.push(response.url());
  });
  const response = await page.goto('./');
  const headers = response?.headers() ?? {};
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['strict-transport-security']).toMatch(/max-age=\d+/);
  expect(headers['permissions-policy']).toContain('camera=()');
  // The page is checked for a new release on every visit; its hashed parts are kept a year.
  expect(headers['cache-control']).toBe('no-cache');
  await globeRendered(page);
  expect(scripts.length).toBeGreaterThan(0);
  const script = await page.request.get(scripts[0] ?? '');
  expect(script.headers()['cache-control']).toMatch(/max-age=31536000/);
});

test(
  'a page opened before a deploy reloads once when a late part of it is gone',
  LIVE,
  async ({ page }) => {
    // Two whole page loads, the second up to 30 s on a busy machine.
    test.slow();
    // Each request for the page itself, rather than each load event: on the live site a reload
    // can start before the first page's load event, which then never fires (#306).
    let loads = 0;
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) loads += 1;
    });
    await test.step('Given the sky’s code gone for the page opened before a deploy', async () => {
      // Every request from the first page fails (the chunk's preload and its import), as on the
      // server after a deploy; the reloaded page, the new build, finds it.
      await page.route('**/assets/skyScene-*.js', async (route) => {
        if (loads < 2) {
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
  },
);

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

test('Back steps through what the reader did, and Forward returns @acceptance @mobile', async ({
  page,
}) => {
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
