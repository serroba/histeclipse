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
 * A choice in a note, such as a model to shade: a picker labelled `label`, named `name` for
 * screen readers. `pick` is called with the value picked.
 */
export interface DeepChoice {
  readonly label: string;
  readonly name: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly value: string;
  pick(value: string): void;
}

/**
 * A part of a chip's note, as data so features need no page to say it: plain text, a colour key
 * (a swatch with that class), a link, words a test can find, or a choice.
 */
export type DeepNotePart =
  | string
  | { readonly key: string }
  | { readonly text: string; readonly href: string }
  | { readonly text: string; readonly testId: string }
  | { readonly choose: DeepChoice };

/** A note's part, or a paragraph or list of parts. */
export type DeepNoteBlock =
  | DeepNotePart
  | { readonly paragraph: readonly DeepNotePart[]; readonly class?: string }
  | {
      readonly list: readonly {
        readonly class: string;
        readonly parts: readonly DeepNotePart[];
      }[];
    };

/** A chip at the moment shown: offered at this span or not, its layer on or not, and its note. */
export interface DeepChipView {
  readonly offered: boolean;
  readonly on: boolean;
  /** What the note says after its book; null hides the note. */
  readonly note: readonly DeepNoteBlock[] | null;
}

export interface DeepChips {
  /** The buttons, for the bar's row of chips. */
  readonly buttons: readonly HTMLElement[];
  /** The notes, for the bar's details. */
  readonly notes: readonly HTMLElement[];
  render(views: ReadonlyMap<Layer, DeepChipView>): void;
}

/** A choice's picker, kept from one moment to the next with the latest `pick` to call. */
interface Picker {
  readonly root: HTMLElement;
  readonly select: HTMLSelectElement;
  choice: DeepChoice;
}

function createPicker(choice: DeepChoice): Picker {
  const select = element(
    'select',
    { class: 'deep-coast', 'aria-label': choice.name },
    ...choice.options.map(({ value, label }) => element('option', { value }, label)),
  );
  const picker: Picker = {
    root: element('label', {}, `${choice.label} `, select),
    select,
    choice,
  };
  select.addEventListener('change', () => {
    picker.choice.pick(select.value);
  });
  return picker;
}

export function createDeepChips(
  chips: readonly DeepChip[],
  why: (id: WhyId, label: string) => HTMLElement,
  onLayer: (layer: Layer, on: boolean) => void,
): DeepChips {
  let current: ReadonlyMap<Layer, DeepChipView> = new Map();
  const pickers = new Map<string, Picker>();

  function part(layer: Layer, shown: DeepNotePart): Node | string {
    if (typeof shown === 'string') return shown;
    if ('key' in shown) return element('span', { class: shown.key, 'aria-hidden': 'true' });
    if ('href' in shown) return element('a', { href: shown.href }, shown.text);
    if ('testId' in shown) return element('span', { 'data-testid': shown.testId }, shown.text);
    const id = `${layer}:${shown.choose.name}`;
    const picker = pickers.get(id) ?? createPicker(shown.choose);
    pickers.set(id, picker);
    picker.choice = shown.choose;
    picker.select.value = shown.choose.value;
    return picker.root;
  }

  function block(layer: Layer, shown: DeepNoteBlock): Node | string {
    if (typeof shown !== 'string' && 'paragraph' in shown) {
      return element(
        'p',
        shown.class === undefined ? {} : { class: shown.class },
        ...shown.paragraph.map((each) => part(layer, each)),
      );
    }
    if (typeof shown !== 'string' && 'list' in shown) {
      return element(
        'ul',
        {},
        ...shown.list.map((item) =>
          element('li', { class: item.class }, ...item.parts.map((each) => part(layer, each))),
        ),
      );
    }
    return part(layer, shown);
  }

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
    const note = element('div', {
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
          note.replaceChildren(book, ' ', ...shown.note.map((each) => block(chip.layer, each)));
      }
    },
  };
}
