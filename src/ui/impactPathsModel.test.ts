import { describe, expect, it } from 'vitest';

import type { ImpactPath, PathPoint } from '../data/impactPaths';
import {
  boxTicks,
  coastSegments,
  craterSummary,
  graticule,
  idOf,
  journeyFrame,
  journeyStep,
  LOOSE,
  MAP,
  mapOpacities,
  mapPoint,
  reachedText,
  runSegments,
  shownKey,
  strikeRows,
  TIGHT,
  tooltipFor,
  tracks,
  travelSeconds,
  wrap,
  type Xyz,
} from './impactPathsModel';

/** Only what the model reads of an impact. */
function path(
  runs: readonly (readonly PathPoint[])[],
  options: {
    readonly id?: number;
    readonly tight?: boolean;
    readonly diameterKm?: number | null;
    readonly fromMa?: number;
    readonly beyondReach?: boolean;
  } = {},
): ImpactPath {
  const impact = {
    id: options.id ?? 1,
    name: 'Chicxulub',
    age: '66.0',
    diameterKm: options.diameterKm === undefined ? 150 : options.diameterKm,
  } as unknown as ImpactPath['impact'];
  return {
    impact,
    fromMa: options.fromMa ?? 66,
    tight: options.tight ?? true,
    beyondReach: options.beyondReach ?? false,
    runs,
  };
}

const point = (longitude: number, latitude: number, ma = 0): PathPoint => ({
  longitude,
  latitude,
  ma,
});
/** Each point as its longitude, latitude and age: easy to read back. */
const raw = (p: PathPoint): Xyz => [p.longitude, p.latitude, p.ma];

describe('mapPoint and graticule', () => {
  it('puts longitude across and latitude up the screen, in the map’s units', () => {
    expect(mapPoint({ longitude: 180, latitude: 90 })).toEqual([MAP[0] / 2, 0, -MAP[1] / 2]);
    expect(mapPoint({ longitude: -90, latitude: -45 }, 0.5)).toEqual([
      -MAP[0] / 4,
      0.5,
      MAP[1] / 4,
    ]);
  });

  it('draws 13 meridians and 5 parallels just under the coasts', () => {
    const segments = graticule();
    expect(segments).toHaveLength((13 + 5) * 6);
    expect(segments[1]).toBe(-0.01);
  });
});

describe('strikeRows', () => {
  it('makes a row where each path starts, and skips a path with no points', () => {
    const rows = strikeRows([
      path([[point(10, 20, 66), point(12, 22, 0)]]),
      path([], { id: 2 }),
      path([[point(-5, 5, 300)]], { id: 3, tight: false, diameterKm: null }),
    ]);
    expect(rows.map((row) => row.id)).toEqual([1, 3]);
    expect(rows[0]).toMatchObject({ longitude: 10, latitude: 20, time: -66, dating: TIGHT });
    expect(rows[0]?.width).toBe('150 km');
    expect(rows[1]).toMatchObject({ dating: LOOSE, width: 'not known', travelled: '0 km' });
  });

  it('sizes a crater 300 km across at 1', () => {
    const [row] = strikeRows([path([[point(0, 0)]], { diameterKm: 300 })]);
    expect(row?.size).toBeCloseTo(1);
  });
});

describe('tooltipFor and idOf', () => {
  it('reads a crater’s row, and nothing from anything else', () => {
    const [row] = strikeRows([path([[point(0, 0)]], { id: 7 })]);
    expect(tooltipFor(row)).toEqual({
      title: 'Chicxulub',
      rows: { Age: '66.0 Ma', Width: '150 km', Travelled: '0 km' },
    });
    expect(idOf(row)).toBe(7);
    expect(tooltipFor(null)).toBe('');
    expect(tooltipFor({ id: 7 })).toBe('');
    expect(idOf({ id: '7' })).toBeUndefined();
    expect(idOf(undefined)).toBeUndefined();
  });
});

describe('runSegments and tracks', () => {
  it('joins each point to the next', () => {
    expect(runSegments([point(0, 0, 2), point(1, 1, 1), point(2, 2, 0)], raw)).toEqual([
      0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 2, 0,
    ]);
    expect(runSegments([point(0, 0)], raw)).toEqual([]);
  });

  it('draws only the paths of the dating asked for, every run of each', () => {
    const tight = path([
      [point(0, 0), point(1, 0)],
      [point(5, 0), point(6, 0)],
    ]);
    const loose = path([[point(9, 9), point(8, 8)]], { tight: false });
    expect(tracks([tight, loose], true, raw)).toHaveLength(12);
    expect(tracks([tight, loose], false, raw)).toEqual([9, 9, 0, 8, 8, 0]);
  });
});

