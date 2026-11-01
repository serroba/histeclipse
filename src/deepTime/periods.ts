/**
 * Geological periods, by the base ages of the International Chronostratigraphic Chart
 * v2026/06 (International Commission on Stratigraphy; Cohen, Harper, Gibbard & Car 2025,
 * updated, Episodes 48: 105–115). Ages are millions of years ago (Ma); the chart gives each
 * an uncertainty, kept here so the interface can say how firm a boundary is.
 */

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

/** Youngest first. */
export const PERIODS: readonly Period[] = [
  { name: 'Quaternary', era: 'Cenozoic', base: 2.58, uncertainty: 0 },
  { name: 'Neogene', era: 'Cenozoic', base: 23.04, uncertainty: 0 },
  { name: 'Paleogene', era: 'Cenozoic', base: 66.0, uncertainty: 0 },
  { name: 'Cretaceous', era: 'Mesozoic', base: 143.1, uncertainty: 0.6 },
  { name: 'Jurassic', era: 'Mesozoic', base: 201.4, uncertainty: 0.2 },
  { name: 'Triassic', era: 'Mesozoic', base: 251.902, uncertainty: 0.024 },
  { name: 'Permian', era: 'Paleozoic', base: 298.9, uncertainty: 0.15 },
  { name: 'Carboniferous', era: 'Paleozoic', base: 358.86, uncertainty: 0.19 },
  { name: 'Devonian', era: 'Paleozoic', base: 419.62, uncertainty: 1.36 },
  { name: 'Silurian', era: 'Paleozoic', base: 443.1, uncertainty: 0.9 },
  { name: 'Ordovician', era: 'Paleozoic', base: 486.85, uncertainty: 1.5 },
  { name: 'Cambrian', era: 'Paleozoic', base: 538.8, uncertainty: 0.6 },
  { name: 'Ediacaran', era: 'Neoproterozoic', base: 635, uncertainty: 0, approximate: true },
  { name: 'Cryogenian', era: 'Neoproterozoic', base: 720, uncertainty: 0, approximate: true },
  { name: 'Tonian', era: 'Neoproterozoic', base: 1000, uncertainty: 0 },
  { name: 'Stenian', era: 'Mesoproterozoic', base: 1200, uncertainty: 0 },
  { name: 'Ectasian', era: 'Mesoproterozoic', base: 1400, uncertainty: 0 },
  { name: 'Calymmian', era: 'Mesoproterozoic', base: 1600, uncertainty: 0 },
  { name: 'Statherian', era: 'Paleoproterozoic', base: 1800, uncertainty: 0 },
  { name: 'Orosirian', era: 'Paleoproterozoic', base: 2050, uncertainty: 0 },
  { name: 'Rhyacian', era: 'Paleoproterozoic', base: 2300, uncertainty: 0 },
  { name: 'Siderian', era: 'Paleoproterozoic', base: 2500, uncertainty: 0 },
  { name: 'Neoarchean', era: 'Archean', base: 2800, uncertainty: 0, rank: 'era' },
  { name: 'Mesoarchean', era: 'Archean', base: 3200, uncertainty: 0, rank: 'era' },
  { name: 'Paleoarchean', era: 'Archean', base: 3600, uncertainty: 0, rank: 'era' },
  { name: 'Eoarchean', era: 'Archean', base: 4031, uncertainty: 3, rank: 'era' },
  { name: 'Hadean', era: '', base: 4567, uncertainty: 0, rank: 'eon' },
];

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
