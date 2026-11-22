/**
 * The layers' dock in deep time's bar (#1070): the bar's chips and the features', in a row of
 * their own under the moment, packed from the start, in the order given. Named apart from the
 * "Layers on" chips beside Layers.
 *
 * Each button wears its layer's state at the moment shown (#1071), as the chips beside Layers
 * have it (#751): pressed while on, and, while on, whether it draws here, is loading, or failed.
 * Marked by shape as well as colour (a fill, a dashed ring, a pulse), and said in words to screen
 * readers and in the tooltip.
 *
 * Only the layers on (#752): the Layers panel is the one place to switch one on, so the dock does
 * not repeat its switches. "Add a layer" at its end opens that panel; a layer turned off here
 * leaves the focus on it rather than on nothing.
 */

import type { ActiveLayer } from '../state/activeLayers';
import { element } from './dom';
import { uiIcon } from './icons';
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

/**
 * The dock of `buttons`, each carrying its layer as `data-layer`; `onAdd` opens the Layers panel,
 * given the button that asked so the focus can come back to it.
 */
export function layerDock(
  onAdd: (opener: HTMLElement) => void,
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
  // The button last pressed, so that if it goes (its layer turned off) the focus goes to Add.
  let pressed: HTMLElement | null = null;
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    pressed = target === add ? null : target;
  });
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
    shown: () =>
      new Set(buttons.flatMap((button) => (shows(button) ? [button.dataset['layer'] ?? ''] : []))),
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
      if (pressed !== null && !shows(pressed)) add.focus();
      pressed = null;
    },
  };
}
