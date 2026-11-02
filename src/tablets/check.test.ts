import { describe, expect, it } from 'vitest';

import { candidateYear, check, checkAll, momentOf, type Observation, verdictMoment } from './check';
import { sunsetOn } from './tabletSky';
import { testSky } from './testSky';
import { VAT_4956 } from './vat4956';

const fitted = (bce: number, shift = 0) => {
  const candidate = candidateYear(bce, shift);
  if (candidate === null) throw new Error(`no candidate ${String(bce)}`);
  return checkAll(testSky, VAT_4956, candidate);
};
function observation(id: string): Observation {
  const found = VAT_4956.find((each) => each.id === id);
  if (found === undefined) throw new Error(`no observation ${id}`);
  return found;
}
const misses = (verdicts: ReturnType<typeof fitted>) =>
  verdicts.filter(({ fits }) => !fits).map(({ observation }) => observation.id);

describe('VAT 4956 against candidate years', () => {
  it('fits 568/567 BCE in all but the Moon by β Virginis, a known slip', () => {
    expect(misses(fitted(568))).toEqual(['I-9-moon']);
  });

  it('fits 588/587 BCE in about half, whichever month begins the year', () => {
    expect(fitted(588).filter(({ fits }) => fits)).toHaveLength(10);
    expect(fitted(588, 1).filter(({ fits }) => fits)).toHaveLength(10);
    expect(fitted(588, -1).filter(({ fits }) => fits)).toHaveLength(9);
  });

  it('lets the Moon alone fit 587 BCE, nineteen years on, but not the planets', () => {
    const verdicts = fitted(587);
    const moon = verdicts.filter(
      ({ observation }) => observation.kind === 'position' && observation.body === 'moon',
    );
    expect(moon.filter(({ fits }) => fits).length).toBeGreaterThanOrEqual(4);
    expect(misses(verdicts)).toEqual(
      expect.arrayContaining(['II-18-venus', 'III-1-mars', 'III-1-mercury']),
    );
  }, 60_000);
}, 120_000);

describe('a single check', () => {
  const candidate = candidateYear(568);
  if (candidate === null) throw new Error('no candidate');

  it('dates the evening after sunset and dusk just after it', () => {
    const start = candidate.months[0]?.start ?? 0;
    const sunset = sunsetOn(testSky, start + 7) ?? 0;
    expect(momentOf(testSky, 'evening', start, 9)).toBeCloseTo(sunset + 1.5 / 24, 6);
    expect(momentOf(testSky, 'dusk', start, 9)).toBeCloseTo(sunset + 0.5 / 24, 6);
    expect(momentOf(testSky, 'morning', start, 9) ?? 0).toBeGreaterThan(sunset);
  });

  it('reports what it computed, and fails a month the year does not have', () => {
    const venus = check(testSky, observation('II-18-venus'), candidate);
    expect(venus).toMatchObject({ fits: true });
    expect(venus.computed).toBeCloseTo(0.68, 1);
    const astray: Observation = { ...venus.observation, month: 'Addaru II' };
    expect(check(testSky, astray, candidate)).toMatchObject({ fits: false, date: null });
    const leap = check(testSky, observation('leap'), { ...candidate, previousLeap: null });
    expect(leap.fits).toBe(false);
  });

  it('reads "behind" as east along the ecliptic', () => {
    const venus = VAT_4956.find(({ id }) => id === 'II-18-venus');
    if (venus?.kind !== 'position') throw new Error('no Venus');
    // Direction only: without the distance the tablet gives.
    const { cubits, ...direction } = venus;
    expect(cubits).toBeCloseTo(1 + 4 / 24, 6);
    const ahead = check(testSky, { ...direction, relation: 'in front of' }, candidate);
    const behind = check(testSky, { ...direction, relation: 'behind' }, candidate);
    expect((ahead.computed ?? 0) + (behind.computed ?? 0)).toBeCloseTo(0, 6);
    expect(ahead.fits).not.toBe(behind.fits);
  });

  it('gives the moment to show for each kind of record', () => {
    const at = (id: string) => verdictMoment(testSky, check(testSky, observation(id), candidate));
    const venus = check(testSky, observation('II-18-venus'), candidate);
    expect(at('II-18-venus')).toBeCloseTo((sunsetOn(testSky, venus.date ?? 0) ?? 0) + 1.5 / 24, 6);
    expect(at('III-1-na')).toBe(
      sunsetOn(testSky, check(testSky, observation('III-1-na'), candidate).date ?? 0),
    );
    expect(at('I-14-na')).not.toBeNull();
    expect(at('X-19-venus')).not.toBeNull();
    expect(at('III-12-mars')).not.toBeNull();
    expect(at('leap')).toBeNull();
  });

  it('has no candidate outside the computed months', () => {
    expect(candidateYear(800)).toBeNull();
    expect(candidateYear(568, 1)?.months[0]?.start).toBe(candidate.months[1]?.start);
  });
});
