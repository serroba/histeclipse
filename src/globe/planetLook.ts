/**
 * What the naked-eye planets look like in the space view: true sizes and shapes, the
 * directions of their poles, and approximate colours.
 *
 * Sizes and poles are from the IAU Working Group on Cartographic Coordinates and Rotational
 * Elements (Archinal et al. 2018, the 2015 report), at J2000; the poles drift by well under a
 * degree over the site's span, which a view this small cannot show. Saturn's ring radii are from
 * NASA's Saturnian Rings Fact Sheet. Colours are rough true-colour impressions, with Jupiter's and
 * Saturn's main belts placed at their usual latitudes: they are not maps of the surfaces. Close
 * up, Mercury, Mars, Jupiter and Saturn wear their missions' global maps instead (`PLANET_PICTURES`),
 * turned as the planet was at the moment shown (`bodyAxes`).
 */

import type { PlanetName } from '../astro/planets';
import { elementAt } from '../util/arrays';
import { EARTH_RADIUS_KM } from './spaceFrame';

export interface PlanetShape {
  /** Equatorial and polar radii, km. */
  readonly equatorialKm: number;
  readonly polarKm: number;
  /** North pole, J2000 right ascension and declination, degrees. */
  readonly poleRa: number;
  readonly poleDec: number;
}

export const PLANET_SHAPES: Readonly<Record<PlanetName, PlanetShape>> = {
  mercury: { equatorialKm: 2440.53, polarKm: 2438.26, poleRa: 281.0103, poleDec: 61.4155 },
  venus: { equatorialKm: 6051.8, polarKm: 6051.8, poleRa: 272.76, poleDec: 67.16 },
  // The report's Mars terms include a 700-century wobble (0.42° in RA, 1.59° in Dec): evaluated
  // at J2000, as it changes by under 0.01° a century; the report's 2009 values agree.
  mars: { equatorialKm: 3396.19, polarKm: 3376.2, poleRa: 317.681106, poleDec: 52.886346 },
  jupiter: { equatorialKm: 71_492, polarKm: 66_854, poleRa: 268.056595, poleDec: 64.495303 },
  saturn: { equatorialKm: 60_268, polarKm: 54_364, poleRa: 40.589, poleDec: 83.537 },
};

export const PLANET_NAMES: Readonly<Record<PlanetName, string>> = {
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
};

/** Equatorial radius in Earth radii, the unit of the scene. */
export function planetRadius(planet: PlanetName): number {
  return PLANET_SHAPES[planet].equatorialKm / EARTH_RADIUS_KM;
}

/** Polar over equatorial radius: how much the planet is squashed at the poles. */
export function polarRatio(planet: PlanetName): number {
  const { equatorialKm, polarKm } = PLANET_SHAPES[planet];
  return polarKm / equatorialKm;
}

