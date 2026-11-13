/**
 * What the impacts' paths sheet draws (#304, #607), worked out apart from drawing it: a row per
 * crater, the tracks and coasts as line segments, where a picked crater's journey is framed and
 * how its dot travels, and what is written about it. Pure and unit-tested; the sheet and its two
 * phoria views are `impactPathsSheet.ts`.
 */

import type * as Phoria2 from 'phoria2';

import { pathKm, type ImpactPath, type PathPoint } from '../data/impactPaths';
import type { CratersShape, CratersView } from '../state/viewState';
import type { Ring } from '../util/polygons';

export type Xyz = readonly [number, number, number];

export interface Place {
  readonly longitude: number;
  readonly latitude: number;
}

export const TIGHT = 'Dated to within 10 million years';
export const LOOSE = 'Dated only loosely: drawn from the middle of its span';
export const ORANGE = '#ff8a3d';
export const GREY = '#8a93a8';

/** The map's size in the view's units: longitude across, latitude up the screen. */
export const MAP: readonly [number, number] = [12, 6];
/** The box: longitude, time, latitude. */
export const BOX: [number, number, number] = [12, 6, 6];

export const HOW_TO_READ: Readonly<Record<CratersShape, string>> = {
  map: 'Today’s world from above. Each line is a crater’s journey with its plate, from where it struck (the dot) to where it lies today. Pick a crater to follow it.',
  box: 'A stack of world maps: today on top, 540 million years ago at the bottom. Each line climbs from where a crater struck to where it lies today. The plane is the moment the slider shows.',
};

/** A place on the flat map, `lift` above it. */
export function mapPoint(place: Place, lift = 0): Xyz {
  return [(place.longitude / 180) * (MAP[0] / 2), lift, (-place.latitude / 90) * (MAP[1] / 2)];
}

/** The map's graticule, as line segments: meridians every 30°, parallels to 60° either side. */
export function graticule(): number[] {
  const out: number[] = [];
  for (let longitude = -180; longitude <= 180; longitude += 30) {
    out.push(
      ...mapPoint({ longitude, latitude: -90 }, -0.01),
      ...mapPoint({ longitude, latitude: 90 }, -0.01),
    );
  }
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    out.push(
      ...mapPoint({ longitude: -180, latitude }, -0.01),
      ...mapPoint({ longitude: 180, latitude }, -0.01),
    );
  }
  return out;
}

/** A crater with a path: where and when it struck, and what the tooltip says. */
export interface StrikeRow extends Place {
  readonly id: number;
  readonly name: string;
  readonly time: number;
  readonly tight: boolean;
  readonly dating: string;
  readonly age: string;
  readonly width: string;
  readonly travelled: string;
  /** 0 for the smallest, 1 for one 300 km across. */
  readonly size: number;
}

/** One row per crater with a path. */
export function strikeRows(paths: readonly ImpactPath[]): StrikeRow[] {
  return paths.flatMap((path) => {
    const first = path.runs[0]?.[0];
    if (first === undefined) return [];
    return [
      {
        id: path.impact.id,
        name: path.impact.name,
        longitude: first.longitude,
        latitude: first.latitude,
        time: -first.ma,
        tight: path.tight,
        dating: path.tight ? TIGHT : LOOSE,
        age: `${path.impact.age} Ma`,
        width:
          path.impact.diameterKm === null ? 'not known' : `${String(path.impact.diameterKm)} km`,
        travelled: `${Math.round(pathKm(path)).toLocaleString('en')} km`,
        size: Math.log10(1 + (path.impact.diameterKm ?? 1)) / Math.log10(301),
      },
    ];
  });
}

/** What hovering a crater's dot says; nothing over anything else. */
export function tooltipFor(datum: unknown): Phoria2.TooltipContent {
  if (typeof datum !== 'object' || datum === null || !('name' in datum)) return '';
  const row = datum as StrikeRow;
  return { title: row.name, rows: { Age: row.age, Width: row.width, Travelled: row.travelled } };
}

/** The crater a tap landed on, if any. */
export function idOf(datum: unknown): number | undefined {
  return typeof datum === 'object' &&
    datum !== null &&
    'id' in datum &&
    typeof datum.id === 'number'
    ? datum.id
    : undefined;
}

/** Every track of one dating, as line segments. */
export function tracks(
  paths: readonly ImpactPath[],
  tight: boolean,
  at: (point: PathPoint) => Xyz,
): number[] {
  const out: number[] = [];
  for (const path of paths) {
    if (path.tight !== tight) continue;
    for (const run of path.runs) out.push(...runSegments(run, at));
  }
  return out;
}

