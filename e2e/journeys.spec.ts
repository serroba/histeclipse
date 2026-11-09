/**
 * Journeys: what a reader does from landing to leaving, across features. Each feature has its
 * own scenarios; these check the features still work together, in the order people use them.
 * The catalogue is in `e2e/README.md`.
 */

import {
  collectProblems,
  expect,
  globeRendered,
  openLayers,
  openSources,
  pickSpan,
  test,
} from './support';

test('a newcomer starts with a famous eclipse and looks at the sky that day', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given a first visit', async () => {
    await page.goto('./');
    await globeRendered(page);
  });
  await test.step('When they start with a famous eclipse and pick Thales', async () => {
    await page
      .getByTestId('welcome')
      .getByRole('button', { name: 'Start with a famous eclipse' })
      .click();
    await page
      .getByRole('dialog', { name: 'Famous eclipses' })
      .getByRole('button', { name: /The eclipse of Thales/ })
      .click();
  });
  await test.step('Then they land on it, with its history and the debate', async () => {
    await expect(page).toHaveURL(/sel=solar:-0584-05-28/);
    await expect(page.locator('.famous-card-title')).toHaveText('The eclipse of Thales');
    await expect(page.locator('.famous-card-debate')).toContainText('Debated');
  });
  await test.step('When they look at the sky from there', async () => {
    await page.getByRole('button', { name: 'Sky' }).click();
  });
  await test.step('Then the sky draws, and Orbit brings the globe back', async () => {
    await expect(page.getByTestId('sky')).toHaveAttribute('data-rendered', 'true');
    await page.getByRole('button', { name: 'Orbit' }).click();
    await globeRendered(page);
    await expect(page).toHaveURL(/sel=solar:-0584-05-28/);
  });
  expect(problems).toEqual([]);
});

test('a historian follows the eclipses seen from one empire', async ({ page }) => {
  const problems = collectProblems(page);
  const seen = page.getByLabel('Seen from', { exact: true });
  await test.step('Given the globe in 763 BCE', async () => {
    await page.goto('./?t=-762-06-15T12:00&cam=35,43,3');
    await globeRendered(page);
  });
  await test.step('When they turn on states and empires and pick Assyria', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'States and empires' }).check();
    await page.keyboard.press('Escape');
    await seen.selectOption('Neo-Assyrian Empire');
  });
  await test.step('Then the eclipses seen from there are marked', async () => {
    await expect(page).toHaveURL(/seen=Neo-Assyrian\+Empire/);
    await expect(page.getByTestId('seen-status')).toHaveText(/^[1-9]\d* of \d+ seen$/);
  });
  await test.step('When they step to the next one seen from there', async () => {
    await page.getByRole('button', { name: 'Next eclipse seen from there' }).click();
  });
  await test.step('Then an eclipse is picked, and the link holds it all', async () => {
    await expect(page).toHaveURL(/sel=(lunar|solar):/);
    const link = page.url();
    await page.goto(link);
    await globeRendered(page);
    await expect(seen).toHaveValue('Neo-Assyrian Empire');
    await expect(page).toHaveURL(/layers=[a-z,]*empires/);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  });
  expect(problems).toEqual([]);
});

test('a reader travels into the ice ages and back to the day they left', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given a reader at the 2024 eclipse', async () => {
    await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
    await globeRendered(page);
  });
  await test.step('When they pick the ice ages, which open at their oldest, go to 21,000 years ago and play', async () => {
    await pickSpan(page, 'Ice ages');
    await expect(page.locator('.hud-date')).toHaveText('2,600,000 years ago');
    await page.getByRole('slider', { name: 'Thousands of years ago' }).fill('-21');
    await expect(page.locator('.hud-date')).toHaveText('21,000 years ago');
    await page.getByRole('button', { name: 'Play' }).click();
  });
  await test.step('Then time runs to the present and stops there', async () => {
    // A slow machine runs fewer frames a second, so the trip can take a while.
    await expect(page.locator('.hud-date')).toHaveText('Today', { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });
  await test.step('When they go back to the years', async () => {
    await pickSpan(page, 'Years');
  });
  await test.step('Then the day and the eclipse they left are there', async () => {
    await expect(page.locator('.hud-date')).toHaveText('8 April 2024 CE');
    await expect(page).toHaveURL(/sel=solar:2024-04-08/);
    await expect(page).not.toHaveURL(/ma=/);
  });
  expect(problems).toEqual([]);
});

