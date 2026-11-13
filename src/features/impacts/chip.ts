/**
 * The impacts' chip in deep time's bar (#605): a button that turns the layer on, and a note that
 * says what is drawn, with the choice of each impact around its time or every one that had
 * struck by then. Said as data (`DeepNoteBlock`), so the bar draws it as it draws every chip.
 */

import { IMPACTS_MODES, type ImpactsMode } from '../../data/impacts';
import type { DeepScale } from '../../state/viewState';
import type { DeepChip, DeepChipView, DeepNoteBlock } from '../../ui/deepChips';

export const IMPACTS_CHIP: DeepChip = {
  layer: 'impacts',
  label: 'Impacts',
  icon: 'impacts',
  why: 'impacts',
  whyLabel: 'Impact craters',
};

/** How the layer stands: off, or on with what to say (null while the craters load). */
export type ImpactsView =
  | { readonly on: false }
  | { readonly on: true; readonly text: string | null; readonly mode: ImpactsMode };

const MODE_LABELS: Readonly<Record<ImpactsMode, string>> = {
  around: 'each around its time',
  struck: 'all that had struck by then',
};

/**
 * The chip at the moment shown. Impacts are placed on the elevation maps' reconstruction, so
 * the chip is not offered on the span before them; `pick` is told a mode chosen.
 */
export function impactsChip(
  view: ImpactsView,
  scale: DeepScale,
  pick: (mode: ImpactsMode) => void,
): DeepChipView {
  return { offered: scale !== 'eons', on: view.on, note: view.on ? impactsNote(view, pick) : null };
}

function impactsNote(
  view: { readonly text: string | null; readonly mode: ImpactsMode },
  pick: (mode: ImpactsMode) => void,
): DeepNoteBlock[] {
  return [
    {
      choose: {
        label: 'Show impacts',
        name: 'Show impacts',
        options: IMPACTS_MODES.map((mode) => ({ value: mode, label: MODE_LABELS[mode] })),
        value: view.mode,
        pick: (value) => {
          const mode = IMPACTS_MODES.find((each) => each === value);
          if (mode !== undefined) pick(mode);
        },
      },
    },
    ' ',
    view.text ?? 'Impacts: loading…',
    ' Source: ',
    { text: 'the Impact Earth Database', href: 'https://impact.uwo.ca' },
    '; places then from the PALEOMAP model by the ',
    { text: 'GPlates Web Service', href: 'https://gws.gplates.org' },
    '.',
  ];
}