/** A run as line segments, each point to the next. */
export function runSegments(run: readonly PathPoint[], at: (point: PathPoint) => Xyz): number[] {
  const out: number[] = [];
  for (let step = 1; step < run.length; step++) {
    const a = run[step - 1];
    const b = run[step];
    if (a === undefined || b === undefined) continue;
    out.push(...at(a), ...at(b));
  }
  return out;
}

/**
 * Today's coasts as line segments. Some outlines run past 180° (Antarctica's to 540°): wrapped,
 * and broken where they cross the antimeridian.
 */
export function coastSegments(
  coasts: readonly (readonly Ring[])[],
  at: (place: Place) => Xyz,
): number[] {
  const out: number[] = [];
  for (const country of coasts) {
    for (const ring of country) {
      for (let step = 1; step < ring.length; step++) {
        const a = ring[step - 1];
        const b = ring[step];
        if (a === undefined || b === undefined) continue;
        const from = wrap(a[0]);
        const to = wrap(b[0]);
        if (Math.abs(from - to) > 180) continue;
        out.push(
          ...at({ longitude: from, latitude: a[1] }),
          ...at({ longitude: to, latitude: b[1] }),
        );
      }
    }
  }
  return out;
}

/** A longitude in −180..180. */
export function wrap(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/**
 * The patch of map the camera takes in for a journey: around it, at least 60° by 30°, so a short
 * journey is not zoomed into a blur. Its centre, and its size in the map's units.
 */
export function journeyFrame(path: ImpactPath): {
  readonly centre: Place;
  readonly width: number;
  readonly depth: number;
} {
  const points = path.runs.flat();
  const longitudes = points.map((p) => p.longitude);
  const latitudes = points.map((p) => p.latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  return {
    centre: { longitude: (west + east) / 2, latitude: (south + north) / 2 },
    width: (Math.max(60, east - west) / 360) * MAP[0],
    depth: (Math.max(30, north - south) / 180) * MAP[1],
  };
}

/** Seconds a journey's dot takes from strike to today: longer for older craters, 3 to 8. */
export function travelSeconds(path: ImpactPath): number {
  return Math.min(8, Math.max(3, path.fromMa / 40));
}

/**
 * The dot's journey `dt` seconds on from `t`: strike to today, a pause of a second and a half,
 * and again. Its new time, and the moment (Ma) it has reached.
 */
export function journeyStep(
  path: ImpactPath,
  t: number,
  dt: number,
): { readonly t: number; readonly ma: number } {
  const travel = travelSeconds(path);
  const next = (t + dt) % (travel + 1.5);
  return { t: next, ma: Math.max(0, path.fromMa * (1 - next / travel)) };
}

/** What the dot says it has reached. */
export function reachedText(ma: number): string {
  return ma < 0.5 ? 'Today' : `${String(Math.round(ma))} million years ago`;
}

/** What is said about a crater picked: its age, its width, how far its plate carried it. */
export function craterSummary(path: ImpactPath): string {
  const width =
    path.impact.diameterKm === null
      ? 'width not known'
      : `${String(path.impact.diameterKm)} km across`;
  const since = path.beyondReach
    ? ' since 540 million years ago, as far back as the reconstruction reaches'
    : ' since it struck';
  return `${path.impact.age} million years old, ${width}. Carried about ${Math.round(pathKm(path)).toLocaleString('en')} km by its plate${since}.`;
}

/** What the sheet shows, as one key: the same key, nothing to draw again; '' when closed. */
export function shownKey(view: CratersView | null, shape: CratersShape, ma: number): string {
  return view === null ? '' : `${view === 'all' ? 'all' : String(view.id)}:${shape}:${String(ma)}`;
}

/** How strongly the map draws the tracks and dots: faint behind a crater picked. */
export function mapOpacities(picked: boolean): {
  readonly tight: number;
  readonly loose: number;
  readonly dots: number;
} {
  return picked ? { tight: 0.12, loose: 0.1, dots: 0.35 } : { tight: 0.75, loose: 0.35, dots: 1 };
}

/** The box's axis ticks: fewer on a narrow screen. */
export function boxTicks(narrow: boolean): {
  readonly longitude: number[];
  readonly latitude: number[];
  readonly time: number[];
} {
  return narrow
    ? { longitude: [-180, 0, 180], latitude: [-90, 0, 90], time: [-500, -250, 0] }
    : {
        longitude: [-180, -90, 0, 90, 180],
        latitude: [-90, -45, 0, 45, 90],
        time: [-500, -400, -300, -200, -100, 0],
      };
}
