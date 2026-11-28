import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { Capability, FeatureContext } from '../feature';

// The chart's panel in deep time's bar: what it is shown, by the context it was made for.
const panelViews = vi.hoisted(() => new Map<HTMLElement, unknown[]>());
vi.mock('./holocenePanel', () => ({
  holocenePanel: (slot: HTMLElement) => {
    const views = panelViews.get(slot) ?? [];
    return { update: (view: unknown) => views.push(view), dispose: () => undefined };
  },
}));

const { chartShown, maOfChart, temperatureFeature } = await import('.');

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const off: ViewState = { ...base, ma: 100, deepScale: 'all' };
const on: ViewState = { ...off, layers: withLayer(off.layers, 'temperature', true) };
const cretaceous = { ma: 100, scale: 'all' } as const;

/** A context that serves the site's own files and records what the feature asks of the app. */
function fakeContext() {
  const notify = vi.fn();
  const again = vi.fn();
  const setTemperature = vi.fn();
  const prefetch = vi.fn();
  const chartSlot = {} as HTMLElement;
  const panels: unknown[] = [];
  panelViews.set(chartSlot, panels);
  const refresh = vi.fn();
  const change = vi.fn();
  const fetchJson = vi.fn(
    async (url: string) => new Response(await readFile(`public${url}`, 'utf8')),
  );
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh,
    change,
    temperatureMaps: { setTemperature, prefetch },
    deepTime: { again, chartSlot },
  } as unknown as FeatureContext<Capability>;
  return {
    context,
    notify,
    again,
    setTemperature,
    prefetch,
    fetchJson,
    panels,

    refresh,
    change,
  };
}

