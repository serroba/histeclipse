/**
 * Journeys: what a reader does from landing to leaving, across features. Each feature has its
 * own scenarios; these check the features still work together, in the order people use them.
 * The catalogue is in `e2e/README.md`.
 */

import { collectProblems, expect, globeRendered, openLayers, pickSpan, test } from './support';

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
    // The glide is timed by the frames: a slow machine draws fewer, so it can take a while.
    await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},60000\.00/, { timeout: 20_000 });
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
