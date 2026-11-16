import { describe, expect, it, vi } from 'vitest';

import history from '../../../public/data/ozone/history.json';
import maps from '../../../public/data/ozone/maps.json';
import shell from '../../../public/data/ozone/shell.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { FeatureContext } from '../feature';
import { ozoneLayer } from './ozoneLayer';
import type * as Seasons from './ozoneSeasons';
import { ozoneShellLayer } from './ozoneShellLayer';
import { ozoneFeature } from '.';

// Each October's image, standing in for the file: its name, so a test can tell which.
vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) =>
    url.includes('october-1990')
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ url, width: 361, height: 181 }),
}));

// A season's pixels, standing in for its image: every column of air from 20 to 26 km.
vi.mock('./ozoneSeasons', async (original) => {
  const real = await original<typeof Seasons>();
  return {
    ...real,
    ozoneSeasons: (base: string, arrived: () => void) =>
      real.ozoneSeasons(base, arrived, (url) => {
        if (url.includes('shell-2007')) return Promise.reject(new Error('offline'));
        const pixels = new Uint8ClampedArray(184 * 61 * 120 * 4);
        for (let at = 0; at < pixels.length; at += 4) pixels.set([100, 160, 100, 255], at);
        return Promise.resolve(pixels);
      }),
  };
});

/** The view on a day of a year, at noon. */
function onDay(state: ViewState, year: number, month: number, day: number): ViewState {
  const date = { ...state.time.date, year: astronomicalYear(year), month, day };
  return { ...state, time: { date, minuteOfDay: 720 } };
}

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'ozone', true) };
const inYear = (year: number): ViewState => ({
  ...on,
  time: moveToYear(on.time, astronomicalYear(year)),
});
const JD = 2451545;

/** A context that records what the feature draws: the cap and the panel apart. */
function fakeContext(options: { readonly failures?: number } = {}) {
  let failures = options.failures ?? 0;
  const caps: unknown[] = [];
  const panels: unknown[] = [];
  const surfaces: unknown[] = [];
  const changes: ((state: ViewState) => ViewState)[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) => {
      // The record and the maps' index are asked for together: one failure fails both.
      if (url.endsWith('history.json')) failures -= 1;
      return failures >= 0
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(
            new Response(
              JSON.stringify(
                url.endsWith('maps.json') ? maps : url.endsWith('shell.json') ? shell : history,
              ),
            ),
          );
    },
    globe: {
      addLayer: (factory: unknown) => ({
        update: (input: unknown) =>
          (factory === ozoneLayer ? caps : factory === ozoneShellLayer ? surfaces : panels).push(
            input,
          ),
      }),
    },
    notify,
    refresh,
    change: (update: (state: ViewState) => ViewState) => changes.push(update),
  } as unknown as FeatureContext;
  return { context, caps, panels, surfaces, changes, refresh, notify };
}

