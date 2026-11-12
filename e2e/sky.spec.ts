// The sky view: standing somewhere, the stars and the planets, the figures and their cultures.

import type { Page } from '@playwright/test';

import {
  collectProblems,
  expect,
  freeSpot,
  globeRendered,
  GPU,
  skyRendered,
  test,
} from './support';

const BABYLON_NIGHT_3000_BCE = './?mode=sky&t=-2999-03-20T19:00&loc=32.5422,44.4209';

/** Open the sky's constellation options, folded away on phones. */
async function openSkyOptions(page: Page): Promise<void> {
  const options = page.locator('details.sky-options');
  if ((await options.getAttribute('open')) === null) await options.locator('> summary').click();
}

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

test(
  'a night in 3000 BCE is full of stars, and the Sun hides them by day',
  GPU,
  async ({ page }) => {
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
  },
);

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

test('the Moon turns red in the umbra during a lunar eclipse', GPU, async ({ page }) => {
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
