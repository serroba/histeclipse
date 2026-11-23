/**
 * The plates' chip in deep time's bar (#605): a button that outlines a second reconstruction's
 * continents, and a note with the outline's swatch and what is drawn, and, while its plate
 * boundaries are drawn, a key to their kinds (#1160). Said as data, so the bar draws it as it
 * draws every chip.
 */

import type { DeepChip, DeepChipView, DeepNoteBlock } from '../../ui/deepChips';

/** The chip as deep time's bar offers it; the feature gives it its layer. */
export const PLATES_CHIP: Omit<DeepChip, 'layer'> = {
  label: 'Plates',
  why: 'plates',
};

/** The plate boundaries' kinds, each with its swatch, as their colours on the map say. */
const BOUNDARY_KEY: DeepNoteBlock = {
  list: (
    [
      ['ridge', 'Ridges and rifts: plates part'],
      ['subduction', 'Subduction zones: one sinks under another'],
      ['transform', 'Transforms: plates slide past'],
      ['other', 'Other boundaries'],
    ] as const
  ).map(([kind, words]) => ({
    class: 'boundary-key',
    parts: [{ key: `boundary-swatch is-${kind}` }, ' ', words],
  })),
};

/**
 * The chip at the moment shown: offered on every span; `text` is null while the outlines load;
 * with the boundaries' key while they are drawn.
 */
export function platesChip(on: boolean, text: string | null, boundaries = false): DeepChipView {
  if (!on) return { offered: true, on, note: null };
  const said: DeepNoteBlock[] = [
    { key: 'plates-swatch' },
    ' ',
    text ?? 'Loading the continent outlines…',
  ];
  return { offered: true, on, note: boundaries ? [...said, BOUNDARY_KEY] : said };
}
