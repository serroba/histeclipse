/**
 * The layers on, beside Layers (#728): a chip for each, to see what is drawn and take a layer
 * off without opening the catalogue. One with no data at the moment shown (#751) is outlined,
 * says why in words a phone shows ("none in 1995 CE", "on Ice ages"), not only in a tooltip, and
 * offers to go where its data is; turning layers off never moves time.
 */

import type { ActiveLayer, GoTo } from '../../state/activeLayers';
import type { Layer } from '../../state/viewState';
import { element } from '../../ui/dom';

export interface ActiveChips {
  readonly root: HTMLElement;
  render(active: readonly ActiveLayer[]): void;
}

export interface ActiveChipActions {
  readonly onRemove: (layer: Layer) => void;
  readonly onGoTo: (goTo: GoTo) => void;
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
  if (active.why !== null) parts.push(element('span', { class: 'active-why' }, active.why));
  const { goTo } = active;
  if (goTo !== null) {
    const go = element(
      'button',
      {
        type: 'button',
        class: 'active-go',
        title: active.reach,
        // Named for its layer: the Layers panel's own row offers the same way.
        'aria-label': `${active.label}: go to ${goTo.label}`,
      },
      `Go to ${goTo.label}`,
    );
    go.addEventListener('click', () => {
      actions.onGoTo(goTo);
    });
    parts.push(go);
  }
  return element(
    'li',
    {
      class: 'active-chip',
      'data-layer': active.layer,
      'data-draws': String(active.draws),
      'data-coverage': active.coverage,
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
