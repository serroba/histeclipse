/**
 * Geological periods, from the International Chronostratigraphic Chart v2026/06 (International
 * Commission on Stratigraphy; Cohen, Harper, Gibbard & Car 2025, updated, Episodes 48: 105–115)
 * in its official machine-readable form (`chart.ts`). Ages are millions of years ago (Ma); the
 * chart gives each an uncertainty, kept here so the interface can say how firm a boundary is.
 */

import { CHART } from './chart';

export interface Period {
  readonly name: string;
  readonly era: string;
  /** Base (start) of the period, Ma, and its ± uncertainty (0 where the chart gives none). */
  readonly base: number;
  readonly uncertainty: number;
  /** True where the chart marks the age as approximate (~). */
  readonly approximate?: boolean;
  /**
   * The Archean has no periods, only eras, and the Hadean no divisions: there `name` is an era
   * (and `era` its eon) or an eon (and `era` empty).
   */
  readonly rank?: 'era' | 'eon';
}

function nameOf(id: string | null): string {
  return CHART.units.find((unit) => unit.id === id)?.name ?? '';
}

/**
 * Youngest first, from the chart: its periods, then the Archean's eras (it has no periods) and
 * the Hadean eon (it has no divisions).
 */
export const PERIODS: readonly Period[] = CHART.units
  .filter(
    (unit) =>
      unit.rank === 'Period' ||
      (unit.rank === 'Era' && unit.parent === 'Archean') ||
      (unit.rank === 'Eon' && unit.id === 'Hadean'),
  )
  .map((unit): Period => {
    const rank = unit.rank === 'Era' ? 'era' : unit.rank === 'Eon' ? 'eon' : undefined;
    return {
      name: unit.name,
      era: rank === 'eon' ? '' : nameOf(unit.parent),
      base: unit.base,
      uncertainty: unit.baseMargin,
      ...(unit.baseUncertain ? { approximate: true } : {}),
      ...(rank === undefined ? {} : { rank }),
    };
  })
  .sort((a, b) => a.base - b.base);

/** "Triassic period · Mesozoic era", "Neoarchean era · Archean eon", or "Hadean eon". */
export function periodWords(period: Period): string {
  switch (period.rank) {
    case 'eon':
      return `${period.name} eon`;
    case 'era':
      return `${period.name} era · ${period.era} eon`;
    case undefined:
      return `${period.name} period · ${period.era} era`;
    default:
      return period.name;
  }
}

/** The short form for the bar: "Triassic · Mesozoic", "Neoarchean · Archean", "Hadean". */
export function periodShort(period: Period): string {
  return period.era === '' ? period.name : `${period.name} · ${period.era}`;
}

/** Below this, moments read in years: the scale of the ice ages. */
const ICE_AGE_WORDS_MA = 3;

export const PERIOD_SOURCE =
  'International Chronostratigraphic Chart v2026/06, International Commission on Stratigraphy';

/** The period `ma` million years ago falls in (a base belongs to its period); null beyond the oldest. */
export function periodAt(ma: number): Period | null {
  return PERIODS.find((period) => ma <= period.base) ?? null;
}

/**
 * "250 million years ago", "252.5 million years ago", or, within the ice ages, in years:
 * "21,000 years ago", "2,581,000 years ago"; or "Today".
 */
export function formatMa(ma: number): string {
  if (ma === 0) return 'Today';
  if (ma < ICE_AGE_WORDS_MA) return `${Math.round(ma * 1e6).toLocaleString('en')} years ago`;
  const amount = Number.isInteger(ma) ? ma.toLocaleString('en') : ma.toFixed(1);
  return `${amount} million years ago`;
}
