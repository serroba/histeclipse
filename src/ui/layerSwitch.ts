/** Optional layers on the globe, switched on and off like Windy's: for now, past empires. */

import { element } from './dom';

export interface LayerSwitch {
  readonly root: HTMLElement;
  render(empires: boolean, visible: boolean): void;
}

export function createLayerSwitch(onEmpires: (on: boolean) => void): LayerSwitch {
  let on = false;
  const empires = element('button', { type: 'button', 'aria-pressed': 'false' }, 'Empires');
  empires.addEventListener('click', () => {
    onEmpires(!on);
  });
  const root = element(
    'div',
    { class: 'view-switch layer-switch', role: 'group', 'aria-label': 'Layers' },
    element('span', { class: 'switch-label' }, 'Layers'),
    empires,
  );
  return {
    root,
    render(next, visible) {
      on = next;
      root.hidden = !visible;
      empires.setAttribute('aria-pressed', String(next));
    },
  };
}
