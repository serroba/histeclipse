import { describe, expect, it } from 'vitest';

import { julianDayNumber } from '../time/julianDay';
import { IDENTITY, multiply, transpose, type Matrix3 } from './matrix';
import { earthFixedToJ2000 } from './precession';
import {
  cioLocator,
  earthRotationAngle,
  eclipticPole,
  equatorPole,
  longTermEarthFixedToJ2000,
  longTermMeanSiderealTime,
  longTermPrecessionMatrix,
} from './longTermPrecession';

const ARCSECOND = Math.PI / 180 / 3600;

/** Julian Day (TT) of a Julian epoch, as ERFA's long-term functions take them. */
const epoch = (year: number) => julianDayNumber(2_451_545 + (year - 2000) * 365.25);

function expectMatrix(actual: Matrix3, expected: Matrix3, digits: number): void {
  actual.forEach((row, i) => {
    row.forEach((value, j) => {
      expect(value).toBeCloseTo(expected[i]?.[j] ?? Number.NaN, digits);
    });
  });
}

describe('long-term precession, against ERFA', () => {
  // Reference values from ERFA's own test suite (t_erfa_c.c).
  it('places the ecliptic pole in 1500 BCE', () => {
    const [x, y, z] = eclipticPole(epoch(-1500));
    expect(x).toBeCloseTo(0.00047686256764770964, 13);
    expect(y).toBeCloseTo(-0.40522595330918754, 13);
    expect(z).toBeCloseTo(0.9142164401096448, 13);
  });

  it('places the equator pole in 2500 BCE', () => {
    const [x, y, z] = equatorPole(epoch(-2500));
    expect(x).toBeCloseTo(-0.35866525602373267, 13);
    expect(y).toBeCloseTo(-0.19969789107711286, 13);
    expect(z).toBeCloseTo(0.911855244225082, 13);
  });

  it('builds the precession matrix', () => {
    expectMatrix(
      longTermPrecessionMatrix(epoch(1666.666)),
      [
        [0.9967044141159214, 0.0743780189319321, 0.03237624409345603],
        [-0.07437802731819618, 0.9972293894454534, -0.0012057688427235932],
        [-0.03237622482766576, -0.001206286039697609, 0.9994750246704011],
      ],
      13,
    );
    // From pyerfa's ltp(), across the range the sky view covers.
    expectMatrix(
      longTermPrecessionMatrix(epoch(-3000)),
      [
        [0.3564105348090155, 0.8530576116899994, 0.3811354638641043],
        [-0.8540049544811896, 0.46290623550043347, -0.2374728507775125],
        [-0.3790080057185244, -0.24085374872019666, 0.8935000858022877],
      ],
      13,
    );
    expectMatrix(
      longTermPrecessionMatrix(epoch(2100)),
      [
        [0.9997026845922123, -0.022364912820843574, -0.009713552060882799],
        [0.022364913850939246, 0.9997498681417056, -0.00010853148003700083],
        [0.009713549689144518, -0.00010874354307250138, 0.9999528164504955],
      ],
      13,
    );
  });

  it('is orthonormal', () => {
    const m = longTermPrecessionMatrix(epoch(-3000));
    expectMatrix(multiply(m, transpose(m)), IDENTITY, 13);
  });
});

describe('Earth rotation', () => {
  // pyerfa era00, s06 and gmst06, with TT = UT for simplicity.
  const cases = [
    { jd: 2_469_807.5, era: 1.7489076931432166, gmst: 1.760089633041066, s: 1.0583662693251239e-7 },
    { jd: 2_488_070.0, era: 4.886039480642268, gmst: 4.908406663271283, s: -4.805135337494202e-9 },
    { jd: 2_415_020.0, era: 4.903882945005279, gmst: 4.881529395896878, s: -2.3365920357517744e-7 },
  ];

  it.each(cases)('matches ERFA’s Earth Rotation Angle at JD $jd', ({ jd, era }) => {
    expect(earthRotationAngle(julianDayNumber(jd))).toBeCloseTo(era, 11);
  });

  // The two precession models differ by milliarcseconds near J2000.
  it.each(cases)('matches IAU 2006 sidereal time within 0.05″ at JD $jd', ({ jd, gmst }) => {
    const ours = longTermMeanSiderealTime(julianDayNumber(jd), julianDayNumber(jd));
    expect(Math.abs(ours - gmst) / ARCSECOND).toBeLessThan(0.05);
  });

  // ERFA's s includes nutation, which moves it by a few hundredths of an arcsecond.
  it.each(cases)('matches the IAU 2006 CIO locator within 0.05″ at JD $jd', ({ jd, s }) => {
    expect(Math.abs(cioLocator(julianDayNumber(jd)) - s) / ARCSECOND).toBeLessThan(0.05);
  });

  it('is zero at J2000 and turns once a stellar day', () => {
    expect(cioLocator(julianDayNumber(2_451_545))).toBe(0);
    const day = 1 / (1 + 0.002_737_811_911_354_48);
    const a = earthRotationAngle(julianDayNumber(2_451_545.25));
    const b = earthRotationAngle(julianDayNumber(2_451_545.25 + day));
    // Float resolution on a Julian Day near 2.45 million is about 0.0007″ of rotation.
    expect(Math.abs(b - a) / ARCSECOND).toBeLessThan(0.001);
  });

  it('carries the North Pole to the equator pole of date', () => {
    const [, , pole] = transpose(longTermEarthFixedToJ2000(epoch(-3000), epoch(-3000)));
    const expected = equatorPole(epoch(-3000));
    pole.forEach((value, axis) => {
      expect(value).toBeCloseTo(expected[axis] ?? Number.NaN, 13);
    });
  });
});

describe('the IAU 1976 model used so far', () => {
  /** Rotation angle (arcminutes) between two orientations. */
  const apart = (a: Matrix3, b: Matrix3): number => {
    const m = multiply(transpose(a), b);
    return (Math.acos(Math.min(1, (m[0][0] + m[1][1] + m[2][2] - 1) / 2)) * 180 * 60) / Math.PI;
  };

  it.each([
    // Year, then the worst difference in arcminutes. Near today it is nutation (≤ 0.3′), which
    // only the IAU 1976 path includes; back in time the old polynomials drift.
    [-4000, 7],
    [-3000, 2.7],
    [-1000, 0.4],
    [2000, 0.4],
  ])('orients Earth within a few arcminutes of it in %i', (year, limit) => {
    let worst = 0;
    for (let day = 0; day < 365; day += 5) {
      const jd = julianDayNumber(2_451_545 + (year - 2000) * 365.25 + day + 0.37);
      worst = Math.max(worst, apart(earthFixedToJ2000(jd, jd), longTermEarthFixedToJ2000(jd, jd)));
    }
    expect(worst).toBeLessThan(limit);
  });
});
