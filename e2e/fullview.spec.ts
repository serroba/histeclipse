/**
 * Feature: Full view. The reader clears the panels to look at the globe. In deep time a tap on
 * the globe, or on the space around it, clears them (there is no place to pick), and a strip
 * keeps saying when it is.
 */

import { collectProblems, expect, globeRendered, test } from './support';

test('in deep time a tap on the globe clears the panels, and the strip says when @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const glance = page.getByTestId('deep-glance');
  await test.step('Given deep time 250 million years ago', async () => {
    await page.goto('./?ma=250');
    await globeRendered(page);
    await expect(glance).toBeHidden();
  });
  await test.step('When they tap the globe', async () => {
    await globe.click();
  });
  await test.step('Then the panels go, and a strip shows the time and how far through', async () => {
    await expect(page.locator('.hud')).toBeHidden();
    await expect(glance).toBeVisible();
    await expect(glance).toContainText('250 million years ago');
    await expect(glance).toContainText('Triassic');
    const slider = glance.getByRole('slider', { name: 'Time shown' });
    await expect(slider).toHaveAttribute('aria-valuetext', '250 million years ago');
  });
  await test.step('When they drag the strip to halfway', async () => {
    await glance.getByRole('slider', { name: 'Time shown' }).fill('500');
  });
  await test.step('Then the globe shows that moment, and the panels stay away', async () => {
    await expect(page).toHaveURL(/&ma=270(&|$)/);
    await expect(glance).toContainText('270 million years ago');
    await expect(page.locator('.hud')).toBeHidden();
  });
  await test.step('When they play from the strip', async () => {
    await glance.getByRole('button', { name: 'Play' }).click();
  });
  await test.step('Then the strip follows time towards the present', async () => {
    await expect(glance).not.toContainText('270 million years ago');
    await glance.getByRole('button', { name: 'Pause' }).click();
  });
  await test.step('When they tap the globe again, the panels come back', async () => {
    await globe.click();
    await expect(page.locator('.hud')).toBeVisible();
    await expect(glance).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('in the Holocene a tap on the globe still picks a place, leaving the panels', async ({
  page,
}) => {
  await test.step('Given the globe in 2024, looking at the Earth', async () => {
    await page.goto('./?t=2024-04-08T18:17&loc=0,0');
    await globeRendered(page);
  });
  await test.step('When they tap the globe', async () => {
    await page.getByTestId('globe').click();
  });
  await test.step('Then they stand where they tapped, and the panels stay', async () => {
    await expect(page).not.toHaveURL(/loc=0,0(&|$)/);
    await expect(page.locator('.hud')).toBeVisible();
    await expect(page.getByTestId('deep-glance')).toBeHidden();
  });
});

test('in full view with Temperature on, the strip has a small scale of its colours', async ({
  page,
}) => {
  const glance = page.getByTestId('deep-glance');
  const scale = page.getByTestId('glance-temperature');
  await test.step('Given deep time 375 million years ago, coloured by temperature', async () => {
    await page.goto('./?ma=375&layers=temperature');
    await globeRendered(page);
  });
  await test.step('When they clear the panels', async () => {
    await page.getByRole('button', { name: 'Full view' }).click();
    await expect(glance).toBeVisible();
  });
  await test.step('Then the strip shows the temperature scale, from −40 °C to 45 °C', async () => {
    await expect(scale).toBeVisible();
    await expect(scale).toContainText('−40 °C');
    await expect(scale).toContainText('15 °C');
    await expect(scale).toContainText('45 °C');
  });
  await test.step('And without Temperature, no scale', async () => {
    await page.goto('./?ma=375');
    await globeRendered(page);
    await page.getByRole('button', { name: 'Full view' }).click();
    await expect(glance).toBeVisible();
    await expect(scale).toBeHidden();
  });
});

test('in deep time a tap on the space around the globe clears the panels too', async ({ page }) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  // Beside the globe, at the right edge of the view: empty space.
  const space = async () => {
    const box = await globe.boundingBox();
    if (box === null) throw new Error('no globe');
    await page.mouse.click(box.x + box.width - 4, box.y + box.height * 0.45);
  };
  await test.step('Given deep time 180 million years ago', async () => {
    await page.goto('./?ma=180');
    await globeRendered(page);
  });
  await test.step('When they tap the space beside the globe', async () => {
    await space();
  });
  await test.step('Then the panels go, as with a tap on the globe', async () => {
    await expect(page.locator('.hud')).toBeHidden();
    await expect(page.getByTestId('deep-glance')).toBeVisible();
  });
  await test.step('When they tap it again, the panels come back', async () => {
    await space();
    await expect(page.locator('.hud')).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('in the Holocene a tap on empty space still only brings the panels back', async ({ page }) => {
  await page.goto('./?t=2024-04-08T18:17');
  await globeRendered(page);
  const box = await page.getByTestId('globe').boundingBox();
  if (box === null) throw new Error('no globe');
  await page.mouse.click(box.x + box.width - 4, box.y + box.height * 0.45);
  await expect(page.locator('.hud')).toBeVisible();
});

test('on a short phone the date panel folds, so the globe keeps over half the screen (#975) @mobile', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'a short phone');
  const problems = collectProblems(page);
  const hud = page.locator('.hud');
  const more = hud.getByRole('button', { name: 'More controls' });
  /** The share of the screen's height between the date panel and the bottom bar. */
  const free = async (): Promise<number> =>
    page.evaluate(() => {
      const top = document.querySelector('.hud')?.getBoundingClientRect().bottom ?? 0;
      const bottom = document.querySelector('.bottom')?.getBoundingClientRect().top ?? 0;
      return (bottom - top) / window.innerHeight;
    });
  await test.step('Given today on a phone 390 by 664, as a browser leaves an iPhone 13', async () => {
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto('./?t=2026-01-01T12:00Z');
    await globeRendered(page);
  });
  await test.step('Then the panel shows the date, folded, and the globe has over half', async () => {
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(hud.getByRole('button', { name: 'Layers' })).toBeHidden();
    expect(await free()).toBeGreaterThan(0.5);
  });
  await test.step('When they ask for more, Then the time spans, Layers and views are there', async () => {
    await more.click();
    await expect(hud.getByRole('button', { name: 'Fewer controls' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(hud.getByRole('button', { name: 'Layers' })).toBeVisible();
    await expect(hud.getByRole('group', { name: 'Viewpoint' })).toBeVisible();
  });
  await test.step('When they fold it again, Then the globe has its room back', async () => {
    await hud.getByRole('button', { name: 'Fewer controls' }).click();
    expect(await free()).toBeGreaterThan(0.5);
  });
  expect(problems).toEqual([]);
});

test('on a 320-px phone the date panel’s tools keep clear of the name, and nothing runs off the screen (#977) @mobile', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'a phone');
  const problems = collectProblems(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./?t=2026-11-20T09:43Z');
  await globeRendered(page);
  const name = await page.locator('.hud h1 .home').boundingBox();
  const tools = await page.locator('.hud-tools').boundingBox();
  if (name === null || tools === null) throw new Error('no header');
  const apart =
    name.x + name.width <= tools.x ||
    tools.x + tools.width <= name.x ||
    name.y + name.height <= tools.y ||
    tools.y + tools.height <= name.y;
  expect(apart).toBe(true);
  // The time stays whole, on one line of its own size (with the date, or under it, by the font).
  const time = await page.locator('.hud-time').evaluate((element) => ({
    lines: element.getClientRects().length,
  }));
  expect(time.lines).toBe(1);
  const off = await page.evaluate(
    () =>
      [...document.querySelectorAll('button, a')].filter((each) => {
        const box = each.getBoundingClientRect();
        return box.width > 0 && box.right > window.innerWidth + 1;
      }).length,
  );
  expect(off).toBe(0);
  expect(problems).toEqual([]);
});

test('a phone on its side shows the globe beside a narrow date panel, not under it (#976) @mobile', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'a phone');
  const problems = collectProblems(page);
  await page.setViewportSize({ width: 664, height: 390 });
  await page.goto('./?t=2026-11-20T09:43Z');
  await globeRendered(page);
  const hud = await page.locator('.hud').boundingBox();
  const bottom = await page.locator('.bottom').boundingBox();
  if (hud === null || bottom === null) throw new Error('no panels');
  // A column at the left, under half the width: the globe goes beside it, the full height above
  // the bar (#946's free-left).
  expect(hud.width).toBeLessThan(664 / 2);
  const left = await page.evaluate(() =>
    parseFloat(
      getComputedStyle(document.getElementById('app') ?? document.body).getPropertyValue(
        '--free-left',
      ),
    ),
  );
  expect(left).toBeGreaterThan(0);
  expect(bottom.y).toBeGreaterThan(390 * 0.6);
  expect(problems).toEqual([]);
});

test('on a phone every control is a finger wide, and the panels’ words 12 px at least (#979) @mobile', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'a touch screen');
  const problems = collectProblems(page);
  await page.goto('./?t=2026-11-20T09:43Z');
  await globeRendered(page);
  const found = await page.evaluate(() => {
    const shown = (element: Element): boolean => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.visibility !== 'hidden' && style.display !== 'none' && box.width > 1 && box.height > 1
      );
    };
    const small: string[] = [];
    for (const control of document.querySelectorAll(
      'button, a, summary, select, input:not([type=range])',
    )) {
      if (!shown(control) || getComputedStyle(control).pointerEvents === 'none') continue;
      // Allowed: links in a sentence (the sources, WCAG 2.5.8's inline exception), and the
      // ages under the slider, a second way to a time the slider itself reaches.
      if (control.closest('.credits') !== null && control.tagName === 'A') continue;
      if (control.classList.contains('period-band')) continue;
      const box = control.getBoundingClientRect();
      const after = getComputedStyle(control, '::after');
      const pad = (side: string): number =>
        after.content !== 'none' && after.position === 'absolute'
          ? -Math.min(0, parseFloat(side))
          : 0;
      const width = box.width + pad(after.left) + pad(after.right);
      const height = box.height + pad(after.top) + pad(after.bottom);
      if (width < 43.5 || height < 43.5) {
        small.push(
          `${(control.getAttribute('aria-label') ?? control.textContent).trim()} ${String(Math.round(width))}×${String(Math.round(height))}`,
        );
      }
    }
    const tiny = new Set<string>();
    for (const element of document.querySelectorAll('.hud *, .bottom *, .zoom-rail *')) {
      if (
        !shown(element) ||
        ![...element.childNodes].some(
          (node) => node.nodeType === 3 && (node.textContent ?? '').trim() !== '',
        )
      )
        continue;
      const size = parseFloat(getComputedStyle(element).fontSize);
      if (size < 12) tiny.add(`${element.tagName} ${String(size)}px`);
    }
    return { small, tiny: [...tiny] };
  });
  expect(found.small).toEqual([]);
  expect(found.tiny).toEqual([]);
  expect(problems).toEqual([]);
});
