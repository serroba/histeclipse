// The eclipses: picking one, its path, shadow and card, the scrubber, and the famous list.

import {
  collectProblems,
  expect,
  globeRendered,
  GPU,
  openLayers,
  skyRendered,
  test,
} from './support';

test('picking an eclipse jumps to it and puts it in the link', async ({ page }) => {
  await page.goto('./?t=-620-01-01T12:00&layers=eclipses');
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

test('the Moon-up region follows time and shows only during the eclipse', GPU, async ({ page }) => {
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

test('a lunar eclipse shows the Moon crossing Earth’s shadow @acceptance', async ({ page }) => {
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

test('turning the eclipses off hides the row and the overlay and lets go of the eclipse', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const row = page.locator('.eclipse-row');
  await test.step('Given a lunar eclipse picked, its overlay on the globe', async () => {
    await page.goto('./?t=-620-04-22T02:08&sel=lunar:-0620-04-22');
    await globeRendered(page);
    await expect(globe).toHaveAttribute('data-lunar-overlay', 'on');
    await expect(row).toBeVisible();
  });
  await test.step('When they turn off Eclipses', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Eclipses', exact: true }).uncheck();
  });
  await test.step('Then the overlay, the card and the eclipse row are gone', async () => {
    await expect(globe).toHaveAttribute('data-lunar-overlay', 'off');
    await expect(page.getByRole('heading', { name: 'Partial lunar eclipse' })).toBeHidden();
    await expect(row).toBeHidden();
  });
  await test.step('And the link lets go of the eclipse', async () => {
    await expect(page).not.toHaveURL(/sel=/);
    await expect(page).toHaveURL(/layers=/);
    await expect(page).not.toHaveURL(/layers=[^&]*eclipses/);
  });
  expect(problems).toEqual([]);
});

test("stepping and typing years lists that year's eclipses", async ({ page }) => {
  await page.goto('./?t=2024-03-14T12:00&layers=eclipses');
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

test(
  'picking a solar eclipse draws its path and the Moon’s shadow @acceptance',
  GPU,
  async ({ page }) => {
    await page.goto('./?t=2024-01-01T00:00&loc=32.7767,-96.797&layers=eclipses');
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
  },
);

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

test('play animates the eclipse forward in time @acceptance', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:00&sel=solar:2024-04-08');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page).not.toHaveURL(/t=2024-04-08T18:00Z/);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('famous eclipses: pick one and land on it with its history', async ({ page }) => {
  await page.goto('./?t=2024-01-01T00:00&layers=eclipses');
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
  await page.goto('./?t=2024-01-01T00:00&layers=eclipses');
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
  await page.goto('./?layers=eclipses');
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

test('famous eclipse rows are large enough to tap @mobile', async ({ page }) => {
  await page.goto('./?layers=eclipses');
  await globeRendered(page);
  await page.getByRole('button', { name: 'Famous eclipses' }).click();
  const dialog = page.getByRole('dialog', { name: 'Famous eclipses' });
  for (const control of await dialog.getByRole('button').all()) {
    const box = await control.boundingBox();
    if (box === null) continue;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test(
  'eclipse shadows render on the Moon and on Earth without errors @gpu-core',
  GPU,
  async ({ page }) => {
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
  },
);

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