describe('the ozone layer as a feature', () => {
  it('Given the layer off, Then nothing is drawn or said', () => {
    const { context, caps, panels } = fakeContext();
    const shown = ozoneFeature.mount(context);
    shown.show?.({ ...inYear(2006), layers: off.layers }, JD);
    expect(caps).toEqual([null]);
    expect(panels).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('Given it on, Then it loads once, and draws each year’s October once its map has come, the hole’s cap until then, and nothing for years outside', async () => {
    const { context, caps, panels, refresh } = fakeContext();
    const shown = ozoneFeature.mount(context);
    shown.show?.(inYear(2006), JD);
    expect(shown.said?.()).toBe('Loading the ozone record…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    shown.show?.(inYear(2006), JD);
    // At once the hole as a cap of its mean area, while that October's map is fetched.
    expect(caps.at(-1)).toEqual({ capMkm2: 26.6 });
    expect(panels.at(-1)).toMatchObject({
      text: '2006: 26.6 million km², lowest 98 DU.',
      map: null,
    });
    expect(shown.said?.()).toContain('Drawn as a cap of that area');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    shown.show?.(inYear(2006), JD);
    // Then the map: the whole Earth's ozone that October, the hole in its own shape.
    expect(caps.at(-1)).toMatchObject({
      map: { year: 2006, image: { url: '/data/ozone/october-2006.png' }, encoding: maps.encoding },
    });
    expect(panels.at(-1)).toMatchObject({
      map: 'Globe: ozone in October 2006, Dobson units.',
    });
    expect(shown.said?.()).toMatch(
      /^Ozone over the whole Earth, October 2006.*The Antarctic ozone hole in the spring of 2006: 26\.6 million km²/,
    );
    // The same year again draws nothing new.
    const drawn = caps.length;
    shown.show?.(inYear(2006), JD);
    expect(caps).toHaveLength(drawn);

    // 1995: no satellite measured the hole day by day, but the reanalysis has its October.
    shown.show?.(inYear(1995), JD);
    expect(caps.at(-1)).toBeNull();
    expect(shown.said?.()).toMatch(/No satellite measured/);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(3);
    });
    shown.show?.(inYear(1995), JD);
    expect(caps.at(-1)).toMatchObject({ map: { year: 1995 } });
    expect(shown.said?.()).toContain('NASA’s record leaves it empty');

    // A map that cannot be fetched: the cap stays.
    shown.show?.(inYear(1990), JD);
    await Promise.resolve();
    await Promise.resolve();
    shown.show?.(inYear(1990), JD);
    expect(caps.at(-1)).toEqual({ capMkm2: 19.2 });

    // 1975: before NASA's record, the reanalysis's map alone, with its gaps said.
    shown.show?.(inYear(1975), JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(4);
    });
    shown.show?.(inYear(1975), JD);
    expect(caps.at(-1)).toMatchObject({ map: { year: 1975 } });
    expect(shown.said?.()).toContain('NASA’s record of the hole runs from 1979');
    // 1977: left out of the reanalysis, and said so; 1900: nothing at all.
    shown.show?.(inYear(1977), JD);
    expect(caps.at(-1)).toBeNull();
    expect(shown.said?.()).toContain('under a tenth of the Earth');
    shown.show?.(inYear(1900), JD);
    expect(caps.at(-1)).toBeNull();
    // In deep time it rests.
    shown.show?.({ ...on, ma: 100 }, JD);
    expect(caps.at(-1)).toBeNull();
    expect(panels.at(-1)).toBeNull();
  });

  it('Given it on, Then its load is said loading until the record arrives, and nothing once drawn', async () => {
    const { context, refresh } = fakeContext();
    const shown = ozoneFeature.mount(context);
    expect(shown.load?.()).toBeNull();
    shown.show?.(inYear(2006), JD);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    expect(shown.load?.()).toBeNull();
  });

  it('Given the record does not load, Then it says so, waits rather than trying at each moment, and loads when tried again (#751)', async () => {
    const { context, notify, refresh, caps } = fakeContext({ failures: 1 });
    const shown = ozoneFeature.mount(context);
    shown.show?.(inYear(2006), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ozone record: offline');
    });
    expect(refresh).toHaveBeenCalledOnce();
    const failed = shown.load?.();
    expect(failed?.state).toBe('failed');
    shown.show?.(inYear(2006), JD);
    shown.show?.(inYear(2007), JD);
    expect(shown.said?.()).toBe('Could not load the ozone record.');
    expect(notify).toHaveBeenCalledOnce();
    if (failed?.state === 'failed') failed.retry();
    expect(shown.load?.()).toEqual({ state: 'loading' });
    shown.show?.(inYear(2007), JD);
    expect(shown.said?.()).toBe('Loading the ozone record…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(3);
    });
    shown.show?.(inYear(2007), JD);
    expect(caps.at(-1)).toEqual({ capMkm2: expect.any(Number) as unknown });
    expect(notify).toHaveBeenCalledOnce();
  });

  it('Given a day from July to December of a year with a season, Then that day’s surface is drawn round the Earth once its season has come, nothing painted on the ground, and the player can go to another day (#804)', async () => {
    const { context, caps, panels, surfaces, changes, refresh } = fakeContext();
    const shown = ozoneFeature.mount(context);
    const september = onDay(on, 2006, 9, 25);
    shown.show?.(september, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    // Until its season has come: no surface yet, and the player already at the day.
    shown.show?.(september, JD);
    expect(surfaces.at(-1)).toBeNull();
    expect(panels.at(-1)).toMatchObject({ season: { year: 2006, day: 86, days: 184 } });
    await vi.waitFor(() => {
      shown.show?.(september, JD);
      expect(surfaces.at(-1)).toMatchObject({ rows: 61, columns: 120 });
    });
    expect(caps.at(-1)).toBeNull();
    expect(panels.at(-1)).toMatchObject({
      surface: true,
      map: 'Globe: the ozone layer on 25 September 2006, coloured by total ozone, Dobson units; its heights drawn 40 times larger.',
      season: { label: '25 September 2006' },
    });
    expect(shown.said?.()).toMatch(
      /^The ozone layer on 25 September 2006 at 12:00 UT.*The Antarctic ozone hole in the spring of 2006/,
    );

    // The player goes to 1 October: the view's date changes, at noon.
    const { season } = panels.at(-1) as { season: { go(day: number): void } };
    season.go(92);
    expect(changes.at(-1)?.(september).time).toEqual({
      date: { year: 2006, month: 10, day: 1, calendar: 'gregorian' },
      minuteOfDay: 720,
    });

    // The same day again draws nothing new; the next day is another surface.
    const drawn = surfaces.length;
    shown.show?.(september, JD);
    expect(surfaces).toHaveLength(drawn);
    shown.show?.(onDay(on, 2006, 9, 26), JD);
    expect(surfaces).toHaveLength(drawn + 1);
    expect(surfaces.at(-1)).not.toBe(surfaces.at(-2));

    // A date outside the season: the year's map again, and the way into the season offered.
    shown.show?.(inYear(2006), JD);
    expect(surfaces.at(-1)).toBeNull();
    expect(panels.at(-1)).toMatchObject({
      surface: false,
      season: { day: null, label: '1 July to 31 December 2006' },
    });
    // A year with no season has no player; the layer off takes the surface away.
    shown.show?.(inYear(1990), JD);
    expect(panels.at(-1)).toMatchObject({ season: null });
    shown.show?.({ ...september, layers: off.layers }, JD);
    expect(surfaces.at(-1)).toBeNull();
  });

  it('Given a season that cannot be fetched, Then the year’s map stays (#804)', async () => {
    const { context, caps, surfaces, refresh } = fakeContext();
    const shown = ozoneFeature.mount(context);
    const day = onDay(on, 2007, 9, 25);
    shown.show?.(day, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    await vi.waitFor(() => {
      shown.show?.(day, JD);
      expect(caps.at(-1)).toMatchObject({ map: { year: 2007 } });
    });
    expect(surfaces.at(-1)).toBeNull();
  });
});
