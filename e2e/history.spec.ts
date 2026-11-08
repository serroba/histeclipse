/**
 * Feature: Travelling through the Holocene. The year bar plays the years by, at a chosen speed;
 * playing turns on the travel view, and with the states layer on the bar says which states
 * appear and which are gone.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

const track = 'Holocene';

/** Turn the travel view on, as playing does, and pause there. */
async function openTrack(page: Page): Promise<void> {
  const bar = page.getByRole('group', { name: track });
  await bar.getByRole('button', { name: 'Travel through the years' }).click();
  await bar.getByRole('button', { name: 'Stop travelling' }).click();
  await expect(bar.getByRole('button', { name: 'Leave the travel view' })).toBeVisible();
}

test('playing history moves through the years and names the states that come and go', async ({
  page,
}) => {
  // Several steps each wait up to 20 s for the years to move: on a runner that renders in
  // software they can take most of the usual 30 s between them (#292).
  test.slow();
  const problems = collectProblems(page);
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 600 BCE with states and empires on', async () => {
    await page.goto('./?t=-599-06-01T12:00&layers=lunar,solar,empires');
    await globeRendered(page);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-empires', /^[1-9]\d*$/);
    // Nothing has changed yet, so the track says nothing, rather than what it would say.
    await expect(bar.getByTestId('history-changes')).toBeHidden();
  });
  await test.step('When they play, at 50 years a second', async () => {
    // Slow enough that the trip to today outlasts the scenario: a faster one can end just as
    // Stop is pressed, and the tap then starts a new trip.
    await expect(
      page.getByRole('navigation', { name: 'Year and eclipses' }).getByLabel('Speed'),
    ).toHaveValue('50');
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
    // Once it has stopped: a frame already on its way may still move the year once.
    await expect(bar.getByRole('button', { name: 'Travel through the years' })).toBeVisible();
    await page.waitForTimeout(300);
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
  await test.step('When they move the bar to 1000 CE', async () => {
    await bar.getByRole('slider', { name: 'Year in the Holocene' }).fill('1000');
  });
  await test.step('Then the globe shows that year', async () => {
    await expect(page).toHaveURL(/t=1000-/);
    await expect(page.getByLabel('Year', { exact: true })).toHaveValue('1000');
  });
  await test.step('And only scrubbing, not playing, the day and night stay', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute('data-light', 'sun');
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
    await expect(page.getByTestId('history-blank')).toHaveText(
      'Land with no state drawn was not empty: these sources map states, not every people; the faint shading is how people lived there (ArchaeoGLOBE).',
    );
    await expect(bar.getByTestId('history-changes')).not.toHaveText(
      'Turn on States and empires in Layers to watch them come and go.',
    );
  });
  await test.step('When they close it, night, the craters and their own layers come back', async () => {
    await bar.getByRole('button', { name: 'Leave the travel view' }).click();
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

test('playing starts the travel view, and its chip leaves it for today’s Earth', async ({
  page,
}) => {
  const bar = page.getByRole('group', { name: track });
  const globe = page.getByTestId('globe');
  await test.step('Given the globe in 1000 CE, day and night drawn', async () => {
    await page.goto('./?t=1000-06-01T12:00');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-light', 'sun');
    await expect(bar.getByRole('button', { name: 'Leave the travel view' })).toBeHidden();
  });
  await test.step('When they play and pause, the travel view stays on', async () => {
    await openTrack(page);
    await expect(globe).toHaveAttribute('data-light', 'even');
  });
  await test.step('When they leave it, day and night come back', async () => {
    await bar.getByRole('button', { name: 'Leave the travel view' }).click();
    await expect(globe).toHaveAttribute('data-light', 'sun');
    await expect(bar.getByRole('button', { name: 'Leave the travel view' })).toBeHidden();
  });
});

test('the Holocene reaches back to 9700 BCE, its ΔT growing uncertain', async ({ page }) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 2024', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
  });
  await test.step('When they move the bar to its start', async () => {
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
  // It waits for the globe to settle by comparing screenshots, twice: on a runner that renders
  // in software, each takes a second or more, past the usual budget.
  test.slow();
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
    await page.getByRole('checkbox', { name: 'States and empires' }).uncheck();
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
    await expect(page.getByTestId('history-earth')).toHaveText(
      /^Sea level \d+ m below today’s \(.+\); shelf it left bare is tinted sand\. Ice sheets: PaleoMIST/,
    );
  });
  await test.step('When they close it, today’s Earth is back', async () => {
    await bar.getByRole('button', { name: 'Leave the travel view' }).click();
    await expect(globe).toHaveAttribute('data-ice', 'off');
    await expect(globe).toHaveAttribute('data-shelf', 'off');
  });
});

