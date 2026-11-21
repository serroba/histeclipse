/**
 * Feature: the phone experience (#988). One visit as a reader takes it on a phone: the first
 * view, the welcome closed, the years played, the eclipse of Thales opened from Explore and
 * played. At each step the globe keeps its room and nothing runs off the screen.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, test } from './support';

/** The share of the screen's height between the date panel and the bottom bar: the globe's room. */
async function globeRoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const top = document.querySelector('.hud')?.getBoundingClientRect().bottom ?? 0;
    const bottom = document.querySelector('.bottom')?.getBoundingClientRect().top ?? 0;
    return (bottom - top) / window.innerHeight;
  });
}

/**
 * Controls past the screen's edges, and whether the page itself scrolls sideways. A control in a
 * strip that scrolls sideways on purpose (the year's eclipses) is reached by scrolling it.
 */
async function overflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const inStrip = (element: Element): boolean => {
      for (let up = element.parentElement; up !== null; up = up.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(up).overflowX)) return true;
      }
      return false;
    };
    const off = [...document.querySelectorAll('button, a, input, select')]
      .filter((each) => {
        const box = each.getBoundingClientRect();
        return (
          box.width > 0 && (box.right > window.innerWidth + 1 || box.left < -1) && !inStrip(each)
        );
      })
      .map((each) => (each.getAttribute('aria-label') ?? each.textContent).trim());
    if (document.documentElement.scrollWidth > window.innerWidth + 1) off.push('the page');
    return off;
  });
}

for (const { name, width, height, room } of [
  { name: 'an iPhone 13', width: 390, height: 664, room: 0.5 },
  { name: 'an iPhone SE', width: 320, height: 568, room: 0.5 },
]) {
  test(`on ${name} (${String(width)}×${String(height)}) a first visit plays the years and the eclipse of Thales, the globe in view (#988) @mobile`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'a phone');
    const problems = collectProblems(page);
    const welcome = page.getByTestId('welcome');
    const bar = page.getByRole('group', { name: 'Holocene' });
    const scrubber = page.locator('.scrubber');
    const slider = page.getByRole('slider', { name: 'Time relative to greatest eclipse' });
    const settled = async (): Promise<void> => {
      expect(await globeRoom(page)).toBeGreaterThan(room);
      expect(await overflow(page)).toEqual([]);
    };

    await test.step('Given a first visit on the phone', async () => {
      await page.setViewportSize({ width, height });
      await page.goto('./');
      await globeRendered(page);
      await expect(welcome).toBeVisible();
      expect(await overflow(page)).toEqual([]);
    });
    await test.step('When they close the welcome, Then the globe has its room', async () => {
      await welcome.getByRole('button', { name: 'Close the welcome' }).click();
      await expect(welcome).toBeHidden();
      await settled();
    });
    await test.step('When they play the years, Then the travel notes leave the globe its room', async () => {
      await bar.getByRole('button', { name: 'Travel through the years' }).click();
      await expect(page).toHaveURL(/[?&]t=-\d{4}-/);
      await settled();
      // What the trip turned on is said in ⓘ, not over the globe (#1050).
      await expect(page.getByRole('status').getByText(/^Travel view turned on /)).toHaveCount(0);
      await bar.getByRole('button', { name: 'Stop travelling' }).click();
      await settled();
    });
    await test.step('When they open the eclipse of Thales from Explore, Then it lands with its slider', async () => {
      await page.getByRole('button', { name: 'Explore' }).click();
      await page
        .getByRole('dialog', { name: 'Explore' })
        .getByRole('button', { name: 'The eclipse of Thales', exact: true })
        .click();
      await expect(page).toHaveURL(/sel=solar:-0584-05-28/);
      await expect(slider).toBeVisible();
      expect((await slider.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(120);
      expect(await overflow(page)).toEqual([]);
    });
    await test.step('When they play the eclipse, Then it plays from before its greatest', async () => {
      await scrubber.getByRole('button', { name: 'Play' }).click();
      await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(0);
      await scrubber.getByRole('button', { name: 'Pause' }).click();
      expect(await overflow(page)).toEqual([]);
    });
    expect(problems).toEqual([]);
  });
}
