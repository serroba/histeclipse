import { describe, expect, it } from 'vitest';

import bce600 from '../../public/data/empires/-600.json';
import bce800 from '../../public/data/empires/-800.json';
import lunarBce600 from '../../public/data/lunar/-600.json';
import solarBce600 from '../../public/data/solar/-600.json';
import solarBce800 from '../../public/data/solar/-800.json';
import { territoriesIn, type EmpireCentury } from '../data/empires';
import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import { eclipseMoment } from './describe';
import { shadowAtHours } from './solar';
import { centreLinePoint, inRegion, lunarSeenIn, regionOf, solarSeenIn } from './seenIn';

// Catalog and border files as the site serves them; their schemas are tested with the loaders.
const solar = [...solarBce800, ...solarBce600] as unknown as SolarEclipse[];
const lunar = lunarBce600 as unknown as LunarEclipse[];

function territory(file: unknown, name: string, year: number) {
  const found = territoriesIn(file as EmpireCentury, year).find((t) => t.name === name);
  if (found === undefined) throw new Error(`${name} is not on the map in ${String(year)}`);
  return regionOf(found);
}

function solarIn(year: number, month: number): SolarEclipse {
  const found = solar.find((eclipse) => {
    const { date } = eclipseMoment(eclipse);
    return date.year === year && date.month === month;
  });
  if (found === undefined) throw new Error(`No solar eclipse in ${String(year)}/${String(month)}`);
  return found;
}

const square = (west: number, south: number, size: number) => ({
  rings: [
    [
      [west, south],
      [west + size, south],
      [west + size, south + size],
      [west, south + size],
      [west, south],
    ] as const,
  ],
});

describe('regions', () => {
  it('know what lies inside them, across the 180° meridian too', () => {
    // Written as it comes from the files, with longitudes jumping from 180° to −180°.
    const pacific = regionOf({
      rings: [
        [
          [170, -10],
          [-170, -10],
          [-170, 10],
          [170, 10],
          [170, -10],
        ],
      ],
    });
    const otherWay = regionOf({
      rings: [
        [
          [-170, -10],
          [-170, 10],
          [170, 10],
          [170, -10],
          [-170, -10],
        ],
      ],
    });
    expect(inRegion(otherWay, { latitude: 0, longitude: 179 })).toBe(true);
    expect(inRegion(pacific, { latitude: 0, longitude: 179 })).toBe(true);
    expect(inRegion(pacific, { latitude: 0, longitude: -175 })).toBe(true);
    expect(inRegion(pacific, { latitude: 0, longitude: -165 })).toBe(false);
    expect(inRegion(pacific, { latitude: 15, longitude: 180 })).toBe(false);
    // Corners plus a grid point every 2° inside.
    expect(pacific.samples.length).toBeGreaterThan(5 + 80);
  });

  it('ignore rings too short to enclose anything', () => {
    expect(
      regionOf({
        rings: [
          [
            [0, 0],
            [1, 1],
          ],
        ],
      }).samples,
    ).toEqual([]);
  });
});

