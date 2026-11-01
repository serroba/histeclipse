/**
 * Borders of past states and empires (`public/data/empires/`), from Cliopatria (Seshat Global
 * History Databank, CC BY 4.0), simplified by the pipeline's `empires` command: one file per
 * century, each polity's territory as rings over a range of astronomical years.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const year = v.pipe(v.number(), v.integer());

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.minLength(1)),
  /** First years (astronomical) of the centuries that have a file. */
  centuries: v.array(year),
});

const CenturySchema = v.strictObject({
  schemaVersion: v.literal(1),
  century: year,
  /** Coordinates are stored as integers: degrees × scale. */
  scale: v.pipe(v.number(), v.gtValue(0)),
  polities: v.array(
    v.strictObject({
      name: v.pipe(v.string(), v.minLength(1)),
      wikipedia: v.string(),
      from: year,
      to: year,
      /** Outer rings as flat [lon, lat, lon, lat, …] × scale. */
      rings: v.array(
        v.pipe(
          v.array(v.pipe(v.number(), v.integer())),
          v.check((ring) => ring.length >= 6 && ring.length % 2 === 0, 'rings are lon/lat pairs'),
        ),
      ),
    }),
  ),
});

export type EmpireIndex = v.InferOutput<typeof IndexSchema>;
export type EmpireCentury = v.InferOutput<typeof CenturySchema>;

/** A polity's territory in degrees: rings of [lon, lat] points. */
export interface Territory {
  readonly name: string;
  readonly wikipedia: string;
  readonly rings: readonly (readonly (readonly [number, number])[])[];
}

export async function loadEmpireIndex(url: string, fetchJson: Fetch): Promise<EmpireIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

export async function loadEmpireCentury(url: string, fetchJson: Fetch): Promise<EmpireCentury> {
  return getJson(fetchJson, url, CenturySchema);
}

/** The century file holding `year`, if there is one. */
export function centuryFor(index: EmpireIndex, year: number): number | null {
  const start = Math.floor(year / 100) * 100;
  return index.centuries.includes(start) ? start : null;
}

/** The territories held in `year`, in degrees. */
export function territoriesIn(century: EmpireCentury, year: number): Territory[] {
  return century.polities
    .filter((polity) => polity.from <= year && year <= polity.to)
    .map(({ name, wikipedia, rings }) => ({
      name,
      wikipedia,
      rings: rings.map((ring) => {
        const points: [number, number][] = [];
        for (let index = 0; index + 1 < ring.length; index += 2) {
          points.push([(ring[index] ?? 0) / century.scale, (ring[index + 1] ?? 0) / century.scale]);
        }
        return points;
      }),
    }));
}

/**
 * A ring with its longitudes made continuous: a ring crossing the 180° meridian would
 * otherwise jump from +179° to −179° and smear across the whole map. Its points may then run
 * past ±180°; drawing it again shifted by 360° covers the part on the other side.
 */
export function unwrapRing(ring: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  let shift = 0;
  let previous: number | null = null;
  for (const [lon, lat] of ring) {
    if (previous !== null) {
      if (lon - previous > 180) shift -= 360;
      else if (previous - lon > 180) shift += 360;
    }
    previous = lon;
    out.push([lon + shift, lat]);
  }
  return out;
}

/** Shoelace area of a ring, square degrees (planar; for ranking only). */
export function ringArea(ring: readonly (readonly [number, number])[]): number {
  let total = 0;
  ring.forEach(([x1, y1], index) => {
    const [x2, y2] = ring[(index + 1) % ring.length] ?? [x1, y1];
    total += x1 * y2 - x2 * y1;
  });
  return Math.abs(total) / 2;
}

/** Where to put a territory's name: the centroid of its largest ring, and that ring's area. */
export function labelPoint(territory: Territory): {
  latitude: number;
  longitude: number;
  area: number;
} {
  let best: readonly (readonly [number, number])[] = [];
  let area = -1;
  for (const ring of territory.rings) {
    const size = ringArea(unwrapRing(ring));
    if (size > area) {
      best = ring;
      area = size;
    }
  }
  // The ring's centroid (its centre of area), so densely drawn coasts don't pull the name.
  const points = unwrapRing(best);
  let lon = 0;
  let lat = 0;
  let twiceArea = 0;
  points.forEach(([x1, y1], index) => {
    const [x2, y2] = points[(index + 1) % points.length] ?? [x1, y1];
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    lon += (x1 + x2) * cross;
    lat += (y1 + y2) * cross;
  });
  if (twiceArea === 0) {
    lon = 0;
    lat = 0;
  } else {
    lon /= 3 * twiceArea;
    lat /= 3 * twiceArea;
  }
  const longitude = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { latitude: lat, longitude, area: Math.max(area, 0) };
}

/** A stable colour for a polity: the same name always gets the same hue. */
export function territoryHue(name: string): number {
  let hash = 2166136261;
  for (const char of name) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % 360;
}
