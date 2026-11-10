import { describe, expect, it, vi } from 'vitest';

import paths from '../../../public/data/spacecraft-paths.json';
import record from '../../../public/data/spacecraft.json';
import type { PlanetEphemeris } from '../../astro/planets';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { FeatureContext } from '../feature';
import { spacecraftFeature } from '.';

const AU = 149_597_870.7;
// 2010: Voyagers, Cassini, New Horizons and others in flight.
const JD_2010 = 2455197.5;
const now = new Date('2026-01-01T00:00:00Z');
const off = defaultViewState(now);
const on: ViewState = { ...off, layers: withLayer(off.layers, 'spacecraft', true) };

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: { readonly planetsLoaded: boolean; readonly failing?: boolean }) {
  const drawn: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const rail: [boolean, boolean][] = [];
  const planets = { position: () => [0, AU, 0] } as unknown as PlanetEphemeris;
  const refresh = vi.fn();
  const notify = vi.fn();
  const loadPlanets = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(
            new Response(JSON.stringify(url.endsWith('spacecraft-paths.json') ? paths : record)),
          ),
    globe: { addLayer: () => ({ update: (input: unknown) => drawn.push(input) }) },
    zoomRail: {
      setSpacecraft: (offered: boolean, shown: boolean) => rail.push([offered, shown]),
    },
    notify,
    showCard: (card: MarkerCardContent) => cards.push(card),
    planets: () => (options.planetsLoaded ? planets : null),
    loadPlanets,
    moon: () => null,
    refresh,
  } as unknown as FeatureContext;
  return { context, drawn, cards, rail, refresh, notify, loadPlanets };
}

describe('the spacecraft as a feature', () => {
  it('is shown again when the layers change, and not for other changes', () => {
    expect(spacecraftFeature.watches(on)).toEqual([on.layers]);
    expect(spacecraftFeature.watches({ ...on, mode: 'sky' })).toEqual([on.layers]);
  });

  it('draws nothing while its layer is off, and offers its icon in the globe view', () => {
    const { context, drawn, rail } = fakeContext({ planetsLoaded: true });
    spacecraftFeature.mount(context).show(off, JD_2010);
    expect(drawn).toEqual([null]);
    expect(rail).toEqual([[true, false]]);
  });

  it('in deep time they are neither offered nor drawn', () => {
    const { context, drawn, rail } = fakeContext({ planetsLoaded: true });
    spacecraftFeature.mount(context).show({ ...on, ma: 100 }, JD_2010);
    expect(drawn).toEqual([null]);
    expect(rail).toEqual([[false, true]]);
  });

  it('loads the record and paths once, then draws the craft in flight and opens a card on a tap', async () => {
    const { context, drawn, cards, refresh, loadPlanets } = fakeContext({ planetsLoaded: false });
    const craft = spacecraftFeature.mount(context);
    craft.show(on, JD_2010);
    craft.show(on, JD_2010);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(loadPlanets).toHaveBeenCalled();
    expect(drawn).toEqual([]);

    craft.show(on, JD_2010);
    const flying = drawn[0] as readonly { id: string; km: readonly number[] }[];
    expect(flying.length).toBeGreaterThan(5);
    expect(flying.every(({ km }) => km.every(Number.isFinite))).toBe(true);

    const first = flying[0];
    if (first === undefined) throw new Error('no craft in flight');
    craft.pick?.(first.id);
    expect(cards).toHaveLength(1);
    craft.pick?.('no-such-craft');
    expect(cards).toHaveLength(1);
  });

  it('says so when the record cannot be loaded, and tries again next time', async () => {
    const { context, notify } = fakeContext({ planetsLoaded: true, failing: true });
    const craft = spacecraftFeature.mount(context);
    craft.show(on, JD_2010);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the spacecraft: offline');
    });
    craft.show(on, JD_2010);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