describe('solar eclipses seen in a territory', () => {
  // 15 June 763 BCE: the Assyrian eponym list's "the Sun was eclipsed", total in Assyria.
  const assyrian = solarIn(-762, 6);
  // 28 May 585 BCE: Herodotus's eclipse that stopped the battle between Lydia and Media.
  const thales = solarIn(-584, 5);

  it('find the path of totality crossing Assyria in 763 BCE', () => {
    const assyria = territory(bce800, 'Neo-Assyrian Empire', -762);
    expect(solarSeenIn(assyrian, assyria, 0)).toEqual({
      verdict: 'seen',
      phase: 'total',
      phases: ['total'],
    });
  });

  it('see Thales’s eclipse total in Lydia, and partial in Egypt', () => {
    expect(solarSeenIn(thales, territory(bce600, 'Lydia', -584), 0).phase).toBe('total');
    const egypt = solarSeenIn(thales, territory(bce600, 'Twenty-sixth Dynasty of Egypt', -584), 0);
    expect(egypt.phase).toBe('partial');
    expect(egypt.verdict).toBe('seen');
  });

  it('find an annular eclipse annular where its path runs', () => {
    const annular = solar.find(
      (eclipse) => eclipse.kind === 'annular' && Math.abs(eclipse.gamma) < 0.5,
    );
    if (annular === undefined) throw new Error('No annular eclipse in the catalog files');
    const [latitude, longitude] = annular.greatest;
    expect(solarSeenIn(annular, regionOf(square(longitude - 2, latitude - 2, 4)), 0).phase).toBe(
      'annular',
    );
  });

  it('miss a territory on the night side of Earth', () => {
    const australia = regionOf(square(130, -35, 10));
    expect(solarSeenIn(thales, australia, 0)).toEqual({
      verdict: 'not',
      phase: 'none',
      phases: ['none'],
    });
  });

  it('say "maybe" when ΔT decides whether the edge of the shadow arrives', () => {
    // A strip of longitude from far west to far east: some width of it must be borderline.
    const verdicts = new Set(
      Array.from({ length: 72 }, (_, step) => {
        const region = regionOf(square(-180 + step * 5, 30, 1));
        return solarSeenIn(thales, region, 3600).verdict;
      }),
    );
    expect(verdicts).toEqual(new Set(['seen', 'maybe', 'not']));
  });
});

describe('the centre line', () => {
  it('runs where the umbra is, and is missing when the axis passes beside Earth', () => {
    const assyrian = solarIn(-762, 6);
    const centre = centreLinePoint(shadowAtHours(assyrian.elements, 0, assyrian.deltaT));
    expect(centre?.phase).toBe('total');
    expect(centre?.point.latitude).toBeCloseTo(assyrian.greatest[0], 0);
    expect(
      centreLinePoint({ x: 1, y: 1, d: 0, mu: 0, l1: 0.5, l2: 0, tanF1: 0, tanF2: 0 }),
    ).toBeNull();
    expect(
      centreLinePoint({ x: 0, y: 0, d: 0, mu: 0, l1: 0.5, l2: 0.01, tanF1: 0, tanF2: 0 })?.phase,
    ).toBe('annular');
  });
});

describe('lunar eclipses seen in a territory', () => {
  const total = lunar.find((eclipse) => eclipse.kind === 'total');
  const partial = lunar.find((eclipse) => eclipse.kind === 'partial');
  const penumbral = lunar.find((eclipse) => eclipse.kind === 'penumbral');
  if (total === undefined || partial === undefined || penumbral === undefined)
    throw new Error('catalog lacks kinds');
  const near = (eclipse: LunarEclipse) =>
    regionOf(square(eclipse.sublunar[1] - 1, eclipse.sublunar[0] - 1, 2));
  const opposite = (eclipse: LunarEclipse) =>
    regionOf(square(((eclipse.sublunar[1] + 360) % 360) - 180 - 1, -eclipse.sublunar[0] - 1, 2));

  it('count a total eclipse where the Moon is overhead, and not on the far side', () => {
    expect(lunarSeenIn(total, near(total), 0)).toEqual({
      verdict: 'seen',
      phase: 'total',
      phases: ['total'],
    });
    expect(lunarSeenIn(total, opposite(total), 0).verdict).toBe('not');
  });

  it('report a partial eclipse as partial and a penumbral one as penumbral', () => {
    expect(lunarSeenIn(partial, near(partial), 0).phase).toBe('partial');
    expect(lunarSeenIn(penumbral, near(penumbral), 0).phase).toBe('penumbral');
  });

  it('see only part of an eclipse when the Moon rises or sets during it', () => {
    // East of the Moon by more than 90°, the Moon sets during the eclipse: far enough east it
    // had set before the partial phase began, and in between ΔT decides.
    const phases = new Set(
      Array.from({ length: 50 }, (_, step) => {
        const east = ((total.sublunar[1] + 90 + step + 540) % 360) - 180;
        const region = regionOf(square(east, -1, 1));
        return lunarSeenIn(total, region, 1800).verdict;
      }),
    );
    expect(phases).toEqual(new Set(['seen', 'maybe', 'not']));
  });
});
