import { describe, expect, it, vi } from 'vitest';

import data from '../../../public/data/asteroids.json';
import type { PlanetEphemeris } from '../../astro/planets';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { FeatureContext } from '../feature';
import { asteroidsFeature } from '.';

const J2000 = 2451545;
const now = new Date('2026-01-01T00:00:00Z');
const off = defaultViewState(now);
const on: ViewState = { ...off, layers: withLayer(off.layers, 'asteroids', true) };

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(planetsLoaded: boolean) {
  const drawn: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const rail: [boolean, boolean][] = [];
  const planets = {
    heliocentric: () => [1.5e8, 0, 0],
  } as unknown as PlanetEphemeris;
  const refresh = vi.fn();
  const notify = vi.fn();
  const loadPlanets = vi.fn();
  const context = {
    base: '/',
    fetchJson: () => Promise.resolve(new Response(JSON.stringify(data))),
    globe: { addLayer: () => ({ update: (input: unknown) => drawn.push(input) }) },
    zoomRail: {
      setAsteroids: (offered: boolean, shown: boolean) => rail.push([offered, shown]),
    },
    notify,
    showCard: (card: MarkerCardContent) => cards.push(card),
    planets: () => (planetsLoaded ? planets : null),
    loadPlanets,
    refresh,
  } as unknown as FeatureContext;
  return { context, drawn, cards, rail, refresh, notify, loadPlanets };
}

describe('the asteroid belt as a feature', () => {
  it('is shown again when the layers change, and not for other changes', () => {
    expect(asteroidsFeature.watches(on)).toEqual([on.layers]);
    expect(asteroidsFeature.watches({ ...on, mode: 'sky' })).toEqual([on.layers]);
  });

  it('draws nothing while its layer is off, and offers its icon in the globe view', () => {
    const { context, drawn, rail } = fakeContext(true);
    asteroidsFeature.mount(context).show?.(off, J2000);
    expect(drawn).toEqual([null]);
    expect(rail).toEqual([[true, false]]);
  });

  it('in deep time it is neither offered nor drawn', () => {
    const { context, drawn, rail } = fakeContext(true);
    asteroidsFeature.mount(context).show?.({ ...on, ma: 100 }, J2000);
    expect(drawn).toEqual([null]);
    expect(rail).toEqual([[false, true]]);
  });

  it('loads the orbits once, then draws every asteroid from Earth and opens a card on a tap', async () => {
    const { context, drawn, cards, refresh } = fakeContext(true);
    const belt = asteroidsFeature.mount(context);
    belt.show?.(on, J2000);
    belt.show?.(on, J2000);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(drawn).toEqual([]);

    belt.show?.(on, J2000);
    const shown = drawn[0] as readonly { number: string; km: readonly number[] }[];
    expect(shown).toHaveLength(Object.keys(data.asteroids).length);
    expect(shown.every(({ km }) => km.every(Number.isFinite))).toBe(true);

    belt.pick?.('1');
    expect(cards).toHaveLength(1);
    belt.pick?.('no-such-asteroid');
    expect(cards).toHaveLength(1);
  });

  it('asks for the planets, and waits for them, before placing the belt', async () => {
    const { context, drawn, refresh, loadPlanets } = fakeContext(false);
    const belt = asteroidsFeature.mount(context);
    belt.show?.(on, J2000);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    belt.show?.(on, J2000);
    expect(loadPlanets).toHaveBeenCalled();
    expect(drawn).toEqual([]);
  });

  it('says so when the orbits cannot be loaded, and tries again next time', async () => {
    const { context, notify } = fakeContext(true);
    const failing = { ...context, fetchJson: () => Promise.reject(new Error('offline')) };
    const belt = asteroidsFeature.mount(failing);
    belt.show?.(on, J2000);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the asteroids: offline');
    });
    belt.show?.(on, J2000);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
