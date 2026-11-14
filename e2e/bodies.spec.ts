// The Sun, the Moon and the planets: far out, up close, and the Sun's kinds of light.

import { collectProblems, expect, globeRendered, GPU, test } from './support';

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

test('clicking the Moon flies to it, and the camera then orbits and zooms around it @acceptance', async ({
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

test(
  'close to the Sun, SDO’s images show it in six kinds of light @acceptance @gpu-core',
  GPU,
  async ({ page }) => {
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
  },
);

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

test(
  'far out, the planets appear, and clicking one flies to it @acceptance @gpu-core',
  GPU,
  async ({ page }) => {
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
  },
);

test('a link can centre on Saturn, rings and all', async ({ page }) => {
  await page.goto('./?t=2020-12-21T18:00&focus=saturn&cam=25,120,4');
  await globeRendered(page);
  const globe = page.getByTestId('globe');
  await expect(globe).toHaveAttribute('data-planets', 'on');
  await expect(globe).toHaveAttribute('data-focus', 'saturn');
  await expect(page).toHaveURL(/focus=saturn/);
});

test('Back from Earth to the Moon lands where the link put the camera (#581)', async ({ page }) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  await page.goto('./?t=2025-01-10T12:00&focus=moon&cam=0,0,6');
  await globeRendered(page);
  await expect(globe).toHaveAttribute('data-framed', 'moon');
  await expect(globe).toHaveAttribute('data-distance', '6.00', { timeout: 20_000 });
  await page
    .getByRole('group', { name: 'Zoom' })
    .getByRole('button', { name: 'Back to Earth' })
    .click();
  await expect(globe).toHaveAttribute('data-framed', 'earth', { timeout: 20_000 });
  await page.goBack();
  await expect(page).toHaveURL(/focus=moon/);
  // Not the focus flight's own distance: the camera the link names.
  await expect(globe).toHaveAttribute('data-framed', 'moon', { timeout: 20_000 });
  await expect(globe).toHaveAttribute('data-distance', '6.00', { timeout: 20_000 });
  expect(problems).toEqual([]);
});
