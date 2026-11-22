import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { datesFeature } from '.';

const start = defaultViewState(new Date('2026-01-01T00:00:00Z'));
/** 2000 BCE: the step from 2050 BCE to 1801 BCE. */
const off: ViewState = { ...start, time: moveToYear(start.time, astronomicalYear(-1999)) };
const on: ViewState = { ...off, layers: withLayer(off.layers, 'dates', true) };
/** Southern England: many dated sites. */
const england: ViewState = { ...on, location: { latitude: 51.5, longitude: -1.5 } };
/** The middle of the Pacific: no tile of dates. */
const ocean: ViewState = { ...on, location: { latitude: 0, longitude: -140 } };
const JD = 2451545;
const curves = { curves: { intcal20: 'north', shcal20: 'south' } };

/** A context that serves the site's own files and records what the feature asks of the app. */
function fakeContext(options: { readonly failing?: boolean } = {}) {
  const refresh = vi.fn();
  const notify = vi.fn();
  const update = vi.fn();
  const open = vi.fn();
  const travelling = vi.fn(() => false);
  const fetchJson = vi.fn(async (url: string) => {
    if (options.failing === true) throw new Error('offline');
    return new Response(await readFile(`public${url}`, 'utf8'));
  });
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh,
    globe: { addLayer: () => ({ update }) },
    timeline: { travelling },
    radiocarbon: { curves: () => Promise.resolve(curves) },
    datingCard: { open },
  } as unknown as FeatureContext<Capability>;
  return { context, refresh, notify, fetchJson, update, open, travelling };
}

/** The feature mounted and shown `state`, having asked to be shown again `refreshes` times. */
async function shownAt(state: ViewState, refreshes: number) {
  const fake = fakeContext();
  const shown = datesFeature.mount(fake.context, fake.context);
  shown.show?.(state, JD);
  for (let done = 1; done <= refreshes; done += 1) {
    await vi.waitFor(() => {
      expect(fake.refresh).toHaveBeenCalledTimes(done);
    });
    shown.show?.(state, JD);
  }
  return { ...fake, shown };
}

describe('the radiocarbon dates as a feature', () => {
  it('asks for time’s playing, the curves and the dating card, and watches the layers, deep time and the place', () => {
    expect(datesFeature.needs).toEqual(['timeline', 'radiocarbon', 'datingCard']);
    expect(datesFeature.watches(england)).toEqual([england.layers, england.ma, england.location]);
  });

  it('shows and says nothing while its layer is off, or in deep time', () => {
    const { context, fetchJson, update } = fakeContext();
    const shown = datesFeature.mount(context, context);
    shown.show?.(off, JD);
    shown.show?.({ ...on, ma: 66 }, JD);
    expect(shown.said?.()).toBeNull();
    expect(shown.action?.()).toBeNull();
    expect(update).toHaveBeenLastCalledWith(null);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('stays on the globe while the reader travels through the years, asking for no place', async () => {
    const { context, travelling, update, fetchJson, refresh } = fakeContext();
    travelling.mockReturnValue(true);
    const shown = datesFeature.mount(context, context);
    shown.show?.(england, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.show?.(england, JD);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ cells: expect.any(Array) as unknown }),
    );
    // The heat map only: a place's own dates wait until the years stand.
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('says it is loading, once, then shades the squares of the step and asks for a place', async () => {
    const { context, refresh, fetchJson, update } = fakeContext();
    const shown = datesFeature.mount(context, context);
    shown.show?.(on, JD);
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('Loading the radiocarbon dates…');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/radiocarbon-dates/heat.json');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(on, JD);
    expect(shown.said?.()).toMatch(
      /radiocarbon dates fall in 2050 BCE–1801 BCE: .+ Pick a place to see its sites\.$/,
    );
    const painted = update.mock.lastCall?.[0] as { readonly cells: readonly unknown[] };
    expect(painted.cells.length).toBeGreaterThan(0);
  });

  it('paints the squares again only when the year changes', async () => {
    const { shown, update } = await shownAt(on, 1);
    const painted = update.mock.calls.length;
    shown.show?.(on, JD);
    expect(update).toHaveBeenCalledTimes(painted);
    shown.show?.({ ...on, time: moveToYear(on.time, astronomicalYear(-999)) }, JD);
    expect(update).toHaveBeenCalledTimes(painted + 1);
  });

  it('names the place’s dates once its tile is in, and carries one across the curve', async () => {
    const { shown, refresh, fetchJson, open } = await shownAt(england, 2);
    expect(fetchJson).toHaveBeenCalledWith('/data/radiocarbon-dates/tiles/50_-5.json');
    expect(shown.said?.()).toMatch(/^\d+ dates in this square for 2050 BCE–1801 BCE: /);
    const action = shown.action?.();
    expect(action?.label).toBe('How was a date here found?');
    // Shown again, the same place and year ask for nothing more.
    shown.show?.(england, JD);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(shown.action?.()).toBe(action);
    action?.run();
    await vi.waitFor(() => {
      expect(open).toHaveBeenCalledTimes(1);
    });
    const [curve, name, age, error, note] = open.mock.lastCall as [
      string,
      string,
      number,
      number,
      string,
    ];
    expect([curve, name]).toEqual(['north', 'IntCal20']);
    expect(note).toContain(`${String(age)} ± ${String(error)} radiocarbon years, from p3k14c.`);
  });

  it('shades nothing before the years the dates are counted back to', async () => {
    const early = { ...england, time: moveToYear(england.time, astronomicalYear(-20000)) };
    const { shown, update, refresh } = await shownAt(early, 1);
    expect(update).toHaveBeenLastCalledWith(null);
    expect(shown.said?.()).toBe('Dates are counted back to 10,550 BCE (12,500 years before 1950).');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('says a place with no dates has none, and offers nothing', async () => {
    const { shown } = await shownAt(ocean, 2);
    expect(shown.action?.()).toBeNull();
    expect(shown.said?.()).not.toContain('Pick a place');
  });

  it('lets a tile that arrives for a place since left say nothing', async () => {
    const { shown, refresh } = await shownAt(on, 1);
    shown.show?.(england, JD);
    shown.show?.(ocean, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    shown.show?.(ocean, JD);
    expect(shown.action?.()).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('tells the reader when the dates do not load, waits on its chip, and tries again from there (#762)', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = datesFeature.mount(context, context);
    shown.show?.(on, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the radiocarbon dates: offline');
    });
    shown.show?.(on, JD);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(shown.said?.()).toBe('Could not load the radiocarbon dates.');
    const failed = shown.load?.();
    if (failed?.state !== 'failed') throw new Error('expected a failed load');
    failed.retry();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
