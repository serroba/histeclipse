/**
 * The features' chips in the deep-time bar (#380): for each, a button that turns its layer on,
 * and a note under the bar with its book. Made once, from the features; shown from what each
 * feature says of the moment.
 */

import type { WhyId } from '../sources/registry';
import type { Layer } from '../state/viewState';
import { element } from './dom';
import { uiIcon, type UiIcon } from './icons';

/** A feature's chip, as the features declare it. */
export interface DeepChip {
  readonly layer: Layer;
  readonly label: string;
  readonly icon: UiIcon;
  readonly why: WhyId;
}

/**
 * A part of a chip's note, as data so features need no page to say it: plain text, a colour key
 * (a swatch with that class), or a link.
 */
export type DeepNotePart =
  string | { readonly key: string } | { readonly text: string; readonly href: string };

/** A chip at the moment shown: offered at this span or not, its layer on or not, and its note. */
export interface DeepChipView {
  readonly offered: boolean;
  readonly on: boolean;
  /** What the note says after its book; null hides the note. */
  readonly note: readonly DeepNotePart[] | null;
}

export interface DeepChips {
  /** The buttons, for the bar's row of chips. */
  readonly buttons: readonly HTMLElement[];
  /** The notes, for the bar's details. */
  readonly notes: readonly HTMLElement[];
  render(views: ReadonlyMap<Layer, DeepChipView>): void;
}

function render(part: DeepNotePart): Node | string {
  if (typeof part === 'string') return part;
  if ('key' in part) return element('span', { class: part.key, 'aria-hidden': 'true' });
  return element('a', { href: part.href }, part.text);
}

export function createDeepChips(
  chips: readonly DeepChip[],
  why: (id: WhyId, label: string) => HTMLElement,
  onLayer: (layer: Layer, on: boolean) => void,
): DeepChips {
  let current: ReadonlyMap<Layer, DeepChipView> = new Map();
  const parts = chips.map((chip) => {
    const button = element(
      'button',
      {
        type: 'button',
        class: 'deep-layer',
        'aria-pressed': 'false',
        hidden: '',
        title: chip.label,
      },
      uiIcon(chip.icon),
      element('span', { class: 'icon-label' }, chip.label),
    );
    button.addEventListener('click', () => {
      onLayer(chip.layer, !(current.get(chip.layer)?.on ?? false));
    });
    const note = element('p', {
      class: `deep-note ${chip.layer}-note`,
      hidden: '',
      'data-testid': `${chip.layer}-note`,
    });
    return { chip, button, note, book: why(chip.why, chip.label) };
  });
  return {
    buttons: parts.map(({ button }) => button),
    notes: parts.map(({ note }) => note),
    render(views) {
      current = views;
      for (const { chip, button, note, book } of parts) {
        const shown = views.get(chip.layer);
        button.hidden = shown?.offered !== true;
        button.setAttribute('aria-pressed', String(shown?.on === true));
        note.hidden = shown?.on !== true || shown.note === null;
        if (shown?.on === true && shown.note !== null)
          note.replaceChildren(book, ' ', ...shown.note.map(render));
      }
    },
  };
}
