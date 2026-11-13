/**
 * What the bodies wear (#239, #258, #336, #379): Earth's and the Moon's first maps and their
 * sharper ones close up, each planet's view and its sharp map, the Moon's other views, Saturn's
 * measured rings, and the planets' moons' maps. Each map is fetched once; the latest asked for
 * wins, and one that fails leaves what the body wears.
 */

import { SRGBColorSpace, type IUniform, type Texture } from 'three';

import type { MoonName } from '../astro/moonOrbits';
import type { PlanetName } from '../astro/planets';

/** A body's view: a mission's map, and a sharper one for close up, if any. */
export interface MapView {
  readonly map: string;
  readonly sharp: string | null;
}

export interface BodyMapsWorld {
  /** Where what is worn is said, for whoever needs to know (the tests). */
  readonly dataset: DOMStringMap;
  /** The Earth's and the Moon's materials' uniforms, set in place. */
  readonly earth: Record<string, IUniform>;
  readonly moon: Record<string, IUniform>;
  readonly planets: {
    setMap(planet: PlanetName, map: Texture | null): void;
    setRings(strip: Texture): void;
  };
  readonly moons: { setMap(moon: MoonName, map: Texture | null): void };
  /** The sharpest filtering the graphics allow at a slant. */
  readonly anisotropy: number;
  /** Load an image. */
  load(url: string): Promise<Texture>;
  invalidate(): void;
}

/** The first maps, loading, and the plain colours worn until they arrive. */
export interface FirstMaps {
  readonly earth: Promise<Texture>;
  readonly moon: Promise<Texture>;
  readonly plainEarth: Texture;
  readonly plainMoon: Texture;
}

export class BodyMaps {
  readonly #world: BodyMapsWorld;
  // Each planet's view (#239), its maps by address once fetched, and those close up enough for
  // their sharper map.
  readonly #planetViews = new Map<PlanetName, MapView | null>();
  readonly #textures = new Map<string, Promise<Texture>>();
  readonly #sharpWanted = new Set<PlanetName>();
  // The Moon's usual map (the plain grey, then its first map, then the sharp one), and the
  // view it is shown as instead, if any (#239).
  #moonStandard: Texture;
  #moonView: MapView | null = null;
  readonly #bodyMapsAsked = new Set<string>();
  readonly #moonMapsWanted = new Map<MoonName, string | null>();
  // The bodies wearing their sharp map, for whoever needs to know (#258).
  readonly #sharpened = new Set<string>();
  // `rendered` waits for the Earth's map, so it still means "the globe is drawn as it looks".
  #earthMapped = false;

  constructor(world: BodyMapsWorld, first: FirstMaps) {
    this.#world = world;
    this.#moonStandard = first.plainMoon;
    // A map that fails to load leaves its plain colour: the globe still works, only plainer.
    first.earth.then(
      (map) => {
        // A sharp map that came first (a link opened close up) stays.
        if (this.#sharpened.has('earth')) {
          map.dispose();
          this.#earthMapped = true;
          return;
        }
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = world.anisotropy;
        world.earth['dayMap'] = { value: map };
        first.plainEarth.dispose();
        this.#earthMapped = true;
        world.invalidate();
      },
      (error: unknown) => {
        console.warn("Could not load the Earth's map:", error);
        this.#earthMapped = true;
        world.invalidate();
      },
    );
    first.moon.then(
      (map) => {
        if (this.#sharpened.has('moon')) {
          map.dispose();
          return;
        }
        map.colorSpace = SRGBColorSpace;
        this.#setMoonStandard(map);
      },
      (error: unknown) => {
        console.warn("Could not load the Moon's map:", error);
      },
    );
  }

  /** Whether the Earth's first map has arrived, or failed: the globe is drawn as it looks. */
  get earthMapped(): boolean {
    return this.#earthMapped;
  }

  /** Show a planet as one of its views, or null for its painted colours. */
  showPlanetView(planet: PlanetName, view: MapView | null): void {
    this.#planetViews.set(planet, view);
    this.#applyPlanetView(planet);
  }

