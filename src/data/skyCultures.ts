/**
 * Other cultures' constellations: Stellarium's sky cultures, copied unchanged into
 * `public/skycultures/` (each under its own licence), and the Hipparcos stars they use
 * (`public/data/hip-stars.json`). The files are read as they are and turned into figures here,
 * in the browser; nothing about them is changed on disk.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';
import type { Sky } from './sky';

export const SKY_CULTURES = [
  'modern',
  'babylonian_mulapin',
  'babylonian_seleucid',
  'egyptian',
  'greek_almagest',
  'chinese',
  'indian',
  'arabic_al-sufi',
] as const;
export type SkyCulture = (typeof SKY_CULTURES)[number];

export interface CultureInfo {
  readonly label: string;
  /** When and where the figures come from, briefly. */
  readonly about: string;
  readonly licence: string;
}

export const CULTURE_INFO: Readonly<Record<SkyCulture, CultureInfo>> = {
  modern: {
    label: 'Modern (IAU)',
    about: 'The 88 constellations astronomers use today.',
    licence: '',
  },
  babylonian_mulapin: {
    label: 'Babylonian (MUL.APIN)',
    about: 'Mesopotamian star list known from tablets of the 7th century BCE, with older roots.',
    licence: 'CC BY-ND 4.0',
  },
  babylonian_seleucid: {
    label: 'Babylonian (Seleucid)',
    about: 'Late Babylonian figures of the Seleucid era, 3rd–1st century BCE.',
    licence: 'CC BY-ND 4.0',
  },
  egyptian: {
    label: 'Egyptian',
    about: 'Ancient Egyptian figures after J. A. Belmonte’s map of the Egyptian firmament.',
    licence: 'GNU GPL v2',
  },
  greek_almagest: {
    label: 'Greek (Almagest)',
    about: 'The 48 constellations of Ptolemy’s Almagest, 2nd century CE.',
    licence: 'CC BY-ND 4.0',
  },
  chinese: {
    label: 'Chinese',
    about: 'Traditional Chinese star officials and the 28 lunar mansions.',
    licence: 'CC BY-SA 4.0',
  },
  indian: {
    label: 'Indian',
    about: 'Vedic and later Indian figures, including the nakshatras.',
    licence: 'CC BY-SA 4.0',
  },
  'arabic_al-sufi': {
    label: 'Arabic (al-Sufi)',
    about: 'Al-Sufi’s Book of Fixed Stars, Persia, 10th century CE.',
    licence: 'CC BY-ND 4.0',
  },
};

// Stellarium's files carry more than we use; read loosely and keep only what we need.
const IndexSchema = v.looseObject({
  constellations: v.array(
    v.looseObject({
      id: v.string(),
      lines: v.optional(v.array(v.array(v.union([v.number(), v.string()]))), []),
      common_name: v.optional(
        v.looseObject({ english: v.optional(v.string()), native: v.optional(v.string()) }),
        {},
      ),
    }),
  ),
});

const finite = v.pipe(v.number(), v.finite());
const HipStarsSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    source: v.string(),
    epoch: v.literal(2000),
    hip: v.array(v.pipe(v.number(), v.integer())),
    hr: v.array(v.nullable(v.pipe(v.number(), v.integer()))),
    ra: v.array(finite),
    dec: v.array(finite),
    pmRa: v.array(finite),
    pmDec: v.array(finite),
    parallax: v.array(v.nullable(finite)),
    vmag: v.array(finite),
  }),
  v.check(
    (stars) =>
      [stars.hr, stars.ra, stars.dec, stars.pmRa, stars.pmDec, stars.parallax, stars.vmag].every(
        (column) => column.length === stars.hip.length,
      ),
    'star columns must have the same length',
  ),
);

export type CultureIndex = v.InferOutput<typeof IndexSchema>;
export type HipStars = v.InferOutput<typeof HipStarsSchema>;

/** A figure ready to draw: its runs of stars as indices into the sky's star columns. */
export interface CultureFigure {
  readonly name: string;
  /** The name in the culture's own language and script, when the file gives one. */
  readonly native: string;
  /** 1 for the best-known figures (all of them, except in the very large Chinese sky). */
  readonly rank: 1 | 2;
  readonly lines: readonly (readonly number[])[];
}

export async function loadCultureIndex(url: string, fetchJson: Fetch): Promise<CultureIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

export async function loadHipStars(url: string, fetchJson: Fetch): Promise<HipStars> {
  return getJson(fetchJson, url, HipStarsSchema);
}

/**
 * The sky's stars with the faint Hipparcos stars the figures need added at the end, and where
 * each Hipparcos star sits in it. Stars also in the Bright Star Catalogue are not added twice.
 */
export function withFigureStars(sky: Sky, hip: HipStars): { sky: Sky; index: Map<number, number> } {
  const byHr = new Map(sky.stars.hr.map((hr, index) => [hr, index]));
  const stars = {
    hr: [...sky.stars.hr],
    ra: [...sky.stars.ra],
    dec: [...sky.stars.dec],
    pmRa: [...sky.stars.pmRa],
    pmDec: [...sky.stars.pmDec],
    parallax: [...sky.stars.parallax],
    radialVelocity: [...sky.stars.radialVelocity],
    vmag: [...sky.stars.vmag],
    bv: [...sky.stars.bv],
  };
  const index = new Map<number, number>();
  hip.hip.forEach((number, row) => {
    const hr = elementAt(hip.hr, row);
    const known = hr === null ? undefined : byHr.get(hr);
    if (known !== undefined) {
      index.set(number, known);
      return;
    }
    index.set(number, stars.hr.length);
    // Not in the Bright Star Catalogue: no HR number, so it is filed as 0.
    stars.hr.push(0);
    stars.ra.push(elementAt(hip.ra, row));
    stars.dec.push(elementAt(hip.dec, row));
    stars.pmRa.push(elementAt(hip.pmRa, row));
    stars.pmDec.push(elementAt(hip.pmDec, row));
    stars.parallax.push(elementAt(hip.parallax, row));
    stars.radialVelocity.push(null);
    stars.vmag.push(elementAt(hip.vmag, row));
    stars.bv.push(null);
  });
  return { sky: { ...sky, stars }, index };
}

/**
 * A culture's figures, with Hipparcos numbers turned into star indices. A run is broken where
 * it reaches something that is not a star we know (a star cluster, a Gaia source).
 */
export function cultureFigures(
  culture: SkyCulture,
  file: CultureIndex,
  index: ReadonlyMap<number, number>,
): CultureFigure[] {
  return file.constellations.map((constellation) => {
    const lines: number[][] = [];
    for (const run of constellation.lines) {
      let current: number[] = [];
      for (const star of run) {
        const found = typeof star === 'number' ? index.get(star) : undefined;
        if (found === undefined) {
          if (current.length > 1) lines.push(current);
          current = [];
        } else {
          current.push(found);
        }
      }
      if (current.length > 1) lines.push(current);
    }
    const native = constellation.common_name.native ?? '';
    return {
      name: constellation.common_name.english ?? constellation.id,
      native,
      // The Chinese sky has over 300 asterisms; the 28 lunar mansions (宿) are its best known.
      rank: culture !== 'chinese' || native.endsWith('宿') ? 1 : 2,
      lines,
    };
  });
}
