/**
 * The layers on, beside Layers (#728): a chip for each, to see what is drawn and take a layer
 * off without opening the catalogue. One whose data does not reach the span shown is outlined,
 * says how far it reaches, and offers to go where it draws; turning layers off never moves time.
 */

import type { ActiveLayer } from '../../state/activeLayers';
import type { Layer, Span } from '../../state/viewState';
import { element } from '../../ui/dom';

export interface ActiveChips {
  readonly root: HTMLElement;
  render(active: readonly ActiveLayer[]): void;
}

export interface ActiveChipActions {
  readonly onRemove: (layer: Layer) => void;
  readonly onGoTo: (span: Span, ma?: number) => void;
}

function chip(active: ActiveLayer, actions: ActiveChipActions): HTMLElement {
  const remove = element(
    'button',
    { type: 'button', class: 'active-remove', 'aria-label': `Turn off ${active.label}` },
    '×',
  );
  remove.addEventListener('click', () => {
    actions.onRemove(active.layer);
  });
  const parts: HTMLElement[] = [element('span', { class: 'active-name' }, active.label)];
  const { goTo } = active;
  if (goTo !== null) {
    const go = element(
      'button',
      { type: 'button', class: 'active-go', title: active.reach },
      `Go to ${goTo.label}`,
    );
    go.addEventListener('click', () => {
      actions.onGoTo(goTo.span, goTo.ma);
    });
    parts.push(go);
  }
  return element(
    'li',
    {
      class: 'active-chip',
      'data-layer': active.layer,
      'data-draws': String(active.draws),
      title: active.draws ? active.label : `${active.label}: not drawn here. ${active.reach}`,
    },
    ...parts,
    remove,
  );
}

export function createActiveChips(actions: ActiveChipActions): ActiveChips {
  const list = element('ul', { class: 'active-list' });
  const root = element(
    'div',
    { class: 'active-layers', role: 'group', 'aria-label': 'Layers on', hidden: '' },
    list,
  );
  let said = '';
  return {
    root,
    render(active) {
      // Rebuilt only when what it says changes: the view changes far more often than the layers.
      const now = JSON.stringify(active);
      if (now === said) return;
      said = now;
      root.hidden = active.length === 0;
      list.replaceChildren(...active.map((each) => chip(each, actions)));
    },
  };
}
