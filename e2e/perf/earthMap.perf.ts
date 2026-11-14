/** A/B diagnostic for #689: same production app, replacing only the intermediate Earth map. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installProbe } from './probe';
import type { Probe } from './probe';
import { untilQuiet } from './measure';

interface Upload {
  width: number;
  ms: number;
}

function uploadProbe(): void {
  const uploads: Upload[] = [];
  Reflect.set(window, '__mapUploads', uploads);
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const original: unknown = Reflect.get(proto, 'texSubImage2D');
    if (typeof original !== 'function') continue;
    Reflect.set(
      proto,
      'texSubImage2D',
      function (this: WebGL2RenderingContext, ...args: unknown[]) {
        const source = args.find((arg) => arg instanceof ImageBitmap);
        const start = performance.now();
        const result: unknown = Reflect.apply(original, this, args);
        if (source instanceof ImageBitmap && source.width >= 4096)
          uploads.push({ width: source.width, ms: performance.now() - start });
        return result;
      },
    );
  }
}

async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId('globe')).toHaveAttribute('data-sharp', 'earth');
  expect(await untilQuiet(page, 30_000), 'maps, camera and tiles settle').toBe(true);
}

async function compare(page: Page, a: string, b: string) {
  return page.evaluate(
    async ({ a, b }) => {
      const decode = async (data: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx === null) throw new Error('No screenshot decoder');
        ctx.drawImage(img, 0, 0);
        return { canvas, ctx, pixels: ctx.getImageData(0, 0, img.width, img.height) };
      };
      const left = await decode(a);
      const right = await decode(b);
      let total = 0,
        changed = 0,
        worst = 0;
      for (let i = 0; i < left.pixels.data.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 3; c++) {
          const d = Math.abs((left.pixels.data[i + c] ?? 0) - (right.pixels.data[i + c] ?? 0));
          total += d;
          delta = Math.max(delta, d);
          left.pixels.data[i + c] = Math.min(255, d * 4);
        }
        if (delta > 8) changed++;
        worst = Math.max(worst, delta);
      }
      left.ctx.putImageData(left.pixels, 0, 0);
      const pixels = left.canvas.width * left.canvas.height;
      return {
        meanChannelDifference: total / (pixels * 3),
        fractionOver8: changed / pixels,
        worst,
        differencePng: left.canvas.toDataURL('image/png').split(',')[1] ?? '',
      };
    },
    { a, b },
  );
}

test('Earth intermediate map: 8192 versus 4096 with the same close-up tiles', async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(240_000);
  if (baseURL === undefined) throw new Error('Missing audit server');
  const output = 'test-results/earth-map-comparison';
  mkdirSync(output, { recursive: true });
  const screenshots = new Map<string, string>();
  const samples = [];
  // Interleave variants to reduce order bias; a fresh page makes each upload a first use.
  for (let repeat = 0; repeat < 3; repeat++) {
    for (const width of repeat % 2 === 0 ? [8192, 4096] : [4096, 8192]) {
      const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.addInitScript(installProbe);
      await page.addInitScript(uploadProbe);
      await page.route('**/textures/earth-blue-marble-8192.jpg', async (route) => {
        const response = await route.fetch({
          url: route
            .request()
            .url()
            .replace('8192.jpg', `${String(width)}.jpg`),
        });
        await route.fulfill({ response });
      });
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(error.message));
      await page.goto('/?t=2024-04-08T12:00Z&cam=30,31,2.4');
      await ready(page);
      const uploads = await page.evaluate(() => Reflect.get(window, '__mapUploads') as Upload[]);
      const canvas = page.getByTestId('globe').locator('canvas').first();
      if (repeat === 0) {
        for (const distance of [2.4, 1.6, 1.3, 1.008]) {
          await page.goto(`/?t=2024-04-08T12:00Z&cam=30,31,${String(distance)}`);
          await ready(page);
          if (distance < 1.5)
            await expect(page.getByTestId('globe')).not.toHaveAttribute(
              'data-earth-tiles',
              '0/0/0',
            );
          const png = await canvas.screenshot();
          writeFileSync(`${output}/${String(width)}-${String(distance)}.png`, png);
          screenshots.set(`${String(width)}-${String(distance)}`, png.toString('base64'));
          await info.attach(`${String(width)}-${String(distance)}`, {
            body: png,
            contentType: 'image/png',
          });
        }
      }
      expect(uploads.some((upload) => upload.width === width)).toBe(true);
      const gpu = await page.evaluate(() =>
        (Reflect.get(window, '__renderingProbe') as Probe).gpu(),
      );
      samples.push({ width, repeat, uploads, gpu, browser: browser.version() });
      expect(problems).toEqual([]);
      await context.close();
    }
  }
  const differences = [];
  const page = await browser.newPage();
  for (const distance of [2.4, 1.6, 1.3, 1.008]) {
    const difference = await compare(
      page,
      screenshots.get(`8192-${String(distance)}`) ?? '',
      screenshots.get(`4096-${String(distance)}`) ?? '',
    );
    writeFileSync(
      `${output}/difference-x4-${String(distance)}.png`,
      Buffer.from(difference.differencePng, 'base64'),
    );
    await info.attach(`difference-x4-${String(distance)}`, {
      body: Buffer.from(difference.differencePng, 'base64'),
      contentType: 'image/png',
    });
    differences.push({
      distance,
      meanChannelDifference: difference.meanChannelDifference,
      fractionOver8: difference.fractionOver8,
      worst: difference.worst,
    });
  }
  await page.close();
  const report = JSON.stringify({ samples, differences }, null, 2);
  writeFileSync(`${output}/results.json`, report);
  await info.attach('results', { body: report, contentType: 'application/json' });
  console.warn(report);
});
