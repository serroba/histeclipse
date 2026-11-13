/**
 * The plates' chip in deep time's bar (#605): a button that outlines a second reconstruction's
 * continents, and a note with the outline's swatch and what is drawn. Said as data, so the bar
 * draws it as it draws every chip.
 */

import type { DeepChip, DeepChipView } from '../../ui/deepChips';

export const PLATES_CHIP: DeepChip = {
  layer: 'plates',
  label: 'Plates',
  icon: 'plates',
  why: 'plates',
};

/** The chip at the moment shown: offered on every span; `text` is null while the outlines load. */
export function platesChip(on: boolean, text: string | null): DeepChipView {
  return {
    offered: true,
    on,
    note: on ? [{ key: 'plates-swatch' }, ' ', text ?? 'Loading the continent outlines…'] : null,
  };
}
