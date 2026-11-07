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
    await expect(page.getByRole('slider', { name: 'Year in the Holocene' })).toBeVisible();
  });
  await test.step('When they look at the Moon on a full-Moon day', async () => {
    await page.goto('./?t=2025-11-05T12:00&cam=0,180,3&focus=moon');
    await globeRendered(page);
  });
  await test.step('Then the bar gives its phase and distance, and its book opens the sources', async () => {
    await expect(page.getByTestId('body-facts')).toHaveText(
      /^Full Moon, 100% lit · 357,000 km from Earth$/,
    );
    await body.getByRole('button', { name: 'Why: Sun, Moon and planets' }).click();
    await expect(page.getByRole('dialog', { name: 'Sun, Moon and planets' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('away from Earth the year slider stays, but Earth’s chapters rest', async ({ page }, info) => {
  const lane = page.locator('.history-lane');
  const chapters = lane.getByRole('group', { name: 'Geological periods' });
  const slider = page.getByRole('slider', { name: 'Year in the Holocene' });
  await test.step('Given Earth in the years', async () => {
    await page.goto('./?t=2024-05-08T12:00');
    await globeRendered(page);
  });
  await test.step('Then the Holocene’s chapters are under the slider', async () => {
    await expect(chapters.getByText('Meghalayan')).toBeVisible();
  });
  await test.step('When they look at the Sun', async () => {
    await page.goto('./?t=2024-05-08T12:00&focus=sun&cam=-17.2,-134.2,4');
    await globeRendered(page);
  });
  await test.step('Then the slider and its first year stay, without Earth’s chapters', async () => {
    await expect(slider).toBeVisible();
    await expect(chapters).toBeHidden();
    await expect(lane.getByTestId('scale-start')).toHaveText('9700 BCE');
    await expect(lane.getByTestId('scale-start')).not.toHaveClass(/is-covered/);
  });
  if (info.project.name !== 'mobile') {
    await test.step('And the reading under the pointer names the year alone', async () => {
      const box = await slider.boundingBox();
      if (box === null) throw new Error('no slider');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(lane.getByTestId('scale-reading')).toHaveText(/^\d+ BCE$/);
    });
  }
  await test.step('When they go back to Earth, the chapters come back', async () => {
    await page.goto('./?t=2024-05-08T12:00');
    await globeRendered(page);
    await expect(chapters.getByText('Meghalayan')).toBeVisible();
  });
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
    await expect(page.locator('.space-marker', { hasText: 'Earth' }).first()).toBeVisible();
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
