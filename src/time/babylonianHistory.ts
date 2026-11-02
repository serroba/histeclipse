/**
 * What the sources say about Babylonian years, 747–311 BCE: which years had a leap month before
 * the 19-year cycle took hold, and whose reign each year belonged to.
 *
 * - Leap months, 626–367 BCE: R. A. Parker & W. H. Dubberstein, *Babylonian Chronology 626
 *   B.C.–A.D. 45* (SAOC 24, Oriental Institute, 1942), Plate I and pp. 5–7. A capital letter
 *   there is a leap month named on dated tablets ("attested"); a small one is their reconstruction
 *   ("probable"). Before 626 BCE they judged reconstruction "much too hazardous".
 * - Reigns, as dated on tablets: the same work's tables, years counted Babylonian-fashion: the
 *   rest of the year a king came to the throne was his accession year, and his year 1 began at
 *   the next Nisannu.
 * - Ptolemy's royal canon (Handy Tables, 2nd century CE): reigns in whole Egyptian years of 365
 *   days counted from Nabonassar, each king credited with the year in which he came to the throne
 *   and kings who reigned under a year left out.
 *
 * Years here are the year BCE in which a Babylonian year began (in spring).
 */

export type LeapKind = 'Addaru II' | 'Ululu II';

export interface LeapMonth {
  readonly kind: LeapKind;
  /** Named on dated tablets; otherwise reconstructed by Parker & Dubberstein. */
  readonly attested: boolean;
}

/** Years BCE from which Parker & Dubberstein's leap months are used: 626–367. */
export const LEAPS_FROM_BCE = 626;
export const LEAPS_UNTIL_BCE = 367;

/**
 * Plate I, periods 7–20: for each nineteen-year period (by the year BCE it begins), the years of
 * the period (1–19) with a leap month. "A"/"U" attested second Addaru/Ululu; "a"/"u" probable.
 */
const PLATE: Readonly<Record<number, Readonly<Record<number, 'A' | 'U' | 'a' | 'u'>>>> = {
  633: { 9: 'a', 12: 'u', 15: 'U', 18: 'U' },
  614: { 1: 'u', 4: 'U', 6: 'u', 9: 'A', 12: 'U', 14: 'A', 17: 'U', 19: 'U' },
  // Year 5 (591 BCE, Nebuchadnezzar's 14th) is small on the plate, but pp. 5–6 cite its
  // Addaru II from tablets (Contenau, TCL XII 35; Moore, NBD 29): taken as attested.
  595: { 3: 'u', 5: 'A', 8: 'A', 12: 'u', 14: 'A', 17: 'A', 19: 'A' },
  576: { 3: 'U', 5: 'A', 8: 'A', 13: 'U', 14: 'A', 17: 'A' },
  557: { 1: 'A', 3: 'A', 5: 'A', 8: 'A', 12: 'U', 14: 'A', 17: 'A' },
  538: { 2: 'U', 3: 'A', 6: 'A', 9: 'U', 12: 'U', 14: 'A', 17: 'A' },
  519: { 1: 'U', 3: 'A', 6: 'A', 9: 'U', 11: 'A', 14: 'A', 17: 'U' },
  500: { 1: 'A', 3: 'A', 6: 'A', 8: 'a', 11: 'A', 14: 'A', 17: 'U' },
  481: { 1: 'A', 3: 'a', 6: 'a', 8: 'A', 11: 'a', 14: 'a', 17: 'u', 19: 'a' },
  462: { 3: 'a', 6: 'a', 8: 'A', 11: 'a', 14: 'a', 17: 'u', 19: 'a' },
  443: { 3: 'a', 6: 'a', 8: 'a', 11: 'A', 14: 'a', 17: 'u', 19: 'A' },
  424: { 3: 'A', 6: 'A', 8: 'a', 11: 'A', 14: 'a', 17: 'u', 19: 'a' },
  405: { 3: 'a', 6: 'a', 8: 'a', 11: 'a', 14: 'a', 17: 'u', 19: 'A' },
  386: { 2: 'A', 6: 'A', 8: 'A', 11: 'A', 14: 'A', 17: 'U', 19: 'A' },
};

const LEAPS: ReadonlyMap<number, LeapMonth> = new Map(
  Object.entries(PLATE).flatMap(([start, years]) =>
    Object.entries(years).map(([place, letter]) => [
      Number(start) - (Number(place) - 1),
      {
        kind: letter.toUpperCase() === 'U' ? 'Ululu II' : 'Addaru II',
        attested: letter === letter.toUpperCase(),
      } as const,
    ]),
  ),
);

/**
 * The leap month of the Babylonian year beginning in `bce`, for 626–367 BCE: a leap month, or
 * null for a year of twelve months. Undefined outside those years.
 */
export function leapMonthOf(bce: number): LeapMonth | null | undefined {
  if (bce > LEAPS_FROM_BCE || bce < LEAPS_UNTIL_BCE) return undefined;
  return LEAPS.get(bce) ?? null;
}

// --- Reigns ---------------------------------------------------------------------------------

