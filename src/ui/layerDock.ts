/**
 * The layers' dock in deep time's bar (#1070): the bar's chips and the features', in a row of
 * their own under the moment, packed from the start, in the order given. Named apart from the
 * "Layers on" chips beside Layers.
 *
 * Each button wears its layer's state at the moment shown (#1071), as the chips beside Layers
 * have it (#751): pressed while on, and, while on, whether it draws here, is loading, or failed.
 * Marked by shape as well as colour (a fill, a dashed ring, a pulse), and said in words: to
 * screen readers with its button, and, for a layer on with nothing here, in a line under the dock
 * a phone shows too, with the step its chip offers (#751): going to where its data is, or trying
 * its load again.
 *
 * Only the layers on (#752): the Layers panel is the one place to switch one on, so the dock does
 * not repeat its switches. "Add a layer" at its end opens that panel; a layer turned off here
 * leaves the focus on it rather than on nothing.
 */

import { absentSteps, type ActiveLayer, type GoTo } from '../state/activeLayers';
import { element } from './dom';
import { uiIcon } from './icons';

export type { GoTo };
import './layerDock.css';

/** What the dock draws: the layers on, as the chips beside Layers have them. */
export interface DockView {
  readonly active: readonly ActiveLayer[];
}

export interface LayerDock {
  readonly root: HTMLElement;
  /** The layers whose buttons show (#1072), so the chips beside Layers need not repeat them. */
  shown(): ReadonlySet<string>;
  render(active: readonly ActiveLayer[]): void;
}

/** Whether a button shows: offered here by the bar, and its layer on. */
function shows(button: HTMLElement): boolean {
  return button.hidden === false && !button.hasAttribute('data-off');
}

/** The words for a layer on that does not draw here. */
function notDrawn(active: ActiveLayer): string {
  if (active.coverage === 'loading') return 'Loading.';
  if (active.coverage === 'failed') return 'Could not load.';
  return `Not drawn here: ${active.why ?? active.reach}.`;
}

/** What the dock asks of the page. */
export interface DockHandlers {
  /** Open the Layers panel, given the button that asked so the focus can come back to it. */
  readonly onAddLayer: (opener: HTMLElement) => void;
  /** Go to where a layer's data is (#751). */
  readonly onGoTo: (to: GoTo) => void;
}

/**
 * The line under the dock (#751): each layer on with nothing here, why, and the step its chip
 * offers. Drawn again only when what it says changes, as the bar draws every frame it plays.
 */
function dockNotes(onGoTo: (to: GoTo) => void): {
  readonly root: HTMLElement;
  render(active: readonly ActiveLayer[]): void;
} {
  const root = element('span', { class: 'deep-dock-notes', 'aria-live': 'polite' });
  let noted = '';
  return {
    root,
    render(active) {
      const steps = absentSteps(active, onGoTo);
      const labels = new Map(active.map((each) => [each.layer, each.label]));
      const lines = [...steps].map(([layer, { why, step }]) => ({
        words: `${labels.get(layer) ?? layer}: ${why}`,
        step,
      }));
      const key = lines.map(({ words, step }) => `${words}:${step?.label ?? ''}`).join('|');
      if (key === noted) return;
      noted = key;
      root.replaceChildren(
        ...lines.map(({ words, step }) => {
          const line = element('span', { class: 'deep-dock-why' }, words);
          if (step === null) return line;
          const go = element('button', { type: 'button', class: 'deep-note-go' }, step.label);
          go.addEventListener('click', step.run);
          line.append(' ', go);
          return line;
        }),
      );
    },
  };
}

/** The dock of `buttons`, each carrying its layer as `data-layer`. */
export function layerDock(
  { onAddLayer: onAdd, onGoTo }: DockHandlers,
  ...buttons: readonly HTMLElement[]
): LayerDock {
  const add = element(
    'button',
    { type: 'button', class: 'deep-layer deep-add', 'aria-label': 'Add a layer' },
    uiIcon('layers'),
    element('span', { class: 'icon-label', 'aria-hidden': 'true' }, 'Add'),
  );
  add.addEventListener('click', () => {
    onAdd(add);
  });
  const root = element(
    'span',
    { class: 'deep-dock', role: 'group', 'aria-label': 'The time bar’s layers' },
    ...buttons,
    add,
  );
  const docked = (): Set<string> =>
    new Set(buttons.flatMap((button) => (shows(button) ? [button.dataset['layer'] ?? ''] : [])));
  const notes = dockNotes(onGoTo);
  root.append(notes.root);
  // The button last pressed, so that if it goes (its layer turned off) the focus goes to Add.
  let pressed: HTMLElement | null = null;
  // Caught on the way down, before the button's own handler: the page may draw again within it.
  root.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      pressed = target === add ? null : target;
    },
    { capture: true },
  );
  // A line of words for each, read with its button, its name kept as it is.
  const said = new Map<HTMLElement, HTMLElement>();
  for (const button of buttons) {
    const layer = button.dataset['layer'];
    if (layer === undefined) continue;
    const words = element('span', { class: 'visually-hidden', id: `dock-state-${layer}` });
    root.append(words);
    button.setAttribute('aria-describedby', words.id);
    said.set(button, words);
  }
  return {
    root,
    shown: docked,
    render(active) {
      const on = new Map(active.map((each) => [each.layer as string, each]));
      for (const [button, words] of said) {
        const state = on.get(button.dataset['layer'] ?? '');
        // Off: out of the dock, by a mark of its own, as the chips' `hidden` is the bar's (#752).
        button.toggleAttribute('data-off', state === undefined);
        const label = button.textContent;
        if (state === undefined || state.draws) {
          delete button.dataset['coverage'];
          button.removeAttribute('aria-busy');
          words.textContent = '';
          button.title = label;
          continue;
        }
        button.dataset['coverage'] = state.coverage;
        if (state.coverage === 'loading') button.setAttribute('aria-busy', 'true');
        else button.removeAttribute('aria-busy');
        words.textContent = notDrawn(state);
        button.title = `${label}: ${notDrawn(state)}`;
      }
      const here = docked();
      notes.render(active.filter((each) => here.has(each.layer)));
      if (pressed !== null && !shows(pressed)) add.focus();
      pressed = null;
    },
  };
}
