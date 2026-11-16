import { describe, expect, it, vi } from 'vitest';

import paths from '../../../public/data/spacecraft-paths.json';
import record from '../../../public/data/spacecraft.json';
import telescopePictures from '../../../public/data/telescope-pictures.json';
import type { MoonEphemeris } from '../../astro/moon';
import { PLANETS, type PlanetEphemeris } from '../../astro/planets';
import type { JulianDay } from '../../time/julianDay';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { FeatureContext } from '../feature';
import { spacecraftFeature } from '.';
import { landingSites } from './landingSites';
import { missionRoutes } from './routeLines';

const AU = 149_597_870.7;
// 2010: Voyagers, Cassini, New Horizons and others in flight.
const JD_2010 = 2455197.5;
const now = new Date('2026-01-01T00:00:00Z');
const off = defaultViewState(now);
const on: ViewState = { ...off, layers: withLayer(off.layers, 'spacecraft', true) };

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: {
  readonly planetsLoaded: boolean;
  readonly failing?: boolean;
  readonly noPictures?: boolean;
}) {
  const drawn: unknown[] = [];
  const routes: unknown[] = [];
  const sites: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const rail: [boolean, boolean][] = [];
  const planets = { position: () => [0, AU, 0] } as unknown as PlanetEphemeris;
  const refresh = vi.fn();
  const notify = vi.fn();
  const openAnchor = vi.fn();
  const loadPlanets = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) => {
      const pictures = url.endsWith('telescope-pictures.json');
      if (options.failing === true || (pictures && options.noPictures === true))
        return Promise.reject(new Error('offline'));
      const body = pictures
        ? telescopePictures
        : url.endsWith('spacecraft-paths.json')
          ? paths
          : record;
      return Promise.resolve(new Response(JSON.stringify(body)));
    },
    globe: {
      addLayer: (factory: unknown) => ({
        update: (input: unknown) =>
          (factory === missionRoutes ? routes : factory === landingSites ? sites : drawn).push(
            input,
          ),
      }),
    },
    zoomRail: {
      setSpacecraft: (offered: boolean, shown: boolean) => rail.push([offered, shown]),
    },
    notify,
    showCard: (card: MarkerCardContent) => cards.push(card),
    cardOpen: () => cards.length > 0,
    openAnchor,
    ephemerides: {
      planets: () => (options.planetsLoaded ? planets : null),
      loadPlanets,
      moon: () => null as MoonEphemeris | null,
      // As drawn at the moment: the same stand-ins, as the bodies would have them (#783).
      moonAt(jdTT: JulianDay) {
        return this.moon()?.position(jdTT) ?? null;
      },
      planetPositions: () =>
        options.planetsLoaded
          ? Object.fromEntries(PLANETS.map((planet) => [planet, [0, AU, 0]]))
          : null,
    },
    refresh,
  } as unknown as FeatureContext;
  return { context, drawn, routes, sites, cards, rail, refresh, notify, loadPlanets, openAnchor };
}