test('a link someone shares opens exactly what they saw', async ({ page }) => {
  const problems = collectProblems(page);
  const shared =
    './?t=-584-05-28T14:26&sel=solar:-0584-05-28&layers=lunar,solar,empires&borders=both';
  await test.step('Given a link to the eclipse of Thales with both sources of borders', async () => {
    await page.goto(shared);
    await globeRendered(page);
  });
  await test.step('Then the eclipse, its history and both sources of borders show', async () => {
    await expect(page.locator('.famous-card-title')).toHaveText('The eclipse of Thales');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-empires', /^[1-9]\d*$/);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-ohm-borders', /^[1-9]\d*$/);
    await openLayers(page);
    await expect(page.getByLabel('Borders from')).toHaveValue('both');
  });
  expect(problems).toEqual([]);
});

test('from anywhere, the name leads back to the start', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given deep time, 66 million years ago, with layers on', async () => {
    await page.goto('./?ma=66&layers=temperature,impacts');
    await globeRendered(page);
  });
  await test.step('When they follow the name at the top', async () => {
    await page.getByRole('link', { name: 'histeclipse' }).click();
  });
  await test.step('Then they are back at the start, today on the globe, welcomed if this is their first visit', async () => {
    await expect(page.getByTestId('welcome')).toBeVisible();
    await expect(page).not.toHaveURL(/ma=66/);
    await expect(page).not.toHaveURL(/temperature/);
  });
  expect(problems).toEqual([]);
});

test('far out, the planets’ orbits can be drawn round the Sun, and go as the view comes back in', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const orbits = page.getByRole('button', { name: 'Orbits', exact: true });
  await test.step('Given Earth close up, where orbits mean nothing', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
    await expect(orbits).toBeHidden();
  });
  await test.step('When they look from far out, beyond Mars', async () => {
    await page.goto('./?t=2024-04-08T18:17&cam=80.0000,0.0000,300000.00');
    await globeRendered(page);
  });
  await test.step('Then Orbits is offered, and draws Earth’s and the five planets’', async () => {
    await expect(orbits).toBeVisible();
    await expect(orbits).toHaveAttribute('aria-pressed', 'false');
    await orbits.click();
    await expect(orbits).toHaveAttribute('aria-pressed', 'true');
    await expect(globe).toHaveAttribute('data-orbits', '6');
    await expect(page).toHaveURL(/layers=[a-z,]*orbits/);
  });
  await test.step('When they go back to Earth close up, the orbits go and so does the button', async () => {
    await page.goto('./?t=2024-04-08T18:17&layers=lunar,solar,orbits&cam=20.0000,0.0000,3.00');
    await globeRendered(page);
    await expect(orbits).toBeHidden();
    await expect(globe).not.toHaveAttribute('data-orbits', '6');
  });
  expect(problems).toEqual([]);
});

