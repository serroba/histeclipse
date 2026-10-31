/**
 * Year numbering.
 *
 * Historians count 1 BCE → 1 CE with no year zero. Astronomers use a continuous
 * scale where 1 BCE = 0, 2 BCE = −1, … so N BCE = 1 − N. Mixing the two is the
 * classic off-by-one error in historical astronomy, so the astronomical year is
 * a branded type that can only be created through validated constructors.
 */

declare const astronomicalYearBrand: unique symbol;

/** A year on the astronomical scale (… −1, 0, 1 …), where 0 is 1 BCE. */
export type AstronomicalYear = number & { readonly [astronomicalYearBrand]: true };

export type Era = 'BCE' | 'CE';

/** A year as historians write it: a positive count plus an era, with no year zero. */
export interface HistoricalYear {
  readonly year: number;
  readonly era: Era;
}

export function astronomicalYear(value: number): AstronomicalYear {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Astronomical year must be a safe integer, got ${String(value)}`);
  }
  return value as AstronomicalYear;
}

export function toAstronomicalYear({ year, era }: HistoricalYear): AstronomicalYear {
  if (!Number.isSafeInteger(year) || year < 1) {
    throw new RangeError(`Historical year must be a positive integer, got ${String(year)}`);
  }
  return astronomicalYear(era === 'CE' ? year : 1 - year);
}

export function toHistoricalYear(year: AstronomicalYear): HistoricalYear {
  return year >= 1 ? { year, era: 'CE' } : { year: 1 - year, era: 'BCE' };
}

export function formatYear(year: AstronomicalYear): string {
  const historical = toHistoricalYear(year);
  return `${String(historical.year)} ${historical.era}`;
}
