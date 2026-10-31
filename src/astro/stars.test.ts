import { describe, expect, it } from 'vitest';

import { julianDayNumber } from '../time/julianDay';
import { directionFromRaDec, type Vector3 } from './matrix';
import { starDirection, type StarMotion } from './stars';

const ARCSECOND = Math.PI / 180 / 3600;
const epoch = (year: number) => julianDayNumber(2_451_545 + (year - 2000) * 365.25);

function apart(a: Vector3, b: Vector3): number {
  const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(...cross), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / ARCSECOND;
}

const toward = (ra: number, dec: number): Vector3 =>
  directionFromRaDec((ra * Math.PI) / 180, (dec * Math.PI) / 180);

// Catalogue values from sky.json; expected positions from pyerfa's starpm (ERFA eraStarpm).
const STARS: readonly (StarMotion & {
  name: string;
  expected: readonly (readonly [number, number, number])[];
})[] = [
  {
    name: 'Arcturus',
    ra: 213.91542,
    dec: 19.1825,
    pmRa: -1093,
    pmDec: -1998,
    parallax: 90,
    radialVelocity: -5,
    expected: [
      [-3000, 215.54600635422494, 21.940933120511943],
      [1000, 214.23781425639496, 19.736939043883826],
    ],
  },
  {
    name: 'Vega',
    ra: 279.23458,
    dec: 38.78361,
    pmRa: 202,
    pmDec: 286,
    parallax: 123,
    radialVelocity: -14,
    expected: [
      [-3000, 278.8797760935717, 38.389326561613686],
      [1000, 279.16280453678445, 38.7042833359399],
    ],
  },
  {
    name: 'Sirius',
    ra: 101.28708,
    dec: -16.71611,
    pmRa: -553,
    pmDec: -1205,
    parallax: 375,
    radialVelocity: -8,
    expected: [
      [-3000, 102.0700934463159, -15.066897080676696],
      [1000, 101.44669867844247, -16.382355232867447],
    ],
  },
  {
    name: 'Fomalhaut',
    ra: 344.41292,
    dec: -29.62222,
    pmRa: 333,
    pmDec: -165,
    parallax: 149,
    radialVelocity: 7,
    expected: [
      [-3000, 343.8792676004278, -29.390763085441606],
      [1000, 344.3064479296885, -29.576295268317175],
    ],
  },
];

describe('starDirection', () => {
  it('is the catalogue position at J2000', () => {
    const [arcturus] = STARS;
    if (arcturus === undefined) throw new Error('no stars');
    expect(
      apart(starDirection(arcturus, epoch(2000)), toward(arcturus.ra, arcturus.dec)),
    ).toBeLessThan(1e-6);
  });

  for (const star of STARS) {
    it.each(star.expected)(`places ${star.name} in %i as ERFA does, within 1″`, (year, ra, dec) => {
      expect(apart(starDirection(star, epoch(year)), toward(ra, dec))).toBeLessThan(1);
    });
  }

  it('moves Arcturus about 3.2° between 3000 BCE and today', () => {
    const [arcturus] = STARS;
    if (arcturus === undefined) throw new Error('no stars');
    const moved = apart(
      starDirection(arcturus, epoch(-3000)),
      starDirection(arcturus, epoch(2000)),
    );
    expect(moved / 3600).toBeCloseTo(3.2, 1);
  });

  it('moves a star without a parallax across the sky at its proper motion', () => {
    const star: StarMotion = {
      ra: 0,
      dec: 0,
      pmRa: 1000,
      pmDec: 0,
      parallax: null,
      radialVelocity: 30,
    };
    // 1″ a year for 1,000 years (as a straight line, so 0.008″ short of the arc), ignoring
    // the radial velocity it cannot place.
    expect(apart(starDirection(star, epoch(3000)), toward(0, 0))).toBeCloseTo(1000, 1);
  });
});
