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
];

export const PERIOD_SOURCE =
  'International Chronostratigraphic Chart v2026/06, International Commission on Stratigraphy';

/** The period `ma` million years ago falls in (a base belongs to its period); null beyond the oldest. */
export function periodAt(ma: number): Period | null {
  return PERIODS.find((period) => ma <= period.base) ?? null;
}

/** "250 million years ago", "1.5 million years ago", or "Today". */
export function formatMa(ma: number): string {
  if (ma === 0) return 'Today';
  const amount = Number.isInteger(ma) ? String(ma) : ma.toFixed(1);
  return `${amount} million years ago`;
}
