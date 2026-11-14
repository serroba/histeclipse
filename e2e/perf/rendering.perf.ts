/**
 * The rendering audit's scenario matrix (#661): each interaction measured on the production build,
 * its active phase, its settling and a rest after. Not part of CI; run on a machine with a real GPU
 * (see README.md). Each scenario writes its samples to test-results/rendering-audit/.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { type Run, type Sample, sample, untilQuiet } from './measure';
import { installProbe, type Probe } from './probe';

const REPEATS = Number(process.env['REPEATS'] ?? 3);
const OUT = path.join(process.cwd(), 'test-results', 'rendering-audit');
const ECLIPSE_2024 = './?t=2024-04-08T18:17&cam=20,0,4.5';
const THALES = './?t=-584-05-28T12:00&sel=solar:-0584-05-28';
const BABYLON_NIGHT = './?mode=sky&t=-2999-03-20T19:00&loc=32.5422,44.4209';
const BABYLON_NOON = './?mode=sky&t=2025-03-20T09:00&loc=32.5422,44.4209&look=180,45,90';

test.beforeEach(async ({ page }) => {
  // Keep audit runs out of the site's telemetry.
  await page.route('https://api.honeycomb.io/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.addInitScript(installProbe);
});

async function rendered(page: Page, testId: 'globe' | 'sky'): Promise<void> {
  await expect(page.getByTestId(testId)).toHaveAttribute('data-rendered', 'true', {
    timeout: 30_000,
  });
}

/** A drag across `target`'s free middle, one pointer move per display frame or so. */
async function drag(page: Page, target: Locator, dx: number, dy: number): Promise<void> {
  const box = await target.boundingBox();
  if (box === null) throw new Error('nothing to drag');
  const from = { x: box.x + box.width / 2, y: box.y + (box.height * 2) / 3 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const moves = 60;
  for (let move = 1; move <= moves; move += 1) {
    await page.mouse.move(from.x + (dx * move) / moves, from.y + (dy * move) / moves);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

interface Scenario {
  /** Open the page and bring it to rest before measuring. */
  readonly setup: (page: Page) => Promise<void>;
  /** The interaction measured as the active phase. */
  readonly action: (page: Page) => Promise<void>;
}

const SCENARIOS: Record<string, Scenario> = {
  'globe idle': {
    setup: async (page) => {
      await page.goto(ECLIPSE_2024);
      await rendered(page, 'globe');
    },
    action: (page) => page.waitForTimeout(3000),
  },
  'globe drag': {
    setup: async (page) => {
      await page.goto(ECLIPSE_2024);
      await rendered(page, 'globe');
    },
    action: (page) => drag(page, page.getByTestId('globe'), -240, 80),
  },
  'globe flight out to the Moon and back': {
    setup: async (page) => {
      await page.goto(ECLIPSE_2024);
      await rendered(page, 'globe');
    },
    action: async (page) => {
      // On phones the rail's names sit under other controls; the stop is pressed directly.
      const rail = page.getByRole('group', { name: 'Zoom' });
      await rail
        .getByRole('button', { name: 'Zoom to Earth and the Moon’s orbit' })
        .dispatchEvent('click');
      await page.waitForTimeout(2500);
      await rail.getByRole('button', { name: 'Zoom to The whole Earth' }).dispatchEvent('click');
      await page.waitForTimeout(2500);
    },
  },
  'eclipse plays, then pauses': {
    setup: async (page) => {
      await page.goto(THALES);
      await rendered(page, 'globe');
      await page.locator('.scrubber').getByLabel('Speed').selectOption('60');
    },
    action: async (page) => {
      const scrubber = page.locator('.scrubber');
      await scrubber.getByRole('button', { name: 'Play' }).click();
      await page.waitForTimeout(4000);
      await scrubber.getByRole('button', { name: 'Pause' }).click();
    },
  },
  'eclipse scrubbed by keyboard': {
    setup: async (page) => {
      await page.goto(THALES);
      await rendered(page, 'globe');
      await page.getByLabel('Time relative to greatest eclipse').focus();
    },
    action: async (page) => {
      for (let press = 0; press < 60; press += 1) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(16);
      }
    },
  },
  'deep time plays, then pauses': {
    setup: async (page) => {
      await page.goto('./?ma=250');
      await rendered(page, 'globe');
      await page
        .getByRole('navigation', { name: 'Deep time' })
        .getByLabel('Speed')
        .selectOption('5');
    },
    action: async (page) => {
      const deep = page.getByRole('navigation', { name: 'Deep time' });
      await deep.getByRole('button', { name: 'Play', exact: true }).click();
      await page.waitForTimeout(4000);
      await deep.getByRole('button', { name: 'Pause', exact: true }).click();
    },
  },
  'sky idle': {
    setup: async (page) => {
      await page.goto(BABYLON_NIGHT);
      await rendered(page, 'sky');
    },
    action: (page) => page.waitForTimeout(3000),
  },
  'sky drag': {
    setup: async (page) => {
      await page.goto(BABYLON_NIGHT);
      await rendered(page, 'sky');
    },
    action: (page) => drag(page, page.getByTestId('sky'), 240, 0),
  },
  'sky glide to the Sun, on to the globe': {
    setup: async (page) => {
      await page.goto(BABYLON_NOON);
      await rendered(page, 'sky');
      await expect(page.getByTestId('sky')).toHaveAttribute('data-sun-at', /^\d+,\d+$/);
    },
    action: async (page) => {
      const sky = page.getByTestId('sky');
      const at = (await sky.getAttribute('data-sun-at'))?.split(',').map(Number) ?? [];
      const box = await sky.boundingBox();
      if (box === null) throw new Error('sky has no size');
      await page.mouse.click(box.x + (at[0] ?? 0), box.y + (at[1] ?? 0));
      await expect(page).toHaveURL(/mode=globe/, { timeout: 15_000 });
    },
  },
  'globe to sky and back': {
    setup: async (page) => {
      await page.goto(ECLIPSE_2024);
      await rendered(page, 'globe');
    },
    action: async (page) => {
      await page.getByRole('button', { name: 'Sky' }).click();
      await rendered(page, 'sky');
      await page.waitForTimeout(2000);
      await page.getByRole('button', { name: 'Orbit' }).click();
      await expect(page.getByTestId('globe')).toBeVisible();
      await page.waitForTimeout(1000);
    },
  },
  'carbon-14 story plays, then pauses': {
    setup: async (page) => {
      await page.goto('./?t=1500-06-01T12:00&loc=48,10&layers=carbonMade');
      await rendered(page, 'globe');
      const layers = page.getByRole('button', { name: 'Layers' });
      if ((await layers.getAttribute('aria-expanded')) !== 'true') await layers.click();
      await page.getByRole('button', { name: 'How is it made?' }).click();
      await page
        .getByRole('dialog', { name: 'How is carbon-14 made?' })
        .getByRole('button', { name: 'Watch a cosmic ray make carbon-14' })
        .click();
      await expect(page.getByTestId('globe')).toHaveAttribute('data-shower-step', /./, {
        timeout: 30_000,
      });
      // Paused, so each sample starts from rest (on the phone profile it never does: see
      // FINDINGS.md).
      await page.waitForTimeout(1000);
      await page
        .getByRole('region', { name: 'How carbon-14 is made, step by step' })
        .getByRole('button', { name: 'Pause', exact: true })
        .click();
    },
    action: async (page) => {
      const stage = page.getByRole('region', { name: 'How carbon-14 is made, step by step' });
      await stage.getByRole('button', { name: 'Replay' }).click();
      await page.waitForTimeout(4000);
      await stage.getByRole('button', { name: 'Pause', exact: true }).click();
    },
  },
};

for (const [name, scenario] of Object.entries(SCENARIOS)) {
  test(name, async ({ page, browserName }, info) => {
    test.setTimeout(60_000 + REPEATS * 45_000);
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable');
    const throttle = Number(process.env['CPU_THROTTLE'] ?? (info.project.name === 'phone' ? 4 : 1));
    if (throttle > 1) await session.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    const slug = `${info.project.name}-${name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
    mkdirSync(OUT, { recursive: true });
    const samples: Sample[] = [];
    const setupQuiet: boolean[] = [];
    let gpu = '';
    for (let repeat = 0; repeat < REPEATS; repeat += 1) {
      // PROFILE=1 saves a CPU profile of the first repeat's active phase beside the samples.
      const profileTo =
        process.env['PROFILE'] === '1' && repeat === 0
          ? path.join(OUT, `${slug}.cpuprofile`)
          : undefined;
      const run: Run = {
        session,
        restMs: 2000,
        settleCapMs: 15_000,
        ...(profileTo !== undefined && { profileTo }),
      };
      await scenario.setup(page);
      // Start each sample from rest where the page comes to rest; a page that never does is a
      // finding, recorded rather than failed.
      setupQuiet.push(await untilQuiet(page, 20_000));
      gpu = await page.evaluate(() => (Reflect.get(window, '__renderingProbe') as Probe).gpu());
      samples.push(await sample(page, run, () => scenario.action(page)));
    }
    const environment = {
      browser: `${browserName} ${page.context().browser()?.version() ?? ''}`,
      gpu,
      viewport: page.viewportSize(),
      deviceScaleFactor: info.project.use.deviceScaleFactor ?? 1,
      cpuThrottle: throttle,
      cache: 'warm HTTP cache: the same browser context loads the page for every repeat',
      commit: process.env['AUDIT_COMMIT'] ?? 'unknown',
    };
    writeFileSync(
      path.join(OUT, `${slug}.json`),
      JSON.stringify(
        { scenario: name, project: info.project.name, environment, setupQuiet, samples },
        null,
        2,
      ),
    );
  });
}
