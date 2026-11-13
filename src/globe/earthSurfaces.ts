/**
 * Earth's surfaces beyond today's imagery (#379): deep time's elevation maps, temperature, the
 * shelves at a past sea level, ice sheets, sea ice, a second reconstruction's plates, and the
 * plain globe with its sketch. Each is a few of the Earth shader's uniforms, set from maps
 * loaded once each.
 */

import {
  DataTexture,
  LinearFilter,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
  Vector2,
  type IUniform,
  type Texture,
} from 'three';

import { LAND_NOISE_GRID, landNoise, levelForShare, shareAtOrAbove } from '../deepTime/landScheme';
import type {
  DeepTimeSurface,
  IceSurface,
  PlateSurface,
  SeaIceSurface,
  ShelfSurface,
  SurfaceSketch,
  TemperatureSurface,
} from './surfaces';

/** The Earth shader's uniforms for these surfaces, each off until set. */
export function surfaceUniforms(): Record<string, IUniform> {
  return {
    paleoYounger: { value: null as Texture | null },
    paleoOlder: { value: null as Texture | null },
    paleoMix: { value: 0 },
    paleoActive: { value: 0 },
    shelfMap: { value: null as Texture | null },
    shelfActive: { value: 0 },
    shelfGrid: { value: new Vector2(3601, 1801) },
    shelfRange: { value: new Vector2(-200, 55) },
    seaLevel: { value: 0 },
    seaIceTodayMost: { value: null as Texture | null },
    seaIceTodayYearRound: { value: null as Texture | null },
    seaIcePastMost: { value: null as Texture | null },
    seaIcePastYearRound: { value: null as Texture | null },
    seaIceMix: { value: 0 },
    seaIceActive: { value: 0 },
    seaIceSeason: { value: -1 },
    seaIceGrid: { value: new Vector2(361, 181) },
    iceYounger: { value: null as Texture | null },
    iceOlder: { value: null as Texture | null },
    iceMix: { value: 0 },
    iceActive: { value: 0 },
    iceGrid: { value: new Vector2(1441, 721) },
    iceStep: { value: 16 },
    plateYounger: { value: null as Texture | null },
    plateOlder: { value: null as Texture | null },
    plateMix: { value: 0 },
    plateActive: { value: 0 },
    plateGrid: { value: new Vector2(1441, 721) },
    plateTurn: { value: new Vector2(0, 0) },
    uncharted: { value: 0 },
    sketchKind: { value: 0 },
    sketchLevel: { value: 2 },
    sketchIceEdge: { value: 90 },
    paleoGrid: { value: new Vector2(361, 181) },
    seaDepth: { value: 11_000 },
    landHeight: { value: 6_500 },
  };
}

/**
 * Maps loaded in the order they were asked for: a newer one is shown as soon as it arrives,
 * even if a later one is still loading (as time plays, the latest is often not there yet);
 * an older one arriving late is not. Turning a layer off drops what is still loading.
 */
export function inOrder(): { ask(): number; show(ticket: number): boolean; drop(): void } {
  let asked = 0;
  let shown = 0;
  return {
    ask: () => ++asked,
    show(ticket) {
      if (ticket <= shown) return false;
      shown = ticket;
      return true;
    },
    drop() {
      shown = ++asked;
    },
  };
}

