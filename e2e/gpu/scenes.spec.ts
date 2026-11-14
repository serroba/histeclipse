import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Decode a real compositor screenshot: a rendered flag alone cannot detect a blank canvas. */
async function hasPicture(page: Page, canvas: Locator): Promise<void> {
  const screenshot = await canvas.screenshot();
  const fraction = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const copy = document.createElement('canvas');
    copy.width = image.width;
    copy.height = image.height;
    const context = copy.getContext('2d');
    if (context === null) throw new Error('No image reader');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let foreground = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const away = Math.max(
        ...[0, 1, 2].map((channel) =>
          Math.abs((pixels[i + channel] ?? 0) - (pixels[channel] ?? 0)),
        ),
      );
      if (away > 16) foreground++;
    }
    return foreground / (copy.width * copy.height);
  }, screenshot.toString('base64'));
  expect(fraction, 'more than 5% of the canvas differs from its background').toBeGreaterThan(0.05);
}

for (const [scene, chapters] of [
  ['earth', []],
  ['sun', ['fusion', 'escape', 'journey']],
  ['air', ['rays', 'shower', 'capture']],
  ['land', ['dioxide', 'fall', 'plant']],
  ['water', ['dioxide', 'fall', 'plant']],
] as const) {
  test(`${scene}: production scene materials render without shader errors`, async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('requestfailed', (request) => problems.push(request.url()));
    await page.goto(`./e2e/gpu/index.html?scene=${scene}`);
    const stage = page.locator('#scene');
    await expect(stage).toHaveAttribute('data-rendered', 'true');
    const canvas = stage.locator('canvas').first();
    await hasPicture(page, canvas);
    for (const chapter of chapters) {
      await page.getByRole('button', { name: chapter, exact: true }).click();
      await expect(stage).toHaveAttribute('data-chapter', chapter);
      await expect(stage).toHaveAttribute('data-rendered', 'true');
      await hasPicture(page, canvas);
    }
    expect(problems).toEqual([]);
  });
}
