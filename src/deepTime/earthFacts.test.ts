import { describe, expect, it } from 'vitest';

import { earthFacts } from './earthFacts';

function fact(ma: number, label: string): string {
  return earthFacts(ma).find((entry) => entry.label === label)?.text ?? '';
}

describe('earthFacts', () => {
  it('names the poles, field, tilt and day', () => {
    expect(earthFacts(250).map(({ label }) => label)).toEqual([
      'Poles',
      'Magnetic field',
      'Tilt',
      'Day',
    ]);
    expect(fact(250, 'Poles')).toContain('spin axis then');
    expect(fact(250, 'Tilt')).toContain('22.1° and 24.5°');
    expect(fact(250, 'Tilt')).toContain('41,000 years');
  });

  it('describes the field and how it is known', () => {
    expect(fact(0, 'Magnetic field')).toMatch(/^Normal polarity, as today/);
    expect(fact(100, 'Magnetic field')).toContain('Cretaceous Normal Superchron');
    expect(fact(100, 'Magnetic field')).not.toContain('rocks on land');
    expect(fact(290, 'Magnetic field')).toMatch(/^Reversed polarity.*Kiaman.*rocks on land/);
    expect(fact(50, 'Magnetic field')).toMatch(/^Reversing often/);
    expect(fact(50, 'Magnetic field')).toContain('cannot be known');
  });

  it('says how little is known before 540 Ma', () => {
    expect(fact(2000, 'Magnetic field')).toMatch(
      /^Too far back.*Tarduno et al\. 2010.*Weiss et al\. 2018/,
    );
    expect(fact(2000, 'Tilt')).toMatch(
      /^A much larger tilt has been proposed.*Néron de Surgy & Laskar 1997\)\. Today: Between 22\.1°/,
    );
    expect(fact(100, 'Tilt')).toMatch(/^Between/);
  });

  it('gives the measured day, or the measurements either side', () => {
    expect(fact(0, 'Day')).toBe('24.0 h today.');
    expect(fact(30, 'Day')).toMatch(/^Measured 24\.0 h today, and 23\.5 h 70 Ma/);
    expect(fact(250, 'Day')).toBe(
      'Measured 23.5 h 70 Ma, from daily layers in a rudist shell (Oman) (de Winter et al. 2020, Paleoceanography and Paleoclimatology 35), and 21.9 h 390 Ma, from daily growth lines on Devonian corals (Wells 1963, Nature 197).',
    );
    expect(fact(700, 'Day')).toMatch(/^Shorter than 21\.9 ± 0\.4 h: 21\.9 ± 0\.4 h 620 Ma/);
  });
});