describe('coastSegments and wrap', () => {
  const at = (place: { longitude: number; latitude: number }): Xyz => [
    place.longitude,
    place.latitude,
    0,
  ];

  it('wraps longitudes into −180..180', () => {
    expect(wrap(190)).toBe(-170);
    expect(wrap(-190)).toBe(170);
    expect(wrap(540)).toBe(180 - 360);
    expect(wrap(45)).toBe(45);
  });

  it('wraps an outline past 180°, and breaks it where it crosses the antimeridian', () => {
    const ring = [
      [170, 0],
      [179, 1],
      [181, 2],
      [190, 3],
    ] as const;
    expect(coastSegments([[ring]], at)).toEqual([170, 0, 0, 179, 1, 0, -179, 2, 0, -170, 3, 0]);
  });
});

describe('journeyFrame', () => {
  it('takes in at least 60° by 30° around a short journey', () => {
    const frame = journeyFrame(path([[point(10, 10), point(12, 14)]]));
    expect(frame.centre).toEqual({ longitude: 11, latitude: 12 });
    expect(frame.width).toBeCloseTo((60 / 360) * MAP[0]);
    expect(frame.depth).toBeCloseTo((30 / 180) * MAP[1]);
  });

  it('takes in the whole of a long one, over every run', () => {
    const frame = journeyFrame(path([[point(-100, -40)], [point(20, 40)]]));
    expect(frame.centre).toEqual({ longitude: -40, latitude: 0 });
    expect(frame.width).toBeCloseTo((120 / 360) * MAP[0]);
    expect(frame.depth).toBeCloseTo((80 / 180) * MAP[1]);
  });
});

describe('the dot’s journey', () => {
  it('takes 3 to 8 seconds, longer for older craters', () => {
    expect(travelSeconds(path([], { fromMa: 10 }))).toBe(3);
    expect(travelSeconds(path([], { fromMa: 200 }))).toBe(5);
    expect(travelSeconds(path([], { fromMa: 500 }))).toBe(8);
  });

  it('goes from the strike to today, rests a second and a half there, and starts again', () => {
    const old = path([], { fromMa: 200 });
    expect(journeyStep(old, 0, 0)).toEqual({ t: 0, ma: 200 });
    expect(journeyStep(old, 0, 2.5)).toEqual({ t: 2.5, ma: 100 });
    expect(journeyStep(old, 5, 1).ma).toBe(0);
    expect(journeyStep(old, 6, 0.5)).toEqual({ t: 0, ma: 200 });
  });

  it('says today, or how long ago, to the million years', () => {
    expect(reachedText(0.4)).toBe('Today');
    expect(reachedText(65.6)).toBe('66 million years ago');
  });
});

describe('craterSummary', () => {
  it('says its age, its width and how far its plate carried it since it struck', () => {
    expect(craterSummary(path([[point(0, 0)]]))).toBe(
      '66.0 million years old, 150 km across. Carried about 0 km by its plate since it struck.',
    );
  });

  it('says when its width is not known, and when it struck before the reconstruction reaches', () => {
    const summary = craterSummary(path([], { diameterKm: null, beyondReach: true }));
    expect(summary).toContain('width not known');
    expect(summary).toContain('since 540 million years ago');
  });
});

describe('shownKey', () => {
  it('is empty when closed, and names the view, shape and moment otherwise', () => {
    expect(shownKey(null, 'map', 0)).toBe('');
    expect(shownKey('all', 'box', 12)).toBe('all:box:12');
    expect(shownKey({ id: 4 }, 'map', 0)).toBe('4:map:0');
  });
});

describe('mapOpacities and boxTicks', () => {
  it('fades the others behind a crater picked', () => {
    expect(mapOpacities(true).tight).toBeLessThan(mapOpacities(false).tight);
    expect(mapOpacities(false).dots).toBe(1);
  });

  it('gives a narrow screen fewer ticks', () => {
    expect(boxTicks(true).longitude).toHaveLength(3);
    expect(boxTicks(false).time).toHaveLength(6);
  });
});