describe('the temperature maps as a feature', () => {
  it('asks for the maps on the globe and deep time, and watches the layers, the moment and the choices', () => {
    expect(temperatureFeature.needs).toEqual(['temperatureMaps', 'deepTime']);
    expect(temperatureFeature.watches(on)).toEqual([
      on.layers,
      100,
      'all',
      on.temperatureModel,
      on.temperatureShow,
      on.mode,
      on.focus,
      on.boundaries,
    ]);
  });

  it('says it is off, and colours nothing, while its layer is off', () => {
    const { context, fetchJson } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    expect(shown.deepBar?.(off, cretaceous)).toMatchObject({
      temperature: { on: false },
      temperatureDrawn: false,
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('loads its maps with the layer on, asks deep time to draw again, then colours the globe', async () => {
    const { context, again, setTemperature, notify } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    expect(shown.deepBar?.(on, cretaceous)).toMatchObject({
      temperature: { on: true, shown: null },
      temperatureDrawn: false,
    });
    await vi.waitFor(() => {
      expect(again).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(shown.deepBar?.(on, cretaceous)).toMatchObject({
        temperature: { on: true },
        temperatureDrawn: true,
      });
    });
    expect(setTemperature).toHaveBeenLastCalledWith(expect.objectContaining({}));
    expect(notify).not.toHaveBeenCalled();
  });

  it('fetches the maps ahead while deep time plays towards the present', async () => {
    const { context, again, prefetch } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    shown.deepBar?.(on, cretaceous);
    await vi.waitFor(() => {
      expect(again).toHaveBeenCalled();
      expect(shown.deepBar?.(on, cretaceous).temperatureDrawn).toBe(true);
    });
    shown.deepBar?.(on, { ...cretaceous, uncharted: false, maPerSecond: 5 });
    expect(prefetch).toHaveBeenCalled();
  });

  it('shows the chart over 800,000 years in the bar only on the ice ages it covers (#434)', () => {
    const ice: ViewState = { ...on, ma: 0.021, deepScale: 'ice' };
    expect(chartShown(ice)).toBe(true);
    expect(chartShown({ ...ice, ma: 1.2 })).toBe(false);
    expect(chartShown(on)).toBe(false);
    expect(chartShown({ ...ice, layers: off.layers })).toBe(false);
    expect(chartShown({ ...ice, ma: null })).toBe(false);
    expect(chartShown({ ...ice, focus: 'moon' })).toBe(false);
    // The boundaries' story on its Holocene chapter shows its own chart: not two.
    expect(chartShown({ ...ice, boundaries: 'holocene' })).toBe(false);
  });

  it('takes a year on the chart to deep time’s moment, to the thousand years, within its reach', () => {
    expect(maOfChart(-18_050)).toBe(0.02);
    expect(maOfChart(2020)).toBe(0);
    expect(maOfChart(-2_000_000)).toBe(0.8);
  });

  it('loads the chart with the layer on over the ice ages, then shows it at the moment', async () => {
    const { context, panels, refresh } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    const ice: ViewState = { ...on, ma: 0.021, deepScale: 'ice' };
    shown.show?.(ice, 0);
    expect(panels).toEqual([]);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.show?.(ice, 0);
    expect(panels.at(-1)).toMatchObject({ year: -19_050 });
    const count = panels.length;
    shown.show?.(ice, 0);
    expect(panels).toHaveLength(count);
    shown.show?.(on, 0);
    expect(panels.at(-1)).toBeNull();
  });

  it('gives play the chart’s pace while it shows, the chart following play finer than the view keeps it (#1276)', async () => {
    const { context, panels, refresh } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    const ice: ViewState = { ...on, ma: 0.021, deepScale: 'ice' };
    // Not loaded yet, or not showing: play keeps its own pace.
    expect(shown.playAxis?.(ice)).toBeNull();
    shown.show?.(ice, 0);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(shown.playAxis?.({ ...ice, deepScale: 'all' })).toBeNull();
    const axis = shown.playAxis?.(ice);
    if (axis === undefined || axis === null) throw new Error('expected the chart’s timeline');
    // The chart's own clock: 12 s across the ice ages, then the Holocene.
    expect(axis.at(0.02195)).toBeCloseTo(12, 6);
    expect(axis.ma(axis.at(0.0005))).toBeCloseTo(0.0005, 9);
    // Play at 1890: the chart there, though the view keeps the moment as 0 (1950).
    axis.follow(0.00006);
    expect(panels.at(-1)).toMatchObject({ year: 1890, drawOn: false });
    const count = panels.length;
    shown.show?.({ ...ice, ma: 0 }, 0);
    expect(panels).toHaveLength(count);
    // At today, the chart draws on to its latest year.
    axis.ended();
    expect(panels.at(-1)).toMatchObject({ year: 1950, drawOn: true });
    // The reader moves the slider: the chart goes where the view is.
    shown.show?.({ ...ice, ma: 0.005 }, 0);
    expect(panels.at(-1)).toMatchObject({ year: -3050 });
    expect(panels.at(-1)).not.toHaveProperty('drawOn');
  });

  it('at today over the ice ages, colours the globe by the measured warming, and says so (#1283)', async () => {
    const { context, setTemperature, refresh } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    const today: ViewState = { ...on, ma: 0, deepScale: 'ice' };
    shown.show?.(today, 0);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    // The chart at its latest year, today: the measured maps asked for.
    shown.show?.(today, 0);
    // The measured maps arrive, and deep time draws again with them.
    await vi.waitFor(() => {
      shown.deepBar?.(today, { ma: 0, scale: 'ice' });
      expect(setTemperature).toHaveBeenLastCalledWith(
        expect.objectContaining({ younger: '/data/warming/2024.png' }),
      );
    });
    const fields = shown.deepBar?.(today, { ma: 0, scale: 'ice' });
    expect(setTemperature).toHaveBeenLastCalledWith(
      expect.objectContaining({ younger: '/data/warming/2024.png', change: true }),
    );
    expect(fields?.temperature?.note).toContain('Berkeley Earth');
    // 20,000 years ago: Krapp et al.'s maps, and their own note.
    const glacial = { ...today, ma: 0.02 };
    shown.show?.(glacial, 0);
    const before = setTemperature.mock.calls.length;
    const then = shown.deepBar?.(glacial, { ma: 0.02, scale: 'ice' });
    expect(setTemperature.mock.calls.slice(before).flat()).not.toContainEqual(
      expect.objectContaining({ younger: expect.stringContaining('warming') as unknown }),
    );
    expect(then?.temperature?.note ?? '').not.toContain('Berkeley Earth');
  });

  it('at today, the chart at its latest year, which the header reads (#1285)', async () => {
    const { context, panels, refresh, again } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    const today: ViewState = { ...on, ma: 0, deepScale: 'ice' };
    shown.show?.(today, 0);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.show?.(today, 0);
    shown.deepBar?.(today, { ma: 0, scale: 'ice' });
    const latest = (panels.at(-1) as { year: number }).year;
    expect(latest).toBeGreaterThanOrEqual(2024);
    expect(shown.storyDate?.()?.when).toBe(String(latest));
    expect(again).toHaveBeenCalled();
  });

  it('at today on the 540 Myr scale, colours the globe by the latest measured warming, and the header says so (#1289)', async () => {
    const { context, setTemperature, again } = fakeContext();
    const shown = temperatureFeature.mount(context, context);
    const today: ViewState = { ...on, ma: 0, deepScale: 'all' };
    const now = { ma: 0, scale: 'all' } as const;
    // Krapp et al.'s maps and the measured warming load: shown again until both are in.
    await vi.waitFor(() => {
      shown.deepBar?.(today, now);
      expect(setTemperature).toHaveBeenLastCalledWith(
        expect.objectContaining({ younger: '/data/warming/2024.png' }),
      );
    });
    const fields = shown.deepBar?.(today, now);
    expect(setTemperature).toHaveBeenLastCalledWith(
      expect.objectContaining({ younger: '/data/warming/2024.png', change: true }),
    );
    expect(fields?.temperature?.note).toContain('Berkeley Earth');
    expect(shown.storyDate?.()).toEqual({
      when: 'Today',
      what: 'Measured warming since 1850–1900',
    });
    expect(again).toHaveBeenCalled();
    // A million years ago: the models' own maps, and the header its own.
    const before = setTemperature.mock.calls.length;
    shown.deepBar?.({ ...today, ma: 1 }, { ma: 1, scale: 'all' });
    expect(setTemperature.mock.calls.slice(before).flat()).not.toContainEqual(
      expect.objectContaining({ younger: expect.stringContaining('warming') as unknown }),
    );
    expect(shown.storyDate?.()).toBeNull();
  });
});
