import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
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

/** Sample real main-thread task time, while asserting that paused scenes stop RAF polling. */
async function idleSample(
  page: Page,
): Promise<{ callbacks: number; taskMs: number; observedMs: number }> {
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  const taskTime = async () => {
    const snapshot = await session.send('Performance.getMetrics');
    return snapshot.metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0;
  };
  let sample = { callbacks: -1, taskMs: 0, observedMs: 0 };
  try {
    await expect
      .poll(
        async () => {
          const before = await frameCount(page);
          const taskBefore = await taskTime();
          const start = Date.now();
          await page.waitForTimeout(500);
          sample = {
            callbacks: (await frameCount(page)) - before,
            taskMs: ((await taskTime()) - taskBefore) * 1000,
            observedMs: Date.now() - start,
          };
          return sample.callbacks;
        },
        { timeout: 15_000, message: 'idle scenes must stop polling animation frames' },
      )
      .toBe(0);
    return sample;
  } finally {
    await session.detach();
  }
}

async function frameCount(page: Page): Promise<number> {
  return page.evaluate(() => Number(Reflect.get(window, '__renderAuditFrames')));
}

/** Count completed animation frames in `window.__renderAuditFrames`, from before the page loads. */
async function countFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    let completed = 0;
    Object.defineProperty(window, '__renderAuditFrames', { get: () => completed });
    window.requestAnimationFrame = (callback) =>
      request((now) => {
        completed++;
        callback(now);
      });
  });
}

// #667: on an upright screen the rays chapter's first camera stood beyond the controls' reach;
// each frame the controls pulled it in and the story put it back, and the paused story never rested.
test('air: paused at its start on an upright screen, the story comes to rest', async ({ page }) => {
  await countFrames(page);
  await page.goto('./e2e/gpu/index.html?scene=air');
  const stage = page.locator('#scene');
  await expect(stage).toHaveAttribute('data-rendered', 'true');
  await stage.evaluate((node) => {
    Object.assign((node as HTMLElement).style, { width: '200px', height: '440px' });
  });
  await page.getByRole('button', { name: 'rays', exact: true }).click();
  await page.getByRole('button', { name: 'Restart paused', exact: true }).click();
  await expect(stage).toHaveAttribute('data-playing', 'false');
  await idleSample(page);
});

for (const [scene, chapters] of [
  ['earth', []],
  ['sun', ['fusion', 'escape', 'journey']],
  ['air', ['rays', 'shower', 'capture']],
  ['land', ['dioxide', 'fall', 'plant']],
  ['water', ['dioxide', 'fall', 'plant']],
] as const) {
  test(`${scene}: production scene materials render without shader errors`, async ({ page }) => {
    await countFrames(page);
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
    const atRest = await idleSample(page);
    const before = await frameCount(page);
    await page
      .getByRole('button', { name: scene === 'earth' ? 'Move' : 'Play', exact: true })
      .click();
    await expect.poll(() => frameCount(page)).toBeGreaterThan(before);
    if (scene !== 'earth') await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const afterMotion = await idleSample(page);
    if (scene === 'earth') {
      await stage.evaluate((node) => {
        (node as HTMLElement).hidden = true;
      });
      await page.getByRole('button', { name: 'Move', exact: true }).click();
      await idleSample(page);
      const hidden = await frameCount(page);
      await stage.evaluate((node) => {
        (node as HTMLElement).hidden = false;
      });
      await expect.poll(() => frameCount(page)).toBeGreaterThan(hidden);
      await idleSample(page);
    }
    const output = path.join(process.cwd(), 'test-results', `timings-idle-${scene}.json`);
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(
      output,
      JSON.stringify({ type: 'rendering-idle-audit', scene, atRest, afterMotion }, null, 2),
    );
    expect(problems).toEqual([]);
  });
}