test('links made before one time bar still open what they showed', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given a deep-time link with layers since retired', async () => {
    await page.goto('./?ma=66&scale=all&layers=temperature,terminator,places');
    await globeRendered(page);
  });
  await test.step('Then it opens on its span and moment, with its layer, the retired ones dropped', async () => {
    await expect(page.locator('.hud-date')).toHaveText('66 million years ago');
    await expect(
      page.getByRole('group', { name: 'Time span' }).getByRole('button', { name: '540 Myr' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Temperature', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page).not.toHaveURL(/terminator|places/);
  });
  await test.step('When a link to the ice ages is opened', async () => {
    await page.goto('./?ma=0.021&scale=ice');
    await globeRendered(page);
  });
  await test.step('Then it opens there too', async () => {
    await expect(page.locator('.hud-date')).toHaveText('21,000 years ago');
    await expect(
      page.getByRole('group', { name: 'Time span' }).getByRole('button', { name: 'Ice ages' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  expect(problems).toEqual([]);
});

test('a rail at the side shows how far out the view is, and that the planets are a tap away', async ({
  page,
}, info) => {
  // A long glide, timed by frames: see the wait below.
  test.slow();
  const problems = collectProblems(page);
  const rail = page.getByRole('group', { name: 'Zoom' });
  const globe = page.getByTestId('globe');
  await test.step('Given Earth on the globe', async () => {
    await page.goto('./?t=2024-04-08T18:17&cam=20,0,4.5');
    await globeRendered(page);
  });
  await test.step('Then the rail names its stops out to the planets, and how far the view is', async () => {
    await expect(rail).toBeVisible();
    await expect(
      rail.getByRole('button', { name: 'Zoom to The inner planets, around the Sun' }),
    ).toBeVisible();
    await expect(page.getByTestId('zoom-readout')).toHaveText('29,000 km');
  });
  await test.step('When they tap Planets (on a touch screen, the track beside its name)', async () => {
    const stop = rail.getByRole('button', { name: 'Zoom to The inner planets, around the Sun' });
    if (info.project.name === 'mobile') {
      const name = await stop.boundingBox();
      const track = await page.getByRole('slider', { name: 'Distance' }).boundingBox();
      if (name === null || track === null) throw new Error('no rail');
      await page.touchscreen.tap(track.x + track.width / 2, name.y + name.height / 2);
    } else {
      await stop.click();
    }
  });
  await test.step('Then the view glides out until the planets show, and the link keeps it', async () => {
    // The glide is timed by the frames, and the 120 Hz project's clock moves 1/120 s a frame
    // whatever the real time: on a loaded machine frames come slowly, so it can take a while.
    await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},60000\.00/, { timeout: 45_000 });
    await expect(globe).toHaveAttribute('data-planets', 'on');
    await expect(page.getByTestId('zoom-readout')).toHaveText('2.6 AU');
  });
  await test.step('When they zoom in a step', async () => {
    await rail.getByRole('button', { name: 'Zoom in' }).click();
  });
  await test.step('Then the view comes nearer', async () => {
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('cam')?.split(',')[2]), {
        timeout: 20_000,
      })
      .toBeLessThan(20_000);
  });
  await test.step('And in deep time, where the planets are left out, the rail goes', async () => {
    await pickSpan(page, '540 Myr');
    await expect(rail).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('with the Sun in focus, the rail measures from the Sun and leads back to Earth', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const rail = page.getByRole('group', { name: 'Zoom' });
  const globe = page.getByTestId('globe');
  await test.step('Given the Sun close up', async () => {
    await page.goto('./?t=2024-04-08T18:17&cam=10,20,4&focus=sun');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-focus', 'sun');
  });
  await test.step('Then the rail names the Sun’s stops and reads from the Sun', async () => {
    await expect(rail.getByRole('button', { name: 'Zoom to The whole Sun' })).toBeAttached();
    await expect(rail.getByRole('button', { name: 'Zoom to Out to Saturn' })).toBeAttached();
    await expect(page.getByTestId('zoom-readout')).toHaveText('2,800,000 km');
    await expect(page.getByRole('slider', { name: 'Distance' })).toHaveAttribute(
      'aria-valuetext',
      '2,800,000 km from the Sun',
    );
  });
  await test.step('When they take the way back to Earth', async () => {
    await rail.getByRole('button', { name: 'Back to Earth' }).click();
  });
  await test.step('Then Earth is in focus again, and the way back goes', async () => {
    await expect(globe).toHaveAttribute('data-focus', 'earth');
    await expect(rail.getByRole('button', { name: 'Back to Earth' })).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('away from Earth, the bar speaks of the body in view, and Earth’s own parts rest', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const body = page.getByTestId('body-bar');
  await test.step('Given Earth, with an eclipse year’s list and the ways of life on', async () => {
    await page.goto('./?t=2026-01-10T12:00&layers=lunar,solar,ways');
    await globeRendered(page);
  });
  await test.step('Then the bar is Earth’s: no body line, the year’s eclipses listed', async () => {
    await expect(body).toBeHidden();
    await expect(page.getByRole('list', { name: 'Eclipses this year' })).toBeVisible();
  });
  await test.step('When they look at Jupiter, at opposition that day', async () => {
    await page.goto('./?t=2026-01-10T12:00&cam=10,20,4&focus=jupiter&layers=lunar,solar,ways');
    await globeRendered(page);
  });
  await test.step('Then the bar says where Jupiter is, and the eclipses and ways of life rest', async () => {
    await expect(body).toContainText('Jupiter');
    await expect(page.getByTestId('body-facts')).toHaveText(
      /^4\.2\d AU from Earth, 5\.2\d from the Sun · 100% lit, magnitude −2\.\d · in the evening sky, 1(79|80)° east of the Sun$/,
    );
    await expect(page.getByRole('list', { name: 'Eclipses this year' })).toBeHidden();
    await expect(page.getByTestId('ways-legend')).toBeHidden();
    await expect(page.getByRole('slider', { name: 'Year in the Holocene' })).toBeHidden();
    await expect(page.getByRole('slider', { name: 'Day in Jupiter’s cycle' })).toBeVisible();
  });
  await test.step('And the date panel leaves out Earth’s spans, its layers and the Moon from Earth', async () => {
    await expect(page.getByRole('group', { name: 'Time span' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Layers', exact: true })).toBeHidden();
    const views = page.getByRole('group', { name: 'Viewpoint' });
    await expect(views.getByRole('button', { name: 'Moon from Earth' })).toBeHidden();
    await expect(views.getByRole('button', { name: 'Earth from Jupiter' })).toBeVisible();
  });
  await test.step('When they look at the Moon on a full-Moon day', async () => {
    await page.goto('./?t=2025-11-05T12:00&cam=0,180,3&focus=moon');
    await globeRendered(page);
  });
  await test.step('Then the bar gives its phase and distance, the year’s eclipses, and its book opens the sources', async () => {
    await expect(page.getByTestId('body-facts')).toHaveText(
      /^Full Moon, 100% lit · 357,000 km from Earth$/,
    );
    // The Moon keeps the year's eclipses, but not Earth's spans.
    await expect(page.getByRole('list', { name: 'Eclipses this year' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Time span' })).toBeHidden();
    const views = page.getByRole('group', { name: 'Viewpoint' });
    await expect(views.getByRole('button', { name: 'Moon from Earth' })).toBeVisible();
    await body.getByRole('button', { name: 'Why: Sun, Moon and planets' }).click();
    await expect(page.getByRole('dialog', { name: 'Sun, Moon and planets' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('away from Earth the bar runs over the body’s own cycle, and Earth’s years come back on Earth', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const chapters = page.locator('.history-lane').getByRole('group', { name: 'Geological periods' });
  const years = page.getByRole('slider', { name: 'Year in the Holocene' });
  const cycle = page.getByRole('group', { name: 'Mars’s cycle, as seen from Earth' });
  await test.step('Given Earth in the years', async () => {
    await page.goto('./?t=2025-01-10T12:00');
    await globeRendered(page);
  });
  await test.step('Then the Holocene’s chapters are under the slider', async () => {
    await expect(chapters.getByText('Meghalayan')).toBeVisible();
  });
  await test.step('When they look at Mars', async () => {
    await page.goto('./?t=2025-01-10T12:00&cam=10,20,4&focus=mars');
    await globeRendered(page);
  });
  await test.step('Then the bar runs from conjunction to conjunction, opposition between', async () => {
    await expect(years).toBeHidden();
    await expect(cycle.getByRole('slider', { name: 'Day in Mars’s cycle' })).toBeVisible();
    const moments = cycle.getByRole('listitem');
    await expect(moments).toHaveText([
      /^Behind the Sun 18 Nov 2023 CE$/,
      /^Opposite the Sun 16 Jan 2025 CE$/,
      /^Behind the Sun 9 Jan 2026 CE$/,
    ]);
    await expect(cycle.getByRole('button', { name: /^Behind the Sun 18 Nov/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
  await test.step('When they tap opposition', async () => {
    await cycle.getByRole('button', { name: /^Opposite the Sun/ }).click();
  });
  await test.step('Then the date is that day, and Mars stands opposite the Sun', async () => {
    await expect(page).toHaveURL(/t=2025-01-16T/);
    // Opposite in longitude; Mars stands a few degrees off the ecliptic, so not quite 180°.
    await expect(page.getByTestId('body-facts')).toHaveText(/, 17\d° (east|west) of the Sun$/);
    await expect(cycle.getByRole('button', { name: /^Opposite the Sun/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
  await test.step('When they play the cycle, the days go by, and stop when asked', async () => {
    await cycle.getByRole('button', { name: 'Play the cycle' }).click();
    await expect(page).not.toHaveURL(/t=2025-01-16T/, { timeout: 15_000 });
    await cycle.getByRole('button', { name: 'Stop the cycle' }).click();
    await expect(cycle.getByRole('button', { name: 'Play the cycle' })).toBeVisible();
  });
  await test.step('When they look at the Sun, the bar is Earth’s year', async () => {
    await page.goto('./?t=2025-03-01T12:00&focus=sun&cam=-17.2,-134.2,4');
    await globeRendered(page);
    const year = page.getByRole('group', { name: 'Earth’s year around the Sun' });
    await expect(year.getByRole('listitem')).toHaveText([
      /^Earth nearest the Sun 4 Jan 2025 CE$/,
      /^Earth farthest from the Sun 3 Jul 2025 CE$/,
      /^Earth nearest the Sun 3 Jan 2026 CE$/,
    ]);
    await expect(chapters).toBeHidden();
  });
  await test.step('When they go back to Earth, the years and their chapters come back', async () => {
    await page.goto('./?t=2025-01-10T12:00');
    await globeRendered(page);
    await expect(years).toBeVisible();
    await expect(chapters.getByText('Meghalayan')).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('from any planet the reader can look back at Earth, and see what it looks like there', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const views = page.getByRole('group', { name: 'Viewpoint' });
  await test.step('Given Earth in focus', async () => {
    await page.goto('./?t=2026-01-10T12:00Z&cam=10,20,3');
    await globeRendered(page);
  });
  await test.step('Then the third viewpoint looks at Earth from the Moon', async () => {
    await expect(views.getByRole('button', { name: 'Earth from Moon', exact: true })).toBeVisible();
  });
  await test.step('When they go to Jupiter, at opposition that day, and look back', async () => {
    await page.goto('./?t=2026-01-10T12:00Z&cam=10,20,3&focus=jupiter');
    await globeRendered(page);
    await views.getByRole('button', { name: 'Earth from Jupiter', exact: true }).click();
  });
  await test.step('Then Earth is marked, in front of the Sun, with how it looks from there', async () => {
    await expect(page).toHaveURL(/view=earth-from-here/);
    await expect(page.getByTestId('body-bar')).toContainText('Earth, seen from Jupiter');
    await expect(page.getByTestId('body-facts')).toHaveText(
      /^4\.2\d AU away, 4\.\d″ across, 0% lit · 0° from the Sun, in its glare · the Moon at most 1\d\d″ from it$/,
    );
    await expect(page.getByTestId('body-picture')).toContainText('Pale Blue Dot');
    // Marked once the flight to the viewpoint lands: the flight is timed by frames, and the
    // 120 Hz project's clock moves a frame at a time, slowly on a runner drawing in software.
    await expect(page.locator('.space-marker', { hasText: 'Earth' }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
  await test.step('When they orbit Jupiter again', async () => {
    await views.getByRole('button', { name: 'Orbit', exact: true }).click();
  });
  await test.step('Then the bar speaks of Jupiter once more', async () => {
    await expect(page).not.toHaveURL(/view=/);
    await expect(page.getByTestId('body-bar')).toContainText('Jupiter');
    await expect(page.getByTestId('body-bar')).not.toContainText('Earth, seen from');
  });
  expect(problems).toEqual([]);
});

test('close up, Earth and the planets fetch a sharper map; from afar, nothing extra', async ({
  page,
}, info) => {
  const sharp: string[] = [];
  page.on('request', (request) => {
    if (/-(8192|4096|3600)\.jpg$/.test(request.url())) sharp.push(request.url());
  });
  const globe = page.getByTestId('globe');
  await test.step('Given Earth at the usual distance', async () => {
    await page.goto('./?t=2024-04-08T12:00Z&cam=31,31,3');
    await globeRendered(page);
  });
  await test.step('Then no sharper map is fetched', async () => {
    await expect(globe).not.toHaveAttribute('data-sharp');
    expect(sharp).toEqual([]);
  });
  await test.step('When they come close over the Nile', async () => {
    await page.goto('./?t=2024-04-08T12:00Z&cam=31,31,1.1');
    await globeRendered(page);
  });
  await test.step('Then Earth’s sharper map is fetched once, smaller on a phone', async () => {
    await expect(globe).toHaveAttribute('data-sharp', 'earth', { timeout: 30_000 });
    const size = info.project.name === 'mobile' ? '4096' : '(4096|8192)';
    expect(sharp).toHaveLength(1);
    expect(sharp[0]).toMatch(new RegExp(`earth-blue-marble-${size}\\.jpg$`));
  });
  await test.step('When they come close to Mars', async () => {
    await page.goto('./?t=2026-01-10T12:00Z&focus=mars&cam=0,120,1.5');
    await globeRendered(page);
  });
  await test.step('Then it wears its sharper map', async () => {
    await expect(globe).toHaveAttribute('data-sharp', /mars/, { timeout: 30_000 });
    expect(sharp.some((url) => url.endsWith('planets/mars-4096.jpg'))).toBe(true);
  });
});

test('close up, a planet wears its mission’s map, captioned and credited', async ({ page }) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const picture = page.getByTestId('body-picture');
  await test.step('Given Mars in view, close up', async () => {
    await page.goto('./?t=2026-01-10T12:00&cam=10,20,4&focus=mars');
    await globeRendered(page);
  });
  await test.step('Then it wears the Viking orbiters’ map, and the bar says what and whose it is', async () => {
    await expect(globe).toHaveAttribute('data-planet-map', 'mars', { timeout: 30_000 });
    await expect(picture).toHaveText(
      'Pictured: the Viking orbiters’ colour mosaic of the whole planet, from images of 1976–80. NASA/JPL/USGS.',
    );
  });
  await test.step('When they open Sources', async () => {
    await openSources(page);
  });
  await test.step('Then the close-up maps are listed first, with the bodies’ positions', async () => {
    const list = page.getByTestId('sources-list');
    await expect(list.locator('.why-row-title').first()).toHaveText(
      'The Moon and planets close up',
    );
    await list.getByRole('button', { name: 'Why: The Moon and planets close up' }).click();
    const sheet = page.getByRole('dialog', { name: 'The Moon and planets close up' });
    await expect(sheet.getByRole('link', { name: 'Viking colour mosaic of Mars' })).toHaveAttribute(
      'href',
      'https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m',
    );
  });
  await test.step('When they look at Venus instead', async () => {
    await page.goto('./?t=2026-01-10T12:00&cam=10,20,4&focus=venus');
    await globeRendered(page);
  });
  await test.step('Then the bar says why it shows only cloud, and no map is fetched', async () => {
    await expect(picture).toContainText('From space the clouds hide the ground');
    await expect(globe).not.toHaveAttribute('data-planet-map');
  });
  expect(problems).toEqual([]);
});

test.describe('a first visit from Sydney', () => {
  test.use({ timezoneId: 'Australia/Sydney' });

  test('opens over the reader’s region, from the browser’s time zone', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop-120hz', 'about the time zone, not frames');
    const problems = collectProblems(page);
    await test.step('Given a first visit, from a browser set to Sydney’s time zone', async () => {
      await page.goto('./');
      await globeRendered(page);
    });
    await test.step('Then the globe turns to face Australia', async () => {
      const cam = (index: number) => () =>
        Number(new URL(page.url()).searchParams.get('cam')?.split(',')[index]);
      await expect.poll(cam(0), { timeout: 15_000 }).toBeCloseTo(-33.9, 0);
      await expect.poll(cam(1), { timeout: 15_000 }).toBeCloseTo(151.2, 0);
    });
    expect(problems).toEqual([]);
  });

  test('a link with its own view still opens where it points', async ({ page }) => {
    await page.goto('./?t=2024-04-08T18:17&cam=20,0,4.5');
    await globeRendered(page);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/cam=20\.0000,0\.0000,4\.50/);
  });
});

test('a first visit from a browser in UTC keeps the usual first view', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17');
  await globeRendered(page);
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/cam=20\.0000,0\.0000,/);
});

test('close up on Venus, the Light switch shows the ground beneath its clouds, by radar', async ({
  page,
}) => {
  // A planet after another, each a map fetched: slow on a phone drawn in software.
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const light = page.getByTestId('planet-light');
  await test.step('Given Venus close up', async () => {
    await page.goto('./?t=2024-06-01T12:00&focus=venus&cam=10,0,2.6');
    await expect(globe).toHaveAttribute('data-focus', 'venus', { timeout: 30_000 });
  });
  await test.step('Then it shows its cloud tops, as from space', async () => {
    await expect(light.getByRole('button', { name: /^Cloud tops/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(/^Pictured: the cloud tops/)).toBeVisible();
  });
  await test.step('When they pick the ground, by radar', async () => {
    await light.getByRole('button', { name: /^Ground, by radar/ }).click();
  });
  await test.step('Then Magellan’s map wraps Venus, and the link keeps it', async () => {
    await expect(globe).toHaveAttribute('data-planet-map', 'venus', { timeout: 30_000 });
    await expect(page).toHaveURL(/[?&]light=radar/);
    await expect(page.getByText(/Magellan’s radar mapped it/)).toBeVisible();
    // Its colours keyed to heights, as USGS's legend gives them.
    const key = page.getByTestId('colour-key');
    await expect(key).toContainText('−2');
    await expect(key).toContainText('+10 km');
    await expect(key).toContainText('Height above a radius of 6,051 km');
    await expect(key).toContainText('USGS Astrogeology’s legend');
  });
  await test.step('When they go back to the cloud tops, the link forgets the radar', async () => {
    await light.getByRole('button', { name: /^Cloud tops/ }).click();
    await expect(page).not.toHaveURL(/light=/);
    await expect(page.getByTestId('colour-key')).toBeHidden();
  });
  await test.step('And Mercury’s switch shows its enhanced colour, Jupiter’s its 2024 clouds', async () => {
    await page.goto('./?t=2024-06-01T12:00&focus=mercury&cam=10,0,2.6&light=minerals');
    await expect(globe).toHaveAttribute('data-planet-map', 'mercury', { timeout: 30_000 });
    await expect(light.getByRole('button', { name: /^Enhanced colour/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.goto('./?t=2024-06-01T12:00&focus=jupiter&cam=10,0,2.6&light=recent');
    await expect(globe).toHaveAttribute('data-planet-map', 'jupiter', { timeout: 30_000 });
    await expect(light.getByRole('button', { name: /^In 2024/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByText(/Hubble’s map of the cloud tops on 19–20 November 2024/),
    ).toBeVisible();
  });
  await test.step('And Mars’s switch shows the height of its ground, by laser', async () => {
    await page.goto('./?t=2024-06-01T12:00&focus=mars&cam=10,0,2.6&light=height');
    await expect(globe).toHaveAttribute('data-planet-map', 'mars', { timeout: 30_000 });
    await expect(light.getByRole('button', { name: /^Height/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(/Mars Global Surveyor’s laser altimeter/)).toBeVisible();
    // Keyed from Hellas's depths to Olympus Mons, measured against MOLA's heights.
    const key = page.getByTestId('colour-key');
    await expect(key).toContainText('−4');
    await expect(key).toContainText('+20 km');
    await expect(key).toContainText('Height above the areoid');
    await expect(key).toContainText('measured against MOLA heights');
  });
  await test.step('And Saturn, with one way only, has no Light switch', async () => {
    await page.goto('./?t=2024-06-01T12:00&focus=saturn&cam=10,0,2.6');
    await expect(globe).toHaveAttribute('data-focus', 'saturn', { timeout: 30_000 });
    await expect(light).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('close up, the IAU’s names for the largest features turn with each rocky body, on its day side', async ({
  page,
}) => {
  // Four bodies, each a map fetched: slow on a phone drawn in software.
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const names = page.getByTestId('place-names');
  await test.step('Given Mars, Olympus Mons towards us, by its heights', async () => {
    await page.goto('./?t=2025-03-25T12:00&cam=10,20,2.5&focus=mars&light=height');
    await expect(globe).toHaveAttribute('data-planet-map', 'mars', { timeout: 30_000 });
  });
  await test.step('Then its largest features are named, Olympus Mons among them', async () => {
    await expect(names).toHaveAttribute('data-body', 'mars');
    await expect(names.getByText('Olympus Mons', { exact: true })).toBeVisible();
    // Far fewer than the 400 it has: as many as fit, and the rest on the far or night side.
    const shown = Number(await names.getAttribute('data-shown'));
    expect(shown).toBeGreaterThan(5);
    expect(shown).toBeLessThan(40);
  });
  await test.step('When they turn to Venus’s clouds, nothing is named on them', async () => {
    await page.goto('./?t=2025-01-10T12:00&cam=60,0,4&focus=venus');
    await expect(globe).toHaveAttribute('data-focus', 'venus', { timeout: 30_000 });
    await expect(names).not.toHaveAttribute('data-body', /./);
  });
  await test.step('But under them, by radar, Ishtar Terra is named', async () => {
    await page
      .getByTestId('planet-light')
      .getByRole('button', { name: /^Ground, by radar/ })
      .click();
    await expect(names).toHaveAttribute('data-body', 'venus');
    await expect(names.getByText('Ishtar Terra', { exact: true })).toBeVisible();
  });
  await test.step('And the full Moon’s seas are named', async () => {
    await page.goto('./?t=2025-11-05T12:00&cam=0,0,3&focus=moon');
    await expect(globe).toHaveAttribute('data-focus', 'moon', { timeout: 30_000 });
    await expect(names.getByText('Mare Tranquillitatis', { exact: true })).toBeVisible();
    await expect(names.getByText('Mare Serenitatis', { exact: true })).toBeVisible();
  });
  await test.step('And Jupiter, all cloud, has none', async () => {
    await page.goto('./?t=2025-01-10T12:00&cam=10,20,4&focus=jupiter');
    await expect(globe).toHaveAttribute('data-focus', 'jupiter', { timeout: 30_000 });
    await expect(names).not.toHaveAttribute('data-body', /./);
  });
  expect(problems).toEqual([]);
});

test('close up on the Moon, the Light switch shows its heights, keyed, and its rocks told apart', async ({
  page,
}) => {
  // Two maps fetched, each a few megabytes: slow on a phone drawn in software.
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const light = page.getByTestId('planet-light');
  await test.step('Given the Moon close up', async () => {
    await page.goto('./?t=2024-06-01T12:00&focus=moon&cam=10,0,2.6');
    await expect(globe).toHaveAttribute('data-focus', 'moon', { timeout: 30_000 });
  });
  await test.step('Then its switch shows its heights, by laser, and back', async () => {
    await light.getByRole('button', { name: /^Height/ }).click();
    await expect(page).toHaveURL(/[?&]light=height/);
    await expect(globe).toHaveAttribute('data-moon-map', 'view', { timeout: 30_000 });
    await expect(page.getByText(/Lunar Reconnaissance Orbiter’s laser altimeter/)).toBeVisible();
    await expect(page.getByTestId('colour-key')).toContainText('+8 km');
    await expect(page.getByTestId('colour-key')).toContainText('measured against LOLA heights');
    await light.getByRole('button', { name: /^As it looks/ }).click();
    await expect(globe).toHaveAttribute('data-moon-map', 'usual');
    await expect(page.getByTestId('colour-key')).toBeHidden();
    await expect(
      page.getByText(/^Pictured: the Lunar Reconnaissance Orbiter’s colour mosaic/),
    ).toBeVisible();
  });
  await test.step('And its enhanced colour, Clementine’s, tells its rocks apart', async () => {
    await page.goto('./?t=2024-06-01T12:00&focus=moon&cam=10,0,2.6&light=minerals');
    await expect(globe).toHaveAttribute('data-moon-map', 'view', { timeout: 30_000 });
    await expect(light.getByRole('button', { name: /^Enhanced colour/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(/Clementine’s colour-ratio map/)).toBeVisible();
  });
  expect(problems).toEqual([]);
});