test('as the years play, state names stay put on the map, and only a few light up', async ({
  page,
}) => {
  // The years play for a while to watch the names: slow on a runner that renders in software.
  test.slow();
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 800 CE with the track open, its names shown', async () => {
    await page.goto('./?t=800-06-01T12:00&layers=lunar,solar&cam=45.0000,20.0000,3.00');
    await globeRendered(page);
    await openTrack(page);
    await expect(page.locator('.empire-label:not([hidden])').first()).toBeVisible();
  });
  await test.step('When they travel at 200 years a second', async () => {
    await page
      .getByRole('navigation', { name: 'Year and eclipses' })
      .getByLabel('Speed')
      .selectOption('200');
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

test('carbon-14 in the air runs under the years, its spikes and plateau marked and sourced', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const strip = page.getByTestId('radiocarbon-strip');
  await test.step('Given the years with Carbon-14 in the air on, standing in Europe', async () => {
    await page.goto('./?t=-0700-06-01T12:00&loc=48,10&layers=lunar,solar,radiocarbon');
    await globeRendered(page);
  });
  await test.step('Then the northern curve runs under the slider, the events marked', async () => {
    await expect(strip).toBeVisible({ timeout: 20_000 });
    await expect(strip).toContainText('IntCal20');
    await expect(strip.locator('[data-event="Miyake event, 774/775 CE"]')).toHaveCount(1);
    await expect(strip.locator('[data-event="The Hallstatt plateau"]')).toHaveCount(1);
  });
  await test.step('When they ask where it comes from', async () => {
    await strip.getByRole('button', { name: 'Why: Carbon-14 in the air' }).click();
  });
  await test.step('Then the why says why a date is a range, and links the curve and the eruptions', async () => {
    const sheet = page.getByRole('dialog', { name: 'Carbon-14 in the air' });
    await expect(sheet).toContainText('Hallstatt plateau');
    await expect(sheet.getByRole('link', { name: 'IntCal20', exact: true })).toHaveAttribute(
      'href',
      'https://doi.org/10.1017/RDC.2020.41',
    );
    await expect(sheet.getByRole('link', { name: 'HolVol', exact: true })).toHaveAttribute(
      'href',
      'https://doi.org/10.5194/essd-14-3167-2022',
    );
  });
  await test.step('And the eruptions the ice cores record lie under it, Tambora named', async () => {
    const eruptions = page.getByTestId('radiocarbon-eruptions');
    await expect(eruptions).toHaveAttribute('data-count', /^1\d{3}$/, { timeout: 20_000 });
    await expect(eruptions.locator('[data-eruption="Tambora"] title')).toHaveText(
      /^1815 CE: Tambora, 3\d\.\d ± \d+\.\d Tg of sulfur into the stratosphere\./,
    );
    await expect(eruptions.locator('[data-eruption="Samalas"] title')).toContainText('1257');
  });
  await test.step('When they stand in the southern hemisphere', async () => {
    await page.goto('./?t=-0700-06-01T12:00&loc=-34,151&layers=lunar,solar,radiocarbon');
    await globeRendered(page);
  });
  await test.step('Then the southern curve is drawn', async () => {
    await expect(strip).toContainText('SHCal20', { timeout: 20_000 });
  });
  expect(problems).toEqual([]);
});

test('“How was this dated?” carries a radiocarbon age across the curve to its ranges', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const dialog = page.getByRole('dialog', { name: 'How was this dated?' });
  await test.step('Given Carbon-14 in the air on, standing in Europe', async () => {
    await page.goto('./?t=-0700-06-01T12:00&loc=48,10&layers=lunar,solar,radiocarbon');
    await globeRendered(page);
  });
  await test.step('When they ask how a date is found', async () => {
    await page.getByRole('button', { name: 'How was this dated?' }).click();
  });
  await test.step('Then an Iron Age age spreads over the Hallstatt plateau, in four ranges', async () => {
    await expect(dialog.getByTestId('dating-left')).toContainText('73.7% of the carbon-14');
    await expect(dialog.getByTestId('dating-result')).toContainText('it fits 4 stretches of years');
    await expect(dialog.getByTestId('dating-ranges').locator('li')).toHaveCount(4);
    await expect(dialog.getByTestId('dating-ranges')).toContainText('591–414 BCE');
  });
  await test.step('When they try one on a steep stretch', async () => {
    await dialog.getByRole('button', { name: /^On a steep stretch/ }).click();
  });
  await test.step('Then it fits one stretch of years', async () => {
    await expect(dialog.getByTestId('dating-result')).toContainText('one stretch of years');
    await expect(dialog.getByTestId('dating-ranges').locator('li')).toHaveText([
      '1894–1744 BCE 95%',
    ]);
  });
  await test.step('When they type their own age', async () => {
    await dialog.getByRole('spinbutton', { name: 'Radiocarbon age, years BP' }).fill('1000');
    await dialog.getByRole('spinbutton', { name: 'Radiocarbon age, years BP' }).press('Enter');
  });
  await test.step('Then it is calibrated too', async () => {
    await expect(dialog.getByTestId('dating-ranges')).toContainText('994–1048 CE');
  });
  await test.step('When they try the Thera eruption, a real date on a plateau', async () => {
    await dialog.getByRole('button', { name: /^Thera \(Santorini\)/ }).click();
  });
  await test.step('Then it fits several stretches, the dispute is said, and its source named', async () => {
    await expect(dialog.getByTestId('dating-ranges').locator('li')).toHaveCount(5);
    await expect(dialog.getByTestId('dating-ranges')).toContainText('1644–1609 BCE 53%');
    await expect(dialog.getByTestId('dating-note')).toContainText('still debated');
    await expect(dialog.getByTestId('dating-note')).toContainText('van der Plicht et al. 2020');
  });
  await test.step('When they try Changbaishan, dated by a spike', async () => {
    await dialog.getByRole('button', { name: /^Changbaishan/ }).click();
  });
  await test.step('Then it is dated to the year, by counting rings, with no ranges', async () => {
    await expect(dialog.getByTestId('dating-result')).toHaveText(
      '2. The tree died in 946 CE, to the year.',
    );
    await expect(dialog.getByTestId('dating-ranges').locator('li')).toHaveCount(0);
    await expect(dialog.getByTestId('dating-note')).toContainText('775 CE');
  });
  await test.step('When they type their own age again, the example’s note goes', async () => {
    await dialog.getByRole('spinbutton', { name: 'Radiocarbon age, years BP' }).fill('2000');
    await dialog.getByRole('spinbutton', { name: 'Radiocarbon age, years BP' }).press('Enter');
    await expect(dialog.getByTestId('dating-note')).toBeHidden();
    await expect(dialog.getByTestId('dating-ranges').locator('li')).not.toHaveCount(0);
  });
  expect(problems).toEqual([]);
});
