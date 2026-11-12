/**
 * What the globe is given to draw (#379): where the bodies are, the Sun's images, and Earth's
 * surfaces in deep time (elevation, temperature, shelves, ice, sea ice, plates, the sketch).
 */

import type { Matrix3 } from '../astro/matrix';
import type { Texture } from 'three';

import type { PlanetName } from '../astro/planets';

/** Where the Moon and Sun are at the current moment, from Earth's centre. */
export interface SpaceBodies {
  /** Rotation from Earth-fixed axes to J2000 equatorial axes. */
  readonly earthFixedToJ2000: Matrix3;
  /** Geocentric J2000 positions in km; the Moon is null until its ephemeris loads. */
  readonly sunKm: readonly [number, number, number];
  readonly moonKm: readonly [number, number, number] | null;
  /** Geocentric J2000 positions of the planets in km; null until their theory loads. */
  readonly planetsKm: Readonly<Record<PlanetName, readonly [number, number, number]>> | null;
  /** The moment, Julian Day (TT): how far each planet has turned. */
  readonly jdTT: number;
}

/** A small image to show at once and a sharp one to follow. */
/** SDO's view of the Sun in one channel, loaded: see `features/bodies/sunImageLayer.ts`. */
export interface SunImageTextures {
  /** The map of the whole surface. */
  readonly surface: Texture;
  /** The newest frame, for the corona; its limb is at `diskRadius` of its width. */
  readonly disc: Texture;
  /** Multiplies the images' colours. */
  readonly tint: readonly [number, number, number];
  readonly diskRadius: number;
  /** How much the Sun darkens toward the limb as the camera sees it (u in 1 − u(1 − μ)). */
  readonly limbDarkening: number;
}

/** Two elevation maps (URLs of greyscale images, see `data/paleoDem.ts`) and the blend between. */
export interface DeepTimeSurface {
  readonly younger: string;
  readonly older: string;
  /** 0 shows `younger`, 1 `older`. */
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  readonly seaDepth: number;
  readonly landHeight: number;
}

/** Surface temperature in deep time: two maps either side of the moment, blended. */
export interface TemperatureSurface {
  readonly younger: string;
  readonly older: string;
  /** 0 shows `younger`, 1 `older`. */
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  /** °C that bytes 0 and 255 stand for. */
  readonly coldest: number;
  readonly warmest: number;
  /** Colour the change from today, which Krapp's maps carry beside each moment's (#457). */
  readonly change: boolean;
}

/** On the ice-age scale: today's coasts and shelves, cut at the sea level of the moment. */
export interface ShelfSurface {
  readonly url: string;
  readonly columns: number;
  readonly rows: number;
  /** Metres that bytes 0 and 255 stand for, from today's sea level. */
  readonly lowest: number;
  readonly highest: number;
  /** The sea level to cut at, metres from today's. */
  readonly seaLevel: number;
}

/** On the ice-age scale: ice thickness, two maps either side of the moment, blended. */
export interface IceSurface {
  readonly younger: string;
  readonly older: string;
  /** 0 shows `younger`, 1 `older`. */
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  readonly metresPerStep: number;
}

/**
 * Sea ice: today's and an ice-age model's, each as the most ice in the year and the ice that
 * lasts all year, blended `mix` of the way from today's to the ice age's.
 */
export interface SeaIceSurface {
  readonly todayMost: string;
  readonly todayYearRound: string;
  readonly pastMost: string;
  readonly pastYearRound: string;
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  /** In the years, the time of year (see `SEA_ICE`); null on the ice-age scale. */
  readonly season: number | null;
}

/** A second reconstruction's continents: two masks either side of the moment, blended. */
export interface PlateSurface {
  readonly younger: string;
  readonly older: string;
  /** 0 shows `younger`, 1 `older`. */
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  /** How far each mask is turned east about the axis, degrees, to line up with the surface. */
  readonly turnYounger: number;
  readonly turnOlder: number;
}

/**
 * Before any reconstruction: what a hypothesis says the surface was like, drawn as a sketch.
 * Land, if any, has invented shapes and places; only its share of the surface is the source's.
 */
export interface SurfaceSketch {
  /** A molten surface, or an ocean with that share of the surface as land. */
  readonly kind: 'magma' | 'ocean';
  /** Share of the whole surface that is land, 0..1. */
  readonly land: number;
  /** Ice covers everything poleward of this latitude, degrees; 90 or more draws none. */
  readonly iceEdge: number;
}
