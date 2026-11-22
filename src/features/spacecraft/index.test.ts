import { describe, expect, it, vi } from 'vitest';

import paths from '../../../public/data/spacecraft-paths.json';
import record from '../../../public/data/spacecraft.json';
import telescopePictures from '../../../public/data/telescope-pictures.json';
import telescopes from '../../../public/data/telescopes.json';
import type { MoonEphemeris } from '../../astro/moon';
import { PLANETS, type PlanetEphemeris } from '../../astro/planets';
import type { JulianDay } from '../../time/julianDay';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { Capability, FeatureContext } from '../feature';
import { spacecraftFeature } from '.';
import { craftModel } from './craftModelLayer';
import { circling } from './earthOrbit';
import { landingSites } from './landingSites';
import { missionRoutes } from './routeLines';
import { sunHold } from './turningFrame';

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
  const models: unknown[] = [];
  const held: unknown[] = [];
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
        : url.endsWith('telescopes.json')
          ? telescopes
          : url.endsWith('spacecraft-paths.json')
            ? paths
            : record;
      return Promise.resolve(new Response(JSON.stringify(body)));
    },
    globe: {
      addLayer: (factory: unknown) => ({
        update: (input: unknown) =>
          (factory === missionRoutes
            ? routes
            : factory === landingSites
              ? sites
              : factory === craftModel
                ? models
                : factory === sunHold
                  ? held
                  : drawn
          ).push(input),
      }),
    },
    zoomRail: {
      setSpacecraft: (offered: boolean, shown: boolean) => rail.push([offered, shown]),
    },
    notify,
    cards: {
      show: (card: MarkerCardContent) => cards.push(card),
      open: () => cards.length > 0,
    },
    anchors: { open: openAnchor },
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
  } as unknown as FeatureContext<Capability>;
  return {
    context,
    drawn,
    routes,
    sites,
    models,
    held,
    cards,
    rail,
    refresh,
    notify,
    loadPlanets,
    openAnchor,
  };
}

