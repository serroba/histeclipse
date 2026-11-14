/**
 * Measuring a stretch of an interaction for the rendering audit (#661): the page's own counters
 * (probe.ts) and Chromium's main-thread metrics, over an active phase, the settling after it and a
 * rest after that. Node side; the numbers are diagnostic, for comparison on one machine.
 */

import { writeFileSync } from 'node:fs';

import type { CDPSession, Page } from '@playwright/test';

import type { Probe, ProbeCounts } from './probe';

/** One phase of a scenario, summarised. */
interface Phase {
  readonly ms: number;
  readonly callbacks: number;
  /** Display frames with any animation-frame callback. */
  readonly awakeFrames: number;
  /** Gaps between awake frames, in ms: median, 95th percentile and worst. */
  readonly gap: { p50: number; p95: number; max: number };
  readonly draws: Readonly<Record<string, number>>;
  readonly drawFrames: Readonly<Record<string, number>>;
  readonly sizeSets: ProbeCounts['sizeSets'];
  readonly longFrames: ProbeCounts['longFrames'];
  /** Chromium's main-thread time, ms: all tasks, script, layout, style. */
  readonly taskMs: number;
  readonly scriptMs: number;
  readonly layoutMs: number;
  readonly styleMs: number;
  readonly layouts: number;
  readonly styles: number;
  /** JS heap used at the end, MB. */
  readonly heapMb: number;
}

export interface Sample {
  readonly active: Phase;
  /** From the end of the action until 500 ms pass without a callback (or the cap). */
  readonly settle: Phase & { quiet: boolean };
  readonly rest: Phase;
}

const METRICS = [
  'TaskDuration',
  'ScriptDuration',
  'LayoutDuration',
  'RecalcStyleDuration',
  'LayoutCount',
  'RecalcStyleCount',
  'JSHeapUsedSize',
] as const;
type Metric = (typeof METRICS)[number];

async function metrics(session: CDPSession): Promise<Record<Metric, number>> {
  const { metrics: list } = await session.send('Performance.getMetrics');
  const read = (name: Metric): number => list.find((metric) => metric.name === name)?.value ?? 0;
  return Object.fromEntries(METRICS.map((name) => [name, read(name)])) as Record<Metric, number>;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

async function take(page: Page): Promise<ProbeCounts> {
  return page.evaluate(() => (Reflect.get(window, '__renderingProbe') as Probe).take());
}

/** A stopwatch over one phase: start it, do the phase, and stop it for the summary. */
async function phase(page: Page, session: CDPSession): Promise<() => Promise<Phase>> {
  await take(page);
  const before = await metrics(session);
  const start = Date.now();
  return async () => {
    const counts = await take(page);
    const after = await metrics(session);
    const ms = Date.now() - start;
    const delta = (name: Metric): number => after[name] - before[name];
    const gaps = counts.frameTimes
      .slice(1)
      .map((time, index) => time - (counts.frameTimes[index] ?? time))
      .sort((a, b) => a - b);
    const round = (value: number): number => Math.round(value * 10) / 10;
    return {
      ms,
      callbacks: counts.callbacks,
      awakeFrames: counts.frameTimes.length,
      gap: {
        p50: round(percentile(gaps, 50)),
        p95: round(percentile(gaps, 95)),
        max: round(gaps.at(-1) ?? 0),
      },
      draws: counts.draws,
      drawFrames: counts.drawFrames,
      sizeSets: counts.sizeSets,
      longFrames: { ...counts.longFrames, ms: round(counts.longFrames.ms) },
      taskMs: round(delta('TaskDuration') * 1000),
      scriptMs: round(delta('ScriptDuration') * 1000),
      layoutMs: round(delta('LayoutDuration') * 1000),
      styleMs: round(delta('RecalcStyleDuration') * 1000),
      layouts: delta('LayoutCount'),
      styles: delta('RecalcStyleCount'),
      heapMb: round(after.JSHeapUsedSize / 1e6),
    };
  };
}

/** Wait, up to `capMs`, for 500 ms without an animation-frame callback. */
export async function untilQuiet(page: Page, capMs: number): Promise<boolean> {
  const deadline = Date.now() + capMs;
  while (Date.now() < deadline) {
    const quiet = await page.evaluate(() =>
      (Reflect.get(window, '__renderingProbe') as Probe).quietFor(),
    );
    if (quiet >= 500) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

export interface Run {
  readonly session: CDPSession;
  /** How long to watch the scene at rest after it settles. */
  readonly restMs: number;
  /** How long to wait for the scene to settle before giving up. */
  readonly settleCapMs: number;
  /** Where to save a CPU profile of the active phase, if anywhere (open it in DevTools). */
  readonly profileTo?: string;
}

/** Measure `action`, then its settling, then a rest. */
export async function sample(page: Page, run: Run, action: () => Promise<void>): Promise<Sample> {
  const stopActive = await phase(page, run.session);
  if (run.profileTo !== undefined) {
    await run.session.send('Profiler.enable');
    await run.session.send('Profiler.setSamplingInterval', { interval: 200 });
    await run.session.send('Profiler.start');
  }
  await action();
  const active = await stopActive();
  if (run.profileTo !== undefined) {
    const { profile } = await run.session.send('Profiler.stop');
    writeFileSync(run.profileTo, JSON.stringify(profile));
  }
  const stopSettle = await phase(page, run.session);
  const quiet = await untilQuiet(page, run.settleCapMs);
  const settle = { ...(await stopSettle()), quiet };
  const stopRest = await phase(page, run.session);
  await page.waitForTimeout(run.restMs);
  const rest = await stopRest();
  return { active, settle, rest };
}
