import { describe, expect, it } from 'vitest';

import type { Verdict } from './check';
import {
  bodyName,
  civilDateText,
  computedText,
  cubitsText,
  recordBodies,
  recordedText,
} from './verdictText';
import { VAT_4956 } from './vat4956';

function verdict(id: string, computed: number | null, fits = true): Verdict {
  const observation = VAT_4956.find((each) => each.id === id);
  if (observation === undefined) throw new Error(id);
  return { observation, date: computed === null ? null : -207_310, computed, fits };
}

describe('tablet records in words', () => {
  it('write distances in cubits and fingers', () => {
    expect(cubitsText(1 + 4 / 24)).toBe('1 cubit 4 fingers');
    expect(cubitsText(2 / 3)).toBe('16 fingers');
    expect(cubitsText(-2)).toBe('2 cubits');
    expect(cubitsText(1 / 24)).toBe('1 finger');
    expect(cubitsText(0)).toBe('0 fingers');
  });

  it('write civil dates in the Julian calendar', () => {
    // Forty-one days after 1 Nisannu (23 April) of 568 BCE, fixed day −207,351.
    expect(civilDateText(-207_310)).toBe('3 Jun 568 BCE');
  });

  it('set what was computed beside what was recorded', () => {
    expect(recordedText(verdict('II-18-venus', 0.68))).toBe('1 cubit 4 fingers above');
    expect(computedText(verdict('II-18-venus', 0.68))).toBe('16 fingers above');
    expect(computedText(verdict('II-18-venus', -0.5))).toBe('12 fingers below');
    expect(recordedText(verdict('III-1-jupiter', 2))).toBe('above');
    expect(recordedText(verdict('II-26-kur', 23.1))).toBe('23 UŠ');
    expect(computedText(verdict('II-26-kur', 23.11))).toBe('23.1 UŠ');
    expect(computedText(verdict('II-26-kur', null))).toBe('not seen that day');
    expect(recordedText(verdict('II-3-mars', 0.2))).toBe('within the cluster');
    expect(computedText(verdict('II-3-mars', 0.25))).toBe('6 fingers away');
    expect(recordedText(verdict('leap', null))).toBe('the year before had Addaru II');
    expect(computedText(verdict('leap', null))).toBe('the year before had Addaru II');
    expect(computedText(verdict('leap', null, false))).toBe('the year before had no second Addaru');
  });
});

describe('the bodies a record names', () => {
  it('names the Moon, planets and the tablet\u2019s stars, and falls back to the HR number', () => {
    expect(bodyName('moon')).toBe('Moon');
    expect(bodyName('venus')).toBe('Venus');
    expect(bodyName({ star: 4540 })).toBe('β Virginis');
    expect(bodyName({ star: 1 })).toBe('HR 1');
  });

  it('points out a position\u2019s two bodies, the lunar six\u2019s Moon and Sun, and none for the calendar', () => {
    const byKind = (kind: string) => VAT_4956.find((observation) => observation.kind === kind);
    const position = byKind('position');
    const six = byKind('lunar six');
    const leap = byKind('leap');
    if (position === undefined || six === undefined || leap === undefined) {
      throw new Error('VAT 4956 lacks a kind of record');
    }
    expect(recordBodies(position)).toEqual(['moon', { star: 4540 }]);
    expect(recordBodies(six)).toEqual(['moon', 'sun']);
    expect(recordBodies(leap)).toEqual([]);
  });

  it('has a name for every star the tablet mentions', () => {
    for (const observation of VAT_4956) {
      for (const body of recordBodies(observation)) expect(bodyName(body)).not.toMatch(/^HR /);
    }
  });
});