describe('the spacecraft as a feature', () => {
  it('is shown again when the layers change, and not for other changes', () => {
    expect(spacecraftFeature.watches(on)).toEqual([on.layers, null, null, false, true]);
    expect(spacecraftFeature.watches({ ...on, mode: 'sky' })).toEqual([
      on.layers,
      null,
      null,
      false,
      true,
    ]);
    expect(spacecraftFeature.watches({ ...on, mission: 'd00273' })).toEqual([
      on.layers,
      'd00273',
      null,
      false,
      true,
    ]);
    // A craft gone to (#796): far from it, its point; close, its model.
    const webb = { kind: 'craft', id: 'd01093' } as const;
    const far = { ...on, on: webb, camera: { ...on.camera, distance: 1200 } };
    expect(spacecraftFeature.watches(far)).toEqual([on.layers, null, webb, false, true]);
    expect(spacecraftFeature.watches({ ...far, camera: { ...on.camera, distance: 4 } })).toEqual([
      on.layers,
      null,
      webb,
      true,
      true,
    ]);
    // Earth near or far, or another body in view: Hubble comes and goes (#795).
    const away = { ...on, camera: { ...on.camera, distance: 60 } };
    expect(spacecraftFeature.watches(away)).toEqual([on.layers, null, null, false, false]);
    expect(spacecraftFeature.watches({ ...on, focus: 'moon' })).toEqual([
      on.layers,
      null,
      null,
      false,
      false,
    ]);
  });

  it('Given only the Telescopes layer, Then only the space telescopes fly, about Earth and beyond it (#849)', async () => {
    const { context, drawn, routes, sites, refresh } = fakeContext({ planetsLoaded: true });
    const telescopesOnly: ViewState = { ...off, layers: withLayer(off.layers, 'telescopes', true) };
    const craft = spacecraftFeature.mount(context, context);
    craft.show?.(telescopesOnly, JD_2010);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    craft.show?.(telescopesOnly, JD_2010);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    craft.show?.(telescopesOnly, JD_2010);
    const ids = (drawn.at(-1) as readonly { id: string }[]).map(({ id }) => id);
    const telescopeIds = new Set(
      telescopes.telescopes.flatMap((t) => ('craft' in t ? [t.craft.toUpperCase()] : [])),
    );
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) expect(telescopeIds).toContain(id);
    // Hubble and Chandra about Earth; in 2010 Swift and Fermi too.
    expect(ids).toEqual(expect.arrayContaining(['S20580', 'S25867', 'S28485', 'S33053']));
    expect(routes.at(-1)).toBeNull();
    expect(sites.at(-1)).toBeNull();
  });

  it('Given Earth from far off, Then Chandra, far out, is still drawn while Hubble sits on Earth (#849)', async () => {
    const { context, drawn, refresh } = fakeContext({ planetsLoaded: true });
    const far: ViewState = { ...on, camera: { ...on.camera, distance: 120 } };
    const craft = spacecraftFeature.mount(context, context);
    craft.show?.(far, JD_2010);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    craft.show?.(far, JD_2010);
    const ids = (drawn.at(-1) as readonly { id: string }[]).map(({ id }) => id);
    expect(ids).not.toContain('S20580');
    const chandra = record.aboutEarth.find((each) => each.id === 'S25867');
    const out = Math.hypot(
      ...circling(chandra?.orbit ?? { perigeeKm: 0, apogeeKm: 0, inclinationDeg: 0 }, JD_2010),
    );
    // Drawn while the camera is within twelve times its distance from Earth's centre.
    if (out / 6378.137 >= 10) expect(ids).toContain('S25867');
    else expect(ids).not.toContain('S25867');
  });

  it('Given neither layer on, Then nothing flies', () => {
    const { context, drawn } = fakeContext({ planetsLoaded: true });
    spacecraftFeature.mount(context, context).show?.(off, JD_2010);
    expect(drawn.at(-1)).toBeNull();
  });

  it('Given Earth close up after 1990, Then Hubble is drawn about it, with its card; from further off, or before it flew, it is not (#795)', async () => {
    const { context, drawn, cards, refresh } = fakeContext({ planetsLoaded: true });
    const craft = spacecraftFeature.mount(context, context);
    craft.show?.(on, JD_2010);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    const ids = () => (drawn.at(-1) as readonly { id: string }[]).map(({ id }) => id);

    craft.show?.(on, JD_2010);
    expect(ids()).toContain('S20580');
    const hubble = (drawn.at(-1) as readonly { id: string; km: readonly number[] }[]).find(
      ({ id }) => id === 'S20580',
    );
    // Between its lowest (611 km) and highest (620 km) (#849).
    expect(Math.abs(Math.hypot(...(hubble?.km ?? [])) - (6378.137 + 615.5))).toBeLessThan(4.6);

    craft.show?.({ ...on, camera: { ...on.camera, distance: 60 } }, JD_2010);
    expect(ids()).not.toContain('S20580');
    expect(ids().length).toBeGreaterThan(5);
    craft.show?.({ ...on, focus: 'sun' }, JD_2010);
    expect(ids()).not.toContain('S20580');
    // 1985: five years before it flew.
    craft.show?.(on, JD_2010 - 25 * 365.25);
    expect(ids()).not.toContain('S20580');

    craft.pick?.('S20580');
    expect(cards.at(-1)?.title).toBe('Hubble Space Telescope');
  });

  it('draws nothing while its layer is off, and offers its icon in the globe view', () => {
    const { context, drawn, rail } = fakeContext({ planetsLoaded: true });
    spacecraftFeature.mount(context, context).show?.(off, JD_2010);
    expect(drawn).toEqual([null]);
    expect(rail).toEqual([[true, false]]);
  });

  it('in deep time they are neither offered nor drawn', () => {
    const { context, drawn, rail } = fakeContext({ planetsLoaded: true });
    spacecraftFeature.mount(context, context).show?.({ ...on, ma: 100 }, JD_2010);
    expect(drawn).toEqual([null]);
    expect(rail).toEqual([[false, true]]);
  });

  it('loads the record and paths once, then draws the craft in flight and opens a card on a tap', async () => {
    const { context, drawn, cards, refresh, loadPlanets } = fakeContext({ planetsLoaded: false });
    const craft = spacecraftFeature.mount(context, context);
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

  it('says so when the record cannot be loaded, waits on its chip as time plays, and tries again from there (#762)', async () => {
    const { context, notify } = fakeContext({ planetsLoaded: true, failing: true });
    const craft = spacecraftFeature.mount(context, context);
    craft.show?.(on, JD_2010);
    expect(craft.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the spacecraft: offline');
    });
    craft.show?.(on, JD_2010 + 1);
    craft.show?.(on, JD_2010 + 2);
    expect(notify).toHaveBeenCalledOnce();
    const failed = craft.load?.();
    if (failed?.state !== 'failed') throw new Error('expected a failed load');
    failed.retry();
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });

  it('Given Webb followed, Then the camera is held to the Sun, and let go with every craft again (#998)', async () => {
    const { context, held, refresh } = fakeContext({ planetsLoaded: true });
    const craft = spacecraftFeature.mount(context, context);
    const webb: ViewState = { ...on, mission: 'd01093' };
    const july2022 = 2_459_790.5;
    craft.show?.(webb, july2022);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    craft.show?.(webb, july2022);
    expect(held.at(-1)).toBe(true);
    craft.show?.(on, july2022);
    expect(held.at(-1)).toBe(false);
    craft.show?.(off, july2022);
    expect(held.at(-1)).toBe(false);
  });

  it('Given a mission named, Then only its craft are drawn, each with its whole route (#712)', async () => {
    const { context, drawn, routes, held, refresh, cards, openAnchor } = fakeContext({
      planetsLoaded: true,
    });
    const craft = spacecraftFeature.mount(context, context);
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
    // To the Moon, not an L point: the camera keeps still among the stars (#998).
    expect(held.at(-1)).toBe(false);
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
    const craft = spacecraftFeature.mount(context, context);
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
    const craft = spacecraftFeature.mount(context, context);
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

    // Hubble's card has its own, already loaded.
    craft.pick?.('S20580');
    expect(cards.at(-1)?.pictures?.source).toBe('ESA/Hubble');
    expect(cards.at(-1)?.pictures?.pictures[1]?.title).toBe('The Pillars of Creation');
  });

  it('Given the pictures cannot be loaded, Then the card stays as it is, the reader is told, and the next card asks again (#798)', async () => {
    const { context, cards, refresh, notify } = fakeContext({
      planetsLoaded: true,
      noPictures: true,
    });
    const craft = spacecraftFeature.mount(context, context);
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

  it('Given Webb’s card, When “Go to it” is pressed, Then the camera goes to it, drawn as its model, not its point (#796)', async () => {
    const { context, cards, refresh, drawn, models } = fakeContext({ planetsLoaded: true });
    const changes: ((state: ViewState) => ViewState)[] = [];
    const going = {
      ...context,
      change: (update: (state: ViewState) => ViewState) => changes.push(update),
    };
    const craft = spacecraftFeature.mount(going, going);
    // A year after it reached L2.
    const jd2023 = 2459945.5;
    craft.show?.(on, jd2023);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    craft.show?.(on, jd2023);
    expect(models.at(-1)).toBeNull();
    craft.pick?.('D01093');
    const go = cards.at(-1)?.action;
    expect(go?.label).toBe('Go to it');
    // Which way it is drawn pointing is said to be a convention.
    expect(cards.at(-1)?.facts.at(-1)?.[1]).toContain('a convention');
    go?.run();
    const there = changes.at(-1)?.({ ...on, focus: 'moon', view: 'earth-from-here' });
    expect(there).toMatchObject({
      on: { kind: 'craft', id: 'd01093' },
      focus: 'earth',
      view: 'free',
    });

    craft.show?.({ ...on, on: { kind: 'craft' as const, id: 'd01093' } }, jd2023);
    const held = models.at(-1) as { id: string; km: readonly number[]; model: { radius: number } };
    expect(held.id).toBe('D01093');
    // About 1.5 million km out, beyond Earth from the Sun.
    expect(Math.hypot(...held.km)).toBeGreaterThan(1.2e6);
    expect(held.model.radius).toBeCloseTo(10.6, 1);
    const ids = (drawn.at(-1) as readonly { id: string }[]).map(({ id }) => id);
    expect(ids).not.toContain('D01093');
    expect(ids.length).toBeGreaterThan(5);

    // Its card then offers the way back.
    craft.pick?.('D01093');
    expect(cards.at(-1)?.action?.label).toBe('Leave it');
    cards.at(-1)?.action?.run();
    expect(changes.at(-1)?.({ ...on, on: { kind: 'craft' as const, id: 'd01093' } }).on).toBeNull();

    // Hubble too: going to it, the camera is about Earth, its orbit drawn however far out.
    craft.pick?.('S20580');
    expect(cards.at(-1)?.action?.label).toBe('Go to it');
    expect(cards.at(-1)?.facts.at(-1)?.[1]).toContain('solar arrays square to the Sun');
    cards.at(-1)?.action?.run();
    expect(changes.at(-1)?.(on)).toMatchObject({
      on: { kind: 'craft', id: 's20580' },
      focus: 'earth',
    });
    const onHubble = {
      ...on,
      on: { kind: 'craft', id: 's20580' } as const,
      camera: { ...on.camera, distance: 100 },
    };
    expect(spacecraftFeature.watches(onHubble).at(-1)).toBe(true);
    craft.show?.(onHubble, jd2023);
    const hubble = models.at(-1) as {
      id: string;
      km: readonly number[];
      model: { radius: number };
    };
    expect(hubble.id).toBe('S20580');
    expect(Math.abs(Math.hypot(...hubble.km) - (6378.137 + 615.5))).toBeLessThan(4.6);
    expect(hubble.model.radius).toBe(6.6);

    // A craft without a model has no way to it, and naming it draws no model.
    craft.pick?.('D00273');
    expect(cards.at(-1)?.action).toBeUndefined();
    craft.show?.({ ...on, on: { kind: 'craft' as const, id: 'd00273' } }, jd2023);
    expect(models.at(-1)).toBeNull();
  });
});
