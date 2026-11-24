/**
 * The site's views, compared between two builds (#628): each view's screenshot and the globe's
 * data attributes, captured from a base build into a folder, then from a branch's build and
 * compared with them, so a change to what is drawn shows itself before it ships. Run with
 * `pnpm compare:views <base-url> <branch-url>` (scripts/compareViews.mjs), or in CI's
 * "Visual comparison" workflow, which builds `main` and the pull request.
 *
 * A capture waits until the view stops changing: Playwright takes screenshots until two in a row
 * match, so maps that arrive in any order are all in. Views that never settle (anything that
 * plays, the ocean currents' particles) are left out.
 */

import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

/** What the captures hide: what differs between two captures of the same build. */
const CAPTURE_CSS = fileURLToPath(new URL('capture.css', import.meta.url));

/** Each view: a name and its link, every one with its own time and camera. */
const VIEWS: readonly (readonly [string, string])[] = [
  ['today', '?t=2024-04-08T18:17&cam=20,-90,3&layers='],
  ['eclipse-solar', '?t=2024-04-08T18:17&sel=solar:2024-04-08&layers=eclipses&cam=25,-100,3'],
  ['eclipse-lunar', '?t=2025-03-14T06:59&sel=lunar:2025-03-14&layers=eclipses&cam=0,-100,3'],
  ['states', '?t=1500-06-01T12:00&layers=empires&cam=40,20,3'],
  ['ways', '?t=-3000-06-01T12:00&layers=ways&cam=30,40,3'],
  ['enso', '?t=1998-01-15T12:00&layers=enso&cam=0,-150,2.6'],
  ['enso-states-ways', '?t=1998-01-15T12:00&layers=empires,enso,ways&cam=0,-150,2.6'],
  ['ocean-temp', '?t=1997-12-15T12:00&layers=oceanTemp&cam=0,-140,3'],
  ['ozone', '?t=2006-10-01T12:00&layers=ozone&cam=-70,40,3'],
  ['ice-age', '?ma=0.021&scale=ice&cam=40,0,3'],
  ['ice-temp', '?ma=0.021&scale=ice&layers=temperature&cam=40,0,3'],
  ['ice-humans', '?ma=0.06&scale=ice&layers=humans&cam=20,40,3'],
  ['deep-plates', '?ma=66&scale=all&layers=plates&cam=20,-70,3'],
  ['deep-temp', '?ma=66&scale=all&layers=temperature&cam=20,-70,3'],
  ['deep-impacts', '?ma=66&scale=all&layers=impacts&cam=20,-70,3'],
  ['deep-sealevel', '?ma=250&layers=sealevel&cam=0,30,3'],
  ['moon', '?t=2025-01-10T12:00&focus=moon&cam=0,0,6'],
  ['sky', '?mode=sky&t=2024-04-08T18:17&loc=25.29,-104.14'],
  ['sky-babylon', '?mode=sky&t=-0567-03-20T19:00&loc=32.5422,44.4209'],
];

/** The globe's data attributes, sorted: what it says it drew, in an order that does not vary. */
async function attributes(page: Page): Promise<string> {
  const found = await page
    .getByTestId('globe')
    .evaluate((element) =>
      Object.entries((element as HTMLElement).dataset).sort(([a], [b]) => a.localeCompare(b)),
    );
  return `${found.map(([key, value]) => `${key}=${value ?? ''}`).join('\n')}\n`;
}

for (const [name, link] of VIEWS) {
  test(name, async ({ page }) => {
    await page.goto(`./${link}`);
    if (!link.includes('mode=sky')) {
      await expect(page.getByTestId('globe')).toHaveAttribute('data-rendered', 'true', {
        timeout: 60_000,
      });
    }
    // Only what the site draws: the pointer out of the way, the text caret hidden.
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      caret: 'hide',
      stylePath: CAPTURE_CSS,
      // Text's antialiasing comes out a shade different now and then on a busy machine: a few
      // pixels along the date's edges. A change to what is drawn moves hundreds or more.
      maxDiffPixels: 20,
      threshold: 0.05,
      timeout: 90_000,
    });
    expect(await attributes(page)).toMatchSnapshot(`${name}.txt`);
  });
}
