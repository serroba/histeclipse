import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { mountEmpires } from './body';
import { createBorderFiles } from './files';

const start = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const at = (state: ViewState, year: number): ViewState => ({
  ...state,
  time: moveToYear(state.time, astronomicalYear(year)),
});
const off = at(start, -499);
const on: ViewState = { ...off, layers: withLayer(off.layers, 'empires', true) };
/** Persepolis, in the Achaemenid Empire in 500 BCE. */
const persepolis: ViewState = { ...on, location: { latitude: 29.93, longitude: 52.89 } };
const JD = 2451545;

interface Drawn {
  readonly territories: readonly { readonly name: string }[];
  readonly ohm: unknown;
  readonly changes: readonly unknown[];
  readonly paintKey: string;
}

/** A context that serves the site's own files and records what the feature asks of the app. */
function fakeContext(options: { readonly failing?: boolean } = {}) {
  const notify = vi.fn();
  const update = vi.fn<(drawn: Drawn | null) => void>();
  const states = vi.fn();
  const again = vi.fn();
  const fetchJson = vi.fn(async (url: string) => {
    // The indexes arrive; a century's file does not.
    if (options.failing === true && !url.endsWith('index.json')) throw new Error('offline');
    return new Response(await readFile(`public${url}`, 'utf8'));
  });
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh: vi.fn(),
    globe: { addLayer: () => ({ update }) },
    stateBorders: createBorderFiles('/', fetchJson),
    yearsTrack: { states },
    whyHere: { again },
  } as unknown as FeatureContext<Capability>;
  return { context, notify, fetchJson, update, states, again };
}

/** The borders last drawn. */
function lastDrawn(update: ReturnType<typeof fakeContext>['update']): Drawn {
  const drawn = update.mock.lastCall?.[0] ?? null;
  if (drawn === null) throw new Error('nothing drawn');
  return drawn;
}

/** The feature mounted and shown `state`, its borders drawn. */
async function drawnAt(state: ViewState) {
  const fake = fakeContext();
  const shown = mountEmpires(fake.context);
  shown.show?.(state, JD);
  await vi.waitFor(() => {
    expect(fake.update).toHaveBeenCalled();
  });
  return { ...fake, shown };
}

describe('the borders of past states, the feature’s body', () => {
  it('draws nothing while its layer is off, or in deep time', () => {
    const { context, update, fetchJson } = fakeContext();
    const shown = mountEmpires(context);
    shown.show?.({ ...on, ma: 66 }, JD);
    shown.show?.(off, JD);
    expect(update).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
    expect(shown.here?.(off)).toBeNull();
  });

  it('takes the states away when the layer is turned off', async () => {
    const { shown, update } = await drawnAt(on);
    shown.show?.(off, JD);
    expect(update).toHaveBeenLastCalledWith(null);
  });

  it('draws the year’s states once, and tells "Why here?" they were drawn', async () => {
    const { shown, update, again, states } = await drawnAt(on);
    const drawn = lastDrawn(update);
    expect(drawn.territories.map(({ name }) => name)).toContain('Achaemenid Empire');
    expect(drawn.changes).toEqual([]);
    expect(again).toHaveBeenCalledTimes(1);
    // Nothing drawn before to compare with: the track is told nothing.
    expect(states).not.toHaveBeenCalled();
    shown.show?.(on, JD);
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('tells the years’ track what changed since the year drawn before, when it was near', async () => {
    const { shown, update, states } = await drawnAt(on);
    shown.show?.(at(on, -300), JD);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledTimes(2);
    });
    expect(states).toHaveBeenCalledTimes(1);
    expect(states.mock.lastCall?.[0]).toMatch(/\S/);
    // A jump of two centuries names no state on the map: every name would light up.
    expect(lastDrawn(update).changes).toEqual([]);
    shown.show?.(at(on, 1500), JD);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledTimes(3);
    });
    // Far apart, a list of what differs says little: the track is not told.
    expect(states).toHaveBeenCalledTimes(1);
  });

  it('draws by the source picked: OpenHistoricalMap’s lines alone, or both', async () => {
    const lines = await drawnAt({ ...at(on, 1500), borders: 'ohm' });
    expect(lastDrawn(lines.update).territories).toEqual([]);
    expect(lastDrawn(lines.update).ohm).not.toBeNull();
    expect(lastDrawn(lines.update).paintKey).toMatch(/^ohm:/);
    const both = await drawnAt({ ...at(on, 1500), borders: 'both' });
    expect(lastDrawn(both.update).territories.length).toBeGreaterThan(0);
    expect(lastDrawn(both.update).ohm).not.toBeNull();
  });

  it('says what the states have at the place picked: loading, then the state drawn there', async () => {
    const { context, update } = fakeContext();
    const shown = mountEmpires(context);
    expect(shown.here?.(on)).toBeNull();
    shown.show?.(persepolis, JD);
    expect(shown.here?.(persepolis)).toEqual([
      { title: 'States', text: 'Cliopatria’s borders are loading.', why: 'empires-cliopatria' },
    ]);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(shown.here?.(persepolis)).toMatchObject([
      { title: 'States', text: 'Cliopatria draws Achaemenid Empire here in 500 BCE.' },
    ]);
    expect(shown.here?.({ ...persepolis, borders: 'both' })).toHaveLength(2);
  });

  it('says today’s states are as Cliopatria last drew them', async () => {
    const today: ViewState = { ...persepolis, time: start.time };
    const { shown } = await drawnAt(today);
    expect(shown.here?.(today)).toMatchObject([
      { text: expect.stringMatching(/ here in \d+ CE\.$/) as string },
    ]);
  });

  it('tells the reader when the borders do not load, waits on its chip as the years go by, and tries again from there (#762)', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = mountEmpires(context);
    shown.show?.(on, JD);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the borders of past states: offline');
    });
    const asked = fetchJson.mock.calls.length;
    // Time plays on: other years ask nothing of the server until Try again.
    shown.show?.(at(on, -498), JD);
    shown.show?.(on, JD);
    expect(fetchJson.mock.calls.length).toBe(asked);
    expect(notify).toHaveBeenCalledOnce();
    const failed = shown.load?.();
    if (failed?.state !== 'failed') throw new Error('expected a failed load');
    failed.retry();
    shown.show?.(on, JD);
    await vi.waitFor(() => {
      expect(fetchJson.mock.calls.length).toBeGreaterThan(asked);
    });
    shown.show?.({ ...on, layers: new Set() }, JD);
    expect(shown.load?.()).toBeNull();
  });
});
