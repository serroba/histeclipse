/**
 * The features' notes in the deep-time bar (#380): for each, a note in the bar's details with its
 * book, shown while its layer is on. Made once, from the features; shown from what each feature
 * says of the moment. Their layers are switched where every layer is: Layers and its chips (#1137).
 */

import type { WhyId } from '../sources/registry';
import type { Layer } from '../state/viewState';
import { element } from './dom';
import './deepChips.css';

/** A feature's chip, as the features declare it. */
export interface DeepChip {
  readonly layer: Layer;
  readonly label: string;
  readonly why: WhyId;
  /** What the note's book is labelled, where it differs from the button's `label`. */
  readonly whyLabel?: string;
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
  /** A button in the note (#948), such as a jump to where the layer has something. */
  | { readonly text: string; readonly run: () => void }
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
): DeepChips {
  const pickers = new Map<string, Picker>();

  function part(layer: Layer, shown: DeepNotePart): Node | string {
    if (typeof shown === 'string') return shown;
    if ('key' in shown) return element('span', { class: shown.key, 'aria-hidden': 'true' });
    if ('href' in shown) return element('a', { href: shown.href }, shown.text);
    if ('testId' in shown) return element('span', { 'data-testid': shown.testId }, shown.text);
    if ('run' in shown) return actionButton(shown.text, shown.run);
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
    const note = element('div', {
      class: `deep-note ${chip.layer}-note`,
      hidden: '',
      'data-testid': `${chip.layer}-note`,
    });
    return { chip, note, book: why(chip.why, chip.whyLabel ?? chip.label) };
  });
  return {
    notes: parts.map(({ note }) => note),
    render(views) {
      for (const { chip, note, book } of parts) {
        const shown = views.get(chip.layer);
        note.hidden = shown?.on !== true || shown.note === null;
        if (shown?.on === true && shown.note !== null)
          note.replaceChildren(book, ' ', ...shown.note.map((each) => block(chip.layer, each)));
      }
    },
  };
}

/** A note's action: a button that runs `run`. */
function actionButton(text: string, run: () => void): HTMLButtonElement {
  const go = element('button', { type: 'button', class: 'deep-note-go' }, text);
  go.addEventListener('click', run);
  return go;
}