export interface Reign {
  readonly king: string;
  /** The year BCE of his accession year, where it was counted: year 0, before his year 1. */
  readonly accession?: number;
  /** The years BCE of his first and last numbered years, and the number of the first. */
  readonly first?: number;
  readonly last?: number;
  readonly firstYear?: number;
  /** A second count in use at the same time: this many years less. */
  readonly alsoLess?: number;
}

/**
 * Reigns as dated on Babylonian tablets (Parker & Dubberstein's tables and notes), 626–312 BCE.
 * A Babylonian year can hold a king's last year and his successors' accession years. From
 * Alexander on, the accession year was dropped: the rest of the year became year 1.
 */
export const TABLET_REIGNS: readonly Reign[] = [
  { king: 'Nabopolassar', accession: 626, first: 625, last: 605 },
  { king: 'Nebuchadnezzar II', accession: 605, first: 604, last: 562 },
  { king: 'Amel-Marduk', accession: 562, first: 561, last: 560 },
  { king: 'Neriglissar', accession: 560, first: 559, last: 556 },
  { king: 'Labashi-Marduk', accession: 556 },
  { king: 'Nabonidus', accession: 556, first: 555, last: 539 },
  { king: 'Cyrus', accession: 539, first: 538, last: 530 },
  { king: 'Cambyses', accession: 530, first: 529, last: 522 },
  { king: 'Bardiya', accession: 522 },
  { king: 'Nebuchadnezzar III', accession: 522 },
  { king: 'Darius I', accession: 522, first: 521, last: 486 },
  { king: 'Nebuchadnezzar IV', accession: 521 },
  { king: 'Xerxes', accession: 486, first: 485, last: 465 },
  { king: 'Artaxerxes I', accession: 465, first: 464, last: 424 },
  { king: 'Darius II', accession: 424, first: 423, last: 405 },
  { king: 'Artaxerxes II', accession: 405, first: 404, last: 359 },
  { king: 'Artaxerxes III', accession: 359, first: 358, last: 338 },
  { king: 'Arses', accession: 338, first: 337, last: 336 },
  { king: 'Darius III', accession: 336, first: 335, last: 331 },
  // Two counts were in use: from his Macedonian accession (year 1 = 336) and from 330.
  { king: 'Alexander the Great', first: 330, last: 323, firstYear: 7, alsoLess: 6 },
  { king: 'Philip Arrhidaeus', first: 323, last: 316 },
  { king: 'Alexander IV', first: 316, last: 312 },
];

export interface RegnalYear {
  readonly king: string;
  /** 0 for the accession year. */
  readonly year: number;
  /** The same year in a second count in use at the time; otherwise null. */
  readonly alsoYear?: number | null;
}

/** The regnal years a Babylonian year (beginning in `bce`) was dated by, in order. */
export function tabletYears(bce: number): readonly RegnalYear[] {
  const found: RegnalYear[] = [];
  for (const reign of TABLET_REIGNS) {
    if (bce === reign.accession) found.push({ king: reign.king, year: 0 });
    if (reign.first === undefined || reign.last === undefined) continue;
    if (bce <= reign.first && bce >= reign.last) {
      const year = reign.first - bce + (reign.firstYear ?? 1);
      const alsoYear = reign.alsoLess === undefined ? null : year - reign.alsoLess;
      found.push({ king: reign.king, year, alsoYear });
    }
  }
  return found;
}

/** Ptolemy's royal canon: kings and their years, from Nabonassar (Egyptian years from 747 BCE). */
export const CANON: readonly (readonly [king: string, years: number])[] = [
  ['Nabonassar', 14],
  ['Nadios', 2],
  ['Chinzer and Poros', 5],
  ['Ilulaios', 5],
  ['Mardokempados', 12],
  ['Arkeanos', 5],
  ['first interregnum', 2],
  ['Bilibos', 3],
  ['Aparanadisos', 6],
  ['Rhegebelos', 1],
  ['Mesesimordakos', 4],
  ['second interregnum', 8],
  ['Asaridinos', 13],
  ['Saosdouchinos', 20],
  ['Kineladanos', 22],
  ['Nabopolassaros', 21],
  ['Nabokolassaros', 43],
  ['Illoaroudamos', 2],
  ['Nerigasolassaros', 4],
  ['Nabonadios', 17],
  ['Kyros', 9],
  ['Kambyses', 8],
  ['Dareios I', 36],
  ['Xerxes', 21],
  ['Artaxerxes I', 41],
  ['Dareios II', 19],
  ['Artaxerxes II', 46],
  ['Ochos', 21],
  ['Arogos', 2],
  ['Dareios III', 4],
  ['Alexandros', 8],
];

/** The canon's king and year for an Egyptian year counted from Nabonassar, or null beyond it. */
export function canonYear(nabonassar: number): RegnalYear | null {
  let before = 0;
  for (const [king, years] of CANON) {
    if (nabonassar <= before + years) {
      return nabonassar > before ? { king, year: nabonassar - before } : null;
    }
    before += years;
  }
  return null;
}