/** The sketch's noise field as a texture, made once, wrapping east–west. */
function sketchTexture(): { readonly texture: DataTexture; readonly shares: Float64Array } {
  const { columns, rows } = LAND_NOISE_GRID;
  const field = landNoise(columns, rows);
  const texture = new DataTexture(field, columns, rows, RedFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return { texture, shares: shareAtOrAbove(field, columns, rows) };
}

export interface SurfaceHost {
  /** The Earth material's uniforms, set in place. */
  readonly uniforms: Record<string, IUniform>;
  /** Shared with the atmosphere: 1 lights the globe evenly, without night. */
  readonly evenLight: { value: number };
  /** Where what is shown is said, for whoever needs to know (the tests). */
  readonly dataset: DOMStringMap;
  /** Load a map that holds data, not colour. */
  load(url: string): Promise<Texture>;
  invalidate(): void;
}

type Order = 'deepTime' | 'temperature' | 'ice' | 'seaIce' | 'plates';

export class EarthSurfaces {
  readonly #host: SurfaceHost;
  // Deep time's maps, loaded once each. They hold data, not colour.
  readonly #textures = new Map<string, Promise<Texture>>();
  readonly #orders: Readonly<Record<Order, ReturnType<typeof inOrder>>> = {
    deepTime: inOrder(),
    temperature: inOrder(),
    ice: inOrder(),
    seaIce: inOrder(),
    plates: inOrder(),
  };
  #deepTime = false;
  // Lit evenly outside deep time too, while the Holocene's track is open.
  #evenLit = false;
  #sketchField: ReturnType<typeof sketchTexture> | null = null;

  constructor(host: SurfaceHost) {
    this.#host = host;
  }

  /** True while deep time's elevation maps are shown instead of today's Earth. */
  get deepTime(): boolean {
    return this.#deepTime;
  }

  /** Light the whole globe evenly, without night, as deep time does; for the Holocene's track. */
  setEvenLight(on: boolean): void {
    this.#evenLit = on;
    this.#showLight();
  }

  /** Start loading maps that will be wanted soon (as time plays), so they are there in time. */
  prefetch(urls: readonly string[]): void {
    for (const url of urls) {
      this.#texture(url).catch(() => {
        // Tried again when it is wanted.
        this.#textures.delete(url);
      });
    }
  }

  /** Draw Earth's surface from two elevation maps blended by `mix`; null returns to today's. */
  setDeepTime(surface: DeepTimeSurface | null): void {
    this.#deepTime = surface !== null;
    this.#showLight();
    if (surface === null) {
      this.#off('deepTime', 'paleoActive', 'deepTime');
      return;
    }
    this.#showMaps('deepTime', [surface.younger, surface.older], ([younger, older]) => {
      this.#set({
        paleoYounger: younger,
        paleoOlder: older,
        paleoMix: surface.mix,
        paleoGrid: new Vector2(surface.columns, surface.rows),
        seaDepth: surface.seaDepth,
        landHeight: surface.landHeight,
        paleoActive: 1,
      });
      this.#host.dataset['deepTime'] = `${surface.younger} ${surface.older}`;
    });
  }

  /** Colour the deep-time surface by temperature; null shows relief alone. */
  setTemperature(surface: TemperatureSurface | null): void {
    if (surface === null) {
      this.#off('temperature', 'tempActive', 'temperature');
      return;
    }
    this.#showMaps('temperature', [surface.younger, surface.older], ([younger, older]) => {
      this.#set({
        tempYounger: younger,
        tempOlder: older,
        tempMix: surface.mix,
        tempGrid: new Vector2(surface.columns, surface.rows),
        tempRange: new Vector2(surface.coldest, surface.warmest),
        tempChange: surface.change ? 1 : 0,
        tempActive: 1,
      });
      this.#host.dataset['temperature'] = `${surface.younger} ${surface.older}`;
      this.#host.dataset['temperatureChange'] = String(surface.change);
    });
  }

  /** Draw coastlines at a past sea level from today's shelves; null uses the elevation maps'. */
  setShelf(surface: ShelfSurface | null): void {
    const { uniforms, dataset } = this.#host;
    if (surface === null) {
      uniforms['shelfActive'] = { value: 0 };
      dataset['shelf'] = 'off';
      this.#host.invalidate();
      return;
    }
    uniforms['seaLevel'] = { value: surface.seaLevel };
    dataset['seaLevel'] = surface.seaLevel.toFixed(1);
    this.#texture(surface.url).then(
      (map) => {
        this.#set({
          shelfMap: map,
          shelfGrid: new Vector2(surface.columns, surface.rows),
          shelfRange: new Vector2(surface.lowest, surface.highest),
          shelfActive: 1,
        });
        dataset['shelf'] = surface.url;
        this.#host.invalidate();
      },
      () => {
        this.#textures.delete(surface.url);
      },
    );
    this.#host.invalidate();
  }

  /** Draw ice sheets over the surface; null draws none. */
  setIce(surface: IceSurface | null): void {
    if (surface === null) {
      this.#off('ice', 'iceActive', 'ice');
      return;
    }
    this.#showMaps('ice', [surface.younger, surface.older], ([younger, older]) => {
      this.#set({
        iceYounger: younger,
        iceOlder: older,
        iceMix: surface.mix,
        iceGrid: new Vector2(surface.columns, surface.rows),
        iceStep: surface.metresPerStep,
        iceActive: 1,
      });
      this.#host.dataset['ice'] = `${surface.younger} ${surface.older}`;
    });
  }

  /** Draw sea ice over the oceans; null draws none. */
  setSeaIce(surface: SeaIceSurface | null): void {
    if (surface === null) {
      this.#off('seaIce', 'seaIceActive', 'seaIce');
      return;
    }
    const { todayMost, todayYearRound, pastMost, pastYearRound } = surface;
    const urls = [todayMost, todayYearRound, pastMost, pastYearRound];
    this.#showMaps('seaIce', urls, ([todayMostMap, todayYearMap, pastMostMap, pastYearMap]) => {
      this.#set({
        seaIceTodayMost: todayMostMap,
        seaIceTodayYearRound: todayYearMap,
        seaIcePastMost: pastMostMap,
        seaIcePastYearRound: pastYearMap,
        seaIceMix: surface.mix,
        seaIceSeason: surface.season ?? -1,
        seaIceGrid: new Vector2(surface.columns, surface.rows),
        seaIceActive: 1,
      });
      const season = surface.season === null ? 'ice-age' : surface.season.toFixed(2);
      this.#host.dataset['seaIce'] = `${season} ${pastMost} ${surface.mix.toFixed(2)}`;
    });
  }

  /** Outline a second reconstruction's continents; null draws none. */
  setPlates(surface: PlateSurface | null): void {
    if (surface === null) {
      this.#off('plates', 'plateActive', 'plates');
      return;
    }
    this.#showMaps('plates', [surface.younger, surface.older], ([younger, older]) => {
      this.#set({
        plateYounger: younger,
        plateOlder: older,
        plateMix: surface.mix,
        plateGrid: new Vector2(surface.columns, surface.rows),
        plateTurn: new Vector2(surface.turnYounger, surface.turnOlder),
        plateActive: 1,
      });
      this.#host.dataset['plates'] = `${surface.younger} ${surface.older}`;
    });
  }

  /** Before the elevation maps reach: a plain globe with a faint grid, not a made-up map. */
  setUncharted(blank: boolean): void {
    this.#host.uniforms['uncharted'] = { value: blank ? 1 : 0 };
    this.#host.dataset['uncharted'] = String(blank);
    this.#host.invalidate();
  }

  /** On the plain globe, sketch a hypothesis of the surface; null leaves it plain. */
  setSketch(sketch: SurfaceSketch | null): void {
    this.#host.dataset['sketch'] =
      sketch === null
        ? 'off'
        : `${sketch.kind} ${sketch.land.toFixed(3)} ${String(sketch.iceEdge)}`;
    this.#host.invalidate();
    if (sketch === null) {
      this.#host.uniforms['sketchKind'] = { value: 0 };
      return;
    }
    this.#sketchField ??= sketchTexture();
    this.#set({
      overlayMap: this.#sketchField.texture,
      sketchKind: sketch.kind === 'magma' ? 1 : 2,
      sketchLevel: levelForShare(this.#sketchField.shares, sketch.land),
      sketchIceEdge: sketch.iceEdge,
    });
  }

  #texture(url: string): Promise<Texture> {
    let pending = this.#textures.get(url);
    if (pending === undefined) {
      pending = this.#host.load(url);
      this.#textures.set(url, pending);
    }
    return pending;
  }

  #showLight(): void {
    const even = this.#deepTime || this.#evenLit;
    this.#host.evenLight.value = even ? 1 : 0;
    this.#host.dataset['light'] = even ? 'even' : 'sun';
    this.#host.invalidate();
  }

  #set(values: Readonly<Record<string, unknown>>): void {
    for (const [name, value] of Object.entries(values)) this.#host.uniforms[name] = { value };
  }

  /** Take a surface away: what is still loading for it is dropped. */
  #off(order: Order, active: string, key: string): void {
    this.#orders[order].drop();
    this.#host.uniforms[active] = { value: 0 };
    this.#host.dataset[key] = 'off';
    this.#host.invalidate();
  }

  /**
   * Show the maps at `urls` once all have loaded, if nothing newer has been shown meanwhile;
   * if one fails, the last shown stays and the next ask tries again.
   */
  #showMaps(order: Order, urls: readonly string[], show: (maps: Texture[]) => void): void {
    const ticket = this.#orders[order].ask();
    Promise.all(urls.map((url) => this.#texture(url))).then(
      (maps) => {
        if (!this.#orders[order].show(ticket)) return;
        show(maps);
        this.#host.invalidate();
      },
      () => {
        for (const url of urls) this.#textures.delete(url);
      },
    );
  }
}