  /** Close up: the planet's sharper map for its view, from now on (#258). */
  sharpenPlanet(planet: PlanetName): void {
    if (this.#sharpWanted.has(planet)) return;
    this.#sharpWanted.add(planet);
    this.#applyPlanetView(planet);
  }

  /** Draw Saturn's rings as measured (#336): a strip of their colour and opacity, fetched once. */
  setSaturnRings(url: string): void {
    if (this.#bodyMapsAsked.has(url)) return;
    this.#bodyMapsAsked.add(url);
    this.#texture(url).then(
      (strip) => {
        this.#world.planets.setRings(strip);
        this.#world.dataset['rings'] = 'measured';
        this.#world.invalidate();
      },
      () => undefined,
    );
  }

  /** Show the Moon as another view than its usual map, or null for its usual map. */
  showMoonView(view: MapView | null): void {
    const { moon, dataset } = this.#world;
    this.#moonView = view;
    if (view === null) {
      moon['map'] = { value: this.#moonStandard };
      // Which the Moon wears, for whoever needs to know a view took.
      dataset['moonMap'] = 'usual';
      this.#world.invalidate();
      return;
    }
    const url = this.#sharpened.has('moon') && view.sharp !== null ? view.sharp : view.map;
    this.#texture(url).then(
      (map) => {
        if (this.#moonView !== view) return;
        moon['map'] = { value: map };
        dataset['moonMap'] = 'view';
        this.#world.invalidate();
      },
      () => undefined,
    );
  }

  /** Dress Earth or the Moon in a sharper map, fetched once, for close up (#258). */
  setBodyMap(body: 'earth' | 'moon', url: string): void {
    if (this.#bodyMapsAsked.has(url)) return;
    this.#bodyMapsAsked.add(url);
    this.#world
      .load(url)
      .then((map) => {
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = this.#world.anisotropy;
        if (body === 'moon') {
          this.#setMoonStandard(map);
          this.#markSharp(body);
          // A view shown instead takes its own sharper map too.
          if (this.#moonView !== null) this.showMoonView(this.#moonView);
          return;
        }
        const uniforms = this.#world.earth;
        const previous = uniforms['dayMap']?.value as Texture | undefined;
        uniforms['dayMap'] = { value: map };
        previous?.dispose();
        this.#markSharp(body);
        this.#world.invalidate();
      })
      .catch(() => {
        this.#bodyMapsAsked.delete(url);
      });
  }

  /** Wrap a moon in a mission's map, fetched once: the latest asked for each moon wins. */
  setMoonMap(moon: MoonName, url: string | null): void {
    const { moons, dataset } = this.#world;
    if (this.#moonMapsWanted.get(moon) === url) return;
    this.#moonMapsWanted.set(moon, url);
    if (url === null) {
      // Its painted colour: as Titan looks, all haze.
      moons.setMap(moon, null);
      dataset['moonMap'] = `${moon} painted`;
      this.#world.invalidate();
      return;
    }
    this.#texture(url).then(
      (map) => {
        // Only if the moon still wants this map: a sharper one may have been asked since.
        if (this.#moonMapsWanted.get(moon) !== url) return;
        moons.setMap(moon, map);
        dataset['moonMap'] = moon;
        this.#world.invalidate();
      },
      () => undefined,
    );
  }

  #texture(url: string): Promise<Texture> {
    let texture = this.#textures.get(url);
    if (texture === undefined) {
      texture = this.#world.load(url).then((map) => {
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = this.#world.anisotropy;
        return map;
      });
      // Asked again the next time, if it failed; what the planet wears stays meanwhile.
      texture.catch(() => this.#textures.delete(url));
      this.#textures.set(url, texture);
    }
    return texture;
  }

  #setMoonStandard(map: Texture): void {
    this.#moonStandard.dispose();
    this.#moonStandard = map;
    if (this.#moonView === null) this.#world.moon['map'] = { value: map };
    this.#world.invalidate();
  }

  /** Dress a planet as its view asks: the sharp map close up, else the first, else its colours. */
  #applyPlanetView(planet: PlanetName): void {
    const view = this.#planetViews.get(planet) ?? null;
    if (view === null) {
      this.#world.planets.setMap(planet, null);
      this.#world.invalidate();
      return;
    }
    const sharpUrl = this.#sharpWanted.has(planet) ? view.sharp : null;
    const sharp = sharpUrl !== null;
    this.#texture(sharpUrl ?? view.map).then(
      (map) => {
        // Only if the planet still wants this view.
        if (this.#planetViews.get(planet) !== view) return;
        this.#world.planets.setMap(planet, map);
        this.#world.dataset['planetMap'] = planet;
        if (sharp) this.#markSharp(planet);
        this.#world.invalidate();
      },
      () => undefined,
    );
  }

  #markSharp(body: string): void {
    this.#sharpened.add(body);
    this.#world.dataset['sharp'] = [...this.#sharpened].sort().join(' ');
  }
}