/** The north pole as a unit vector in J2000 equatorial axes. */
export function poleVector(planet: PlanetName): [number, number, number] {
  const { poleRa, poleDec } = PLANET_SHAPES[planet];
  const ra = (poleRa * Math.PI) / 180;
  const dec = (poleDec * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/**
 * How each planet turns: its prime meridian's angle W at J2000 and its rate, degrees and degrees
 * a day, from the same IAU report as the poles (Archinal et al. 2018). Jupiter's and Saturn's are
 * System III, the turning of their interiors: their clouds drift against it. Mercury's and
 * Mars's small periodic terms (well under a tenth of a degree) are left out.
 */
export const ROTATION: Readonly<
  Record<PlanetName, { readonly w0: number; readonly rate: number }>
> = {
  mercury: { w0: 329.5988, rate: 6.1385108 },
  venus: { w0: 160.2, rate: -1.4813688 },
  // With the same long-period term (0.58°) evaluated at J2000, as for the pole.
  mars: { w0: 176.631819, rate: 350.891982443297 },
  jupiter: { w0: 284.95, rate: 870.536 },
  saturn: { w0: 38.9, rate: 810.7939024 },
};

/** Days light takes per km. */
const LIGHT_DAYS_PER_KM = 1 / 299_792.458 / 86_400;

/**
 * The prime meridian's angle W, degrees [0, 360), at Julian Day `jdTT`, seen from `distanceKm`
 * away: the planet as it was when the light left it, which for Jupiter is half an hour and
 * some 20° of turning earlier.
 */
export function primeMeridian(planet: PlanetName, jdTT: number, distanceKm = 0): number {
  const { w0, rate } = ROTATION[planet];
  const days = jdTT - 2_451_545 - distanceKm * LIGHT_DAYS_PER_KM;
  return (((w0 + rate * days) % 360) + 360) % 360;
}

type Unit = readonly [number, number, number];

function cross([ax, ay, az]: Unit, [bx, by, bz]: Unit): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function normal(v: Unit): [number, number, number] {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * The planet's body-fixed axes in J2000 equatorial coordinates: its north pole, the direction of
 * its prime meridian on its equator (W east of the equator's ascending node on the J2000
 * equator), and 90° east of it.
 */
export function bodyAxes(
  planet: PlanetName,
  jdTT: number,
  distanceKm = 0,
): { readonly pole: Unit; readonly prime: Unit; readonly east: Unit } {
  const pole = poleVector(planet);
  const node = normal(cross([0, 0, 1], pole));
  const toward = cross(pole, node);
  const w = (primeMeridian(planet, jdTT, distanceKm) * Math.PI) / 180;
  const prime: Unit = [
    Math.cos(w) * node[0] + Math.sin(w) * toward[0],
    Math.cos(w) * node[1] + Math.sin(w) * toward[1],
    Math.cos(w) * node[2] + Math.sin(w) * toward[2],
  ];
  return { pole, prime, east: cross(pole, prime) };
}

/** A band of colour between two latitudes (degrees, south to north). */
export interface Band {
  readonly south: number;
  readonly north: number;
  readonly colour: string;
}

export interface PlanetColours {
  readonly base: string;
  readonly bands: readonly Band[];
}

export const PLANET_COLOURS: Readonly<Record<PlanetName, PlanetColours>> = {
  mercury: { base: '#8c8680', bands: [] },
  venus: { base: '#e6d8b8', bands: [] },
  mars: {
    base: '#b5603a',
    bands: [
      { south: -90, north: -78, colour: '#e8e4dc' },
      { south: 80, north: 90, colour: '#efece6' },
    ],
  },
  jupiter: {
    base: '#e3d6bd',
    bands: [
      { south: -90, north: -45, colour: '#a89a86' },
      { south: -32, north: -26, colour: '#b9a184' },
      { south: -20, north: -7, colour: '#a7825d' },
      { south: 7, north: 17, colour: '#9f7a57' },
      { south: 24, north: 31, colour: '#b7a083' },
      { south: 45, north: 90, colour: '#a89a86' },
    ],
  },
  saturn: {
    base: '#e2cf9e',
    bands: [
      { south: -90, north: -60, colour: '#b9ab86' },
      { south: -30, north: -18, colour: '#cdb47c' },
      { south: 18, north: 30, colour: '#cdb47c' },
      { south: 60, north: 90, colour: '#a9a185' },
    ],
  },
};

/** The colour at a latitude: the last band covering it, or the base. */
export function colourAt(planet: PlanetName, latitude: number): string {
  const { base, bands } = PLANET_COLOURS[planet];
  return (
    bands.findLast(({ south, north }) => latitude >= south && latitude <= north)?.colour ?? base
  );
}

/** Saturn's rings, km from the planet's centre: inner edge of the C ring to outer edge of the A. */
export const SATURN_RINGS_KM = { inner: 74_658, outer: 136_775 } as const;

/**
 * How opaque Saturn's rings are at a distance from its centre (km): the faint C ring, the
 * dense B ring, the Cassini Division, the A ring and the Encke Gap. Rough optical depths.
 */
export function ringOpacity(radiusKm: number): number {
  if (radiusKm < SATURN_RINGS_KM.inner || radiusKm > SATURN_RINGS_KM.outer) return 0;
  if (radiusKm < 92_000) return 0.12; // C ring
  if (radiusKm < 117_580) return 0.85; // B ring
  if (radiusKm < 122_170) return 0.08; // Cassini Division
  if (Math.abs(radiusKm - 133_589) < 160) return 0.05; // Encke Gap
  return 0.55; // A ring
}

/** What a planet wears close up, and what the picture is, when it was made and whose it is. */
export interface PlanetPicture {
  /** A mission's global map under `public/`, or null where the painted colours stand in. */
  readonly map: string | null;
  /** The same map sharper, fetched only close up (#258); null where there is none. */
  readonly sharp: string | null;
  readonly caption: string;
}

export const PLANET_PICTURES: Readonly<Record<PlanetName, PlanetPicture>> = {
  mercury: {
    map: 'textures/planets/mercury-2048.jpg',
    sharp: 'textures/planets/mercury-4096.jpg',
    caption:
      'Pictured: MESSENGER’s map of the whole planet, from its first months in orbit (2011), brightened to show the craters. NASA/JHU APL/Carnegie Institution of Washington.',
  },
  venus: {
    map: null,
    sharp: null,
    caption:
      'Pictured: the cloud tops, as a plain colour. From space the clouds hide the ground, which only radar (Magellan, 1990–94) has mapped.',
  },
  mars: {
    map: 'textures/planets/mars-2048.jpg',
    sharp: 'textures/planets/mars-4096.jpg',
    caption:
      'Pictured: the Viking orbiters’ colour mosaic of the whole planet, from images of 1976–80. NASA/JPL/USGS.',
  },
  jupiter: {
    map: 'textures/planets/jupiter-2048.jpg',
    sharp: 'textures/planets/jupiter-3600.jpg',
    caption:
      'Pictured: Cassini’s map of the cloud tops, from its flyby in December 2000; the clouds have changed since. NASA/JPL/Space Science Institute.',
  },
  saturn: {
    map: 'textures/planets/saturn-2048.jpg',
    sharp: 'textures/planets/saturn-3600.jpg',
    caption:
      'Pictured: Cassini’s map of the cloud tops on 11 August 2011, the great northern storm of 2010–11 trailing round the planet; the poles and the strip in the rings’ shadow, not imaged, are filled with the colour of the nearest latitude. NASA/JPL/Space Science Institute; Li, West, Jiang & Knowles (NASA PDS, 2023).',
  },
};

/** What the Moon wears: LRO's mosaic, from NASA's CGI Moon Kit. */
export const MOON_CAPTION =
  'Pictured: the Lunar Reconnaissance Orbiter’s colour mosaic, from NASA’s CGI Moon Kit. NASA’s Scientific Visualization Studio.';

/** One way of looking at a planet or the Moon close up, in the Light switch (#239). */
export interface PlanetView {
  readonly key: string;
  readonly label: string;
  /** What light or data it is, beneath the label. */
  readonly detail: string;
  readonly map: string | null;
  readonly sharp: string | null;
  readonly caption: string;
}

/**
 * The ways of looking at each planet, and the Moon: first, as it looks (`PLANET_PICTURES`; the
 * Moon's usual map, null here); then any others the missions give. Venus's ground is seen only
 * by radar, beneath clouds that hide it.
 */
export const PLANET_VIEWS: Readonly<Record<PlanetName | 'moon', readonly PlanetView[]>> = {
  mercury: [
    { key: 'colour', label: 'As it looks', detail: 'visible light', ...PLANET_PICTURES.mercury },
    {
      key: 'minerals',
      label: 'Enhanced colour',
      detail: 'its rocks told apart',
      map: 'textures/planets/mercury-colour-2048.jpg',
      sharp: 'textures/planets/mercury-colour-4096.jpg',
      caption:
        'Pictured: MESSENGER’s enhanced-colour map, from its first year in orbit (2011–12). Not true colour: each colour is a measure of the light in several filters, chosen to tell Mercury’s rocks apart, the volcanic plains, the dark material, the young bright crater rays. NASA/JHU APL/Carnegie Institution of Washington.',
    },
  ],
  venus: [
    {
      key: 'clouds',
      label: 'Cloud tops',
      detail: 'as from space',
      ...PLANET_PICTURES.venus,
    },
    {
      key: 'radar',
      label: 'Ground, by radar',
      detail: 'Magellan, coloured by height',
      map: 'textures/planets/venus-radar-2048.jpg',
      sharp: 'textures/planets/venus-radar-4096.jpg',
      caption:
        'Pictured: the ground beneath the clouds, as Magellan’s radar mapped it (1990–94), coloured by height: blue lowlands to red and white highlands, Maxwell Montes highest. No eye could see this; radar passes through the clouds. NASA/JPL/USGS.',
    },
  ],
  mars: [
    { key: 'colour', label: 'As it looks', detail: 'visible light', ...PLANET_PICTURES.mars },
    {
      key: 'height',
      label: 'Height',
      detail: 'by laser, MOLA',
      map: 'textures/planets/mars-height-2048.jpg',
      sharp: 'textures/planets/mars-height-4096.jpg',
      caption:
        'Pictured: the height of the ground, measured by Mars Global Surveyor’s laser altimeter (MOLA, 1997–2001), shaded as if lit and coloured from blue lowlands to white heights: the northern plains low, the southern uplands high, Olympus Mons and the Tharsis volcanoes highest. NASA/JPL/GSFC/USGS.',
    },
  ],
  jupiter: [
    { key: 'colour', label: 'In 2000', detail: 'Cassini, passing by', ...PLANET_PICTURES.jupiter },
    {
      key: 'recent',
      label: 'In 2024',
      detail: 'Hubble, OPAL',
      map: 'textures/planets/jupiter-2024-2048.jpg',
      sharp: 'textures/planets/jupiter-2024-3600.jpg',
      caption:
        'Pictured: Hubble’s map of the cloud tops on 19–20 November 2024, from the Outer Planet Atmospheres Legacy programme; beside Cassini’s of 2000, the belts have changed colour and width. NASA/ESA, OPAL (A. Simon), CC BY 4.0.',
    },
  ],
  saturn: [
    { key: 'colour', label: 'As it looks', detail: 'visible light', ...PLANET_PICTURES.saturn },
  ],
  moon: [
    {
      key: 'colour',
      label: 'As it looks',
      detail: 'visible light',
      map: null,
      sharp: null,
      caption: MOON_CAPTION,
    },
    {
      key: 'height',
      label: 'Height',
      detail: 'by laser, LOLA',
      map: 'textures/moon-height-2048.jpg',
      sharp: 'textures/moon-height-4096.jpg',
      caption:
        'Pictured: the height of the ground, measured by the Lunar Reconnaissance Orbiter’s laser altimeter (LOLA, from 2009), shaded as if lit and coloured from blue lowlands to red and white heights: the dark seas low, the far side’s highlands high, and the South Pole–Aitken basin, the largest, deepest of all. NASA/GSFC/USGS.',
    },
  ],
};

/** The view a key names for a body, or its first (as it looks) when the key is not one of its. */
export function planetView(planet: PlanetName | 'moon', key: string): PlanetView {
  const views = PLANET_VIEWS[planet];
  return views.find((view) => view.key === key) ?? elementAt(views, 0);
}

/** Earth's and the Moon's maps fetched only close up (#258): Earth's in two sizes, the larger
 * for screens whose graphics allow it, the smaller for phones. */
export const SHARP_MAPS = {
  earth: {
    large: 'textures/earth-blue-marble-8192.jpg',
    small: 'textures/earth-blue-marble-4096.jpg',
  },
  moon: { large: 'textures/moon-lroc-4096.jpg', small: 'textures/moon-lroc-4096.jpg' },
} as const;
