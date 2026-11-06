/**
 * Feature: Travelling through the Holocene. A track above the year bar plays the years by, at a
 * chosen speed, and with the states layer on says which states appear and which are gone.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

const track = 'Holocene';

async function openTrack(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Travel', exact: true }).click();
  await expect(page.getByRole('group', { name: track })).toBeVisible();
}

test('playing history moves through the years and names the states that come and go', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 600 BCE with states and empires on', async () => {
    await page.goto('./?t=-599-06-01T12:00&layers=lunar,solar,empires');
    await globeRendered(page);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  });
  await test.step('When they open the track and play, at 50 years a second', async () => {
    await openTrack(page);
    // Slow enough that the trip to today outlasts the scenario: a faster one can end just as
    // Stop is pressed, and the tap then starts a new trip.
    await expect(bar.getByLabel('Speed')).toHaveValue('50');
    await bar.getByRole('button', { name: 'Travel through the years' }).click();
  });
  await test.step('Then the years run on, and the track names states that appeared or went', async () => {
    // How far it gets depends on how fast the machine draws (a slow one, at 120 Hz, gets
    // through only decades): it moves on, at least.
    const year = () => Number(/[?&]t=(-?\d+)-/.exec(page.url())?.[1]);
    await expect.poll(year, { timeout: 20_000 }).toBeGreaterThan(-590);
    await expect(bar.getByTestId('history-changes')).toHaveText(/^By \d+ (BCE|CE): /, {
      timeout: 20_000,
    });
  });
  await test.step('And the map names them too, as new or gone, for a while', async () => {
    await expect(page.locator('.empire-label.is-new, .empire-label.is-gone').first()).toBeAttached({
      timeout: 20_000,
    });
  });
  await test.step('When they pause, the year stays and the link keeps it', async () => {
    await bar.getByRole('button', { name: 'Stop travelling' }).click();
    const shown = await page.locator('.hud-date').textContent();
    await page.waitForTimeout(500);
    await expect(page.locator('.hud-date')).toHaveText(shown ?? '');
    await expect(page).not.toHaveURL(/t=-599-/);
  });
  expect(problems).toEqual([]);
});

test('the track jumps to any year of the Holocene', async ({ page }) => {
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 2024', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
  });
  await test.step('When they open the track and move it to 1000 CE', async () => {
    await openTrack(page);
    await bar.getByRole('slider', { name: 'Year in the Holocene' }).fill('1000');
  });
  await test.step('Then the globe shows that year', async () => {
    await expect(page).toHaveURL(/t=1000-/);
    await expect(page.getByLabel('Year', { exact: true })).toHaveValue('1000');
  });
  await test.step('And the track brought States and empires on with it', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*empires/);
  });
});

test('travelling lights the whole globe and rests the markers, which return with the borders gone', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('group', { name: track });
  const globe = page.getByTestId('globe');
  await test.step('Given 1000 CE with Impact craters and Rocks on, States and empires off', async () => {
    await page.goto('./?t=1000-06-01T12:00&layers=lunar,solar,impacts,rocks');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-light', 'sun');
    await expect(globe).toHaveAttribute('data-impacts', /^[1-9]\d*$/);
  });
  await test.step('When they open the track', async () => {
    await openTrack(page);
  });
  await test.step('Then there is no night, the craters rest, and states and ways of life are drawn', async () => {
    await expect(globe).toHaveAttribute('data-light', 'even');
    await expect(globe).toHaveAttribute('data-impacts', 'off');
    // Today's rocks say nothing of the year: they rest too.
    await expect(globe).toHaveAttribute('data-rocks', 'off');
    await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
    await expect(globe).toHaveAttribute('data-ways', /^[1-9]\d*$/);
    // Land with no state drawn is explained, not left to look empty.
    await expect(bar.getByTestId('history-blank')).toHaveText(
      'Land with no state drawn was not empty: these sources map states, not every people; the faint shading is how people lived there (ArchaeoGLOBE).',
    );
    await expect(bar.getByTestId('history-changes')).not.toHaveText(
      'Turn on States and empires in Layers to watch them come and go.',
    );
  });
  await test.step('When they close it, night, the craters and their own layers come back', async () => {
    await bar.getByRole('button', { name: 'Close the track' }).click();
    await expect(globe).toHaveAttribute('data-light', 'sun');
    await expect(globe).toHaveAttribute('data-impacts', /^[1-9]\d*$/);
    await expect(page).not.toHaveURL(/layers=[a-z,]*empires/);
    await expect(globe).toHaveAttribute('data-ways', 'off');
    await expect(globe).toHaveAttribute('data-rocks', 'on');
  });
  expect(problems).toEqual([]);
});

test('the track goes with the Holocene into deep time', async ({ page }) => {
  await page.goto('./?ma=250');
  await globeRendered(page);
  await expect(page.getByRole('group', { name: track })).toBeHidden();
});

test('the track opens from the year bar and folds away again', async ({ page }) => {
  const bar = page.getByRole('group', { name: track });
  await test.step('Given the globe in 2024, with the track folded away', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
    await expect(bar).toBeHidden();
  });
  await test.step('When they open it and close it', async () => {
    await openTrack(page);
    await bar.getByRole('button', { name: 'Close the track' }).click();
  });
  await test.step('Then it folds away, and Travel says so', async () => {
    await expect(bar).toBeHidden();
    await expect(page.getByRole('button', { name: 'Travel', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

test('the Holocene reaches back to 9700 BCE, its ΔT growing uncertain', async ({ page }) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 2024', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
  });
  await test.step('When they move the track to its start', async () => {
    await openTrack(page);
    const slider = bar.getByRole('slider', { name: 'Year in the Holocene' });
    await expect(slider).toHaveAttribute('min', '-9699');
    await slider.fill('-9699');
  });
  await test.step('Then it is 9700 BCE, with ΔT in days and hours of doubt', async () => {
    await expect(page).toHaveURL(/t=-9699-/);
    await expect(page.locator('.hud-date')).toHaveText(/9700 BCE$/);
    await expect(page.locator('.hud-detail')).toContainText(
      /ΔT \d+ d( \d+ h)? ± [23] h( \d+ min)?/,
    );
  });
  await test.step('And the year bar says the eclipses are catalogued from 4000 BCE only', async () => {
    await expect(page.locator('.eclipse-list')).toContainText(
      'Eclipses are catalogued from 4000 BCE',
    );
  });
  expect(problems).toEqual([]);
});

test('while travelling, the states are shaded over the evenly lit globe, not only named', async ({
  page,
}) => {
  const globe = page.getByTestId('globe');
  // The globe alone, names and panels set aside, once it has settled where the panels leave it.
  const ground = async () => {
    const shot = () =>
      globe.screenshot({
        style: '.empire-labels, .hud, .bottom, .layers-dialog { visibility: hidden !important; }',
      });
    let last = await shot();
    for (let tries = 0; tries < 20; tries += 1) {
      await page.waitForTimeout(250);
      const next = await shot();
      if (next.equals(last)) return next;
      last = next;
    }
    return last;
  };
  await test.step('Given 1113 CE with the track open, which brings the states', async () => {
    await page.goto('./?t=1113-06-01T12:00&layers=lunar,solar&cam=20.0000,0.0000,3.00');
    await globeRendered(page);
    await openTrack(page);
    await expect(globe).toHaveAttribute('data-light', 'even');
    await expect(globe).toHaveAttribute('data-empires', /^[1-9]\d*$/);
    // The bar below changes with the states (it offers "Seen from"); out of the way, the globe
    // keeps one place for both pictures.
    await page.addStyleTag({ content: '.bottom { display: none !important; }' });
  });
  const shaded = await ground();
  await test.step('When they turn States and empires off', async () => {
    await openLayers(page);
    await page.getByLabel('States and empires').uncheck();
    await expect(globe).toHaveAttribute('data-empires', 'off');
    // The panel closed again, so the globe sits where it did.
    await page.locator('.layers-dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.layers-dialog')).toBeHidden();
  });
  await test.step('Then the globe looks different: the states were painted on it', async () => {
    const plain = await ground();
    // The share of the picture whose colour moved clearly: the states cover much of it.
    const changed = await page.evaluate(
      async ([before, after]) => {
        const pixels = async (png: string) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          if (context === null) throw new Error('no 2D canvas');
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, image.width, image.height).data;
        };
        const [a, b] = await Promise.all([pixels(before), pixels(after)]);
        let moved = 0;
        for (let at = 0; at < a.length; at += 4) {
          const step = Math.max(
            Math.abs((a[at] ?? 0) - (b[at] ?? 0)),
            Math.abs((a[at + 1] ?? 0) - (b[at + 1] ?? 0)),
            Math.abs((a[at + 2] ?? 0) - (b[at + 2] ?? 0)),
          );
          if (step > 24) moved += 1;
        }
        return moved / (a.length / 4);
      },
      [shaded.toString('base64'), plain.toString('base64')] as const,
    );
    expect(changed).toBeGreaterThan(0.05);
  });
});

test('travelling shows the ice sheets and the sea level of the year, and they go with the track', async ({
  page,
}) => {
  const bar = page.getByRole('group', { name: track });
  const globe = page.getByTestId('globe');
  await test.step('Given 9000 BCE', async () => {
    await page.goto('./?t=-8999-06-01T12:00&layers=lunar,solar');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-ice', 'off');
  });
  await test.step('When they open the track', async () => {
    await openTrack(page);
  });
  await test.step('Then the ice of then lies on the land, and the sea stands lower', async () => {
    await expect(globe).toHaveAttribute('data-ice', /icesheets\/(7500|10000)\.png/);
    await expect(globe).toHaveAttribute('data-sea-level', /^-\d+\.\d$/);
    await expect(bar.getByTestId('history-earth')).toHaveText(
      /^Sea level \d+ m below today’s \(.+\); shelf it left bare is tinted sand\. Ice sheets: PaleoMIST/,
    );
  });
  await test.step('When they close it, today’s Earth is back', async () => {
    await bar.getByRole('button', { name: 'Close the track' }).click();
    await expect(globe).toHaveAttribute('data-ice', 'off');
    await expect(globe).toHaveAttribute('data-shelf', 'off');
  });
});

test('as the years play, state names stay put on the map, and only a few light up', async ({
  page,
}) => {
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 800 CE with the track open, its names shown', async () => {
    await page.goto('./?t=800-06-01T12:00&layers=lunar,solar&cam=45.0000,20.0000,3.00');
    await globeRendered(page);
    await openTrack(page);
    await expect(page.locator('.empire-label:not([hidden])').first()).toBeVisible();
  });
  await test.step('When they travel at 200 years a second', async () => {
    await bar.getByLabel('Speed').selectOption('200');
    await bar.getByRole('button', { name: 'Travel through the years' }).click();
  });
  await test.step('Then the names never all go dark, and at most four are new or gone', async () => {
    // Sampled between tasks, as the page is painted: names made anew each year once went
    // unseen for a frame, again and again, and read as flicker.
    const samples = await page.evaluate(async () => {
      const seen: { shown: number; lit: number }[] = [];
      // For three seconds, however many samples a slow machine gets in that time.
      const end = performance.now() + 3000;
      while (performance.now() < end) {
        await new Promise((done) => setTimeout(done, 60));
        const labels = [
          ...document.querySelectorAll<HTMLElement>('.empire-labels > .empire-label'),
        ].filter((label) => label.closest('.genome-cells, .impact-marks, .volcano-marks') === null);
        const shown = labels.filter((label) => label.hidden === false);
        seen.push({
          shown: shown.length,
          lit: shown.filter((label) => /\bis-(new|gone)\b/.test(label.className)).length,
        });
      }
      return seen;
    });
    expect(Math.min(...samples.map(({ shown }) => shown))).toBeGreaterThan(0);
    expect(Math.max(...samples.map(({ lit }) => lit))).toBeLessThanOrEqual(4);
  });
});