describe('the spacecraft as a feature', () => {
  it('is shown again when the layers change, and not for other changes', () => {
    expect(spacecraftFeature.watches(on)).toEqual([on.layers, null]);
    expect(spacecraftFeature.watches({ ...on, mode: 'sky' })).toEqual([on.layers, null]);
    expect(spacecraftFeature.watches({ ...on, mission: 'd00273' })).toEqual([on.layers, 'd00273']);
  });

  it('draws nothing while its layer is off, and offers its icon in the globe view', () => {
    const { context, drawn, rail } = fakeContext({ planetsLoaded: true });
    spacecraftFeature.mount(context).show?.(off, JD_2010);
    expect(drawn).toEqual([null]);
    expect(rail).toEqual([[true, false]]);
  });

  it('in deep time they are neither offered nor drawn', () => {
    const { context, drawn, rail } = fakeContext({ planetsLoaded: true });
    spacecraftFeature.mount(context).show?.({ ...on, ma: 100 }, JD_2010);
    expect(drawn).toEqual([null]);
    expect(rail).toEqual([[false, true]]);
  });

  it('loads the record and paths once, then draws the craft in flight and opens a card on a tap', async () => {
    const { context, drawn, cards, refresh, loadPlanets } = fakeContext({ planetsLoaded: false });
    const craft = spacecraftFeature.mount(context);
    craft.show?.(on, JD_2010);
    craft.show?.(on, JD_2010);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(loadPlanets).toHaveBeenCalled();
    expect(drawn).toEqual([]);

    craft.show?.(on, JD_2010);
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
    craft.show?.(on, JD_2010);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the spacecraft: offline');
    });
    craft.show?.(on, JD_2010);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });

  it('Given a mission named, Then only its craft are drawn, each with its whole route (#712)', async () => {
    const { context, drawn, routes, refresh, cards, openAnchor } = fakeContext({
      planetsLoaded: true,
    });
    const craft = spacecraftFeature.mount(context);
    const apollo: ViewState = { ...on, mission: 'd00273' };
    // 20 July 1969, 12:00 UT: Columbia in orbit about the Moon, Eagle about to land.
    const landingDay = 2440423;
    craft.show?.(apollo, landingDay);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    context.ephemerides.moon = () => ({ position: () => [384_400, 0, 0] }) as never;
    craft.show?.(apollo, landingDay);
    const flying = drawn.at(-1) as readonly { name: string; km: readonly number[] }[];
    expect(flying.map(({ name }) => name)).toEqual(['Apollo 11', 'Apollo 11']);
    // About Earth as it was then: at the Moon, not carried along Earth's orbit.
    expect(flying.every(({ km }) => Math.abs(Math.hypot(...km) - 384_400) < 1)).toBe(true);
    const lines = routes.at(-1) as readonly { points: readonly (readonly number[] | null)[] }[];
    expect(lines).toHaveLength(2);
    expect(lines[0]?.points.filter((point) => point !== null).length).toBeGreaterThan(100);

    // Its own craft's card offers no way to the mission already followed (#731).
    craft.pick?.('D00273');
    expect(cards.at(-1)?.related).toEqual([]);

    // Every craft again, without routes: its card leads to its mission's journey.
    craft.show?.(on, landingDay);
    expect(routes.at(-1)).toBeNull();
    craft.pick?.('D00273');
    const [follow] = cards.at(-1)?.related ?? [];
    expect(follow?.label).toBe('Follow Apollo 11');
    follow?.run();
    expect(openAnchor).toHaveBeenCalledWith(
      expect.objectContaining({ view: expect.stringContaining('mission=d00273') as unknown }),
    );
  });

  it('Given the Moon in view after Apollo 11 landed, Then Eagle is marked on it, and no craft is drawn at its centre (#716)', async () => {
    const { context, drawn, sites, refresh } = fakeContext({ planetsLoaded: true });
    const craft = spacecraftFeature.mount(context);
    const onMoon: ViewState = { ...on, focus: 'moon' };
    const afterLanding = 2440424; // 21 July 1969, 12:00 UT
    craft.show?.(onMoon, afterLanding);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    context.ephemerides.moon = () => ({ position: () => [384_400, 0, 0] }) as never;
    craft.show?.(onMoon, afterLanding);
    const flying = drawn.at(-1) as readonly { at: string | null }[];
    expect(flying.some(({ at }) => at === 'Luna')).toBe(false);
    const marked = sites.at(-1) as { body: string; sites: readonly { id: string }[] };
    expect(marked.body).toBe('moon');
    expect(marked.sites.some(({ id }) => id === 'D00274')).toBe(true);
    // From afar, craft at the Moon are drawn there again.
    craft.show?.(on, afterLanding);
    expect((drawn.at(-1) as readonly { at: string | null }[]).some(({ at }) => at === 'Luna')).toBe(
      true,
    );
  });

  it('Given Webb’s card, Then its pictures are asked for once and shown in it; other craft have none (#798)', async () => {
    const { context, cards, refresh } = fakeContext({ planetsLoaded: true });
    const craft = spacecraftFeature.mount(context);
    craft.show?.(on, JD_2010);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    craft.pick?.('D01093');
    // At once, as the record has it; again with its pictures once they have come.
    expect(cards.at(-1)?.title).toBe('James Webb Space Telescope');
    expect(cards.at(-1)?.pictures).toBeUndefined();
    await vi.waitFor(() => {
      expect(cards.at(-1)?.pictures?.pictures).toHaveLength(8);
    });
    const shown = cards.at(-1)?.pictures;
    expect(shown?.licence).toBe('CC BY 4.0');
    expect(shown?.pictures[0]?.thumb).toBe('/pictures/webb/weic2209a-thumb.webp');
    expect(shown?.pictures[0]?.released).toBe('12 July 2022');

    const before = cards.length;
    craft.pick?.('D00273');
    expect(cards).toHaveLength(before + 1);
    expect(cards.at(-1)?.pictures).toBeUndefined();
  });

  it('Given the pictures cannot be loaded, Then the card stays as it is, the reader is told, and the next card asks again (#798)', async () => {
    const { context, cards, refresh, notify } = fakeContext({
      planetsLoaded: true,
      noPictures: true,
    });
    const craft = spacecraftFeature.mount(context);
    craft.show?.(on, JD_2010);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    craft.pick?.('D01093');
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining('Could not load the telescopes’ pictures'),
      );
    });
    expect(cards).toHaveLength(1);
    craft.pick?.('D01093');
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
