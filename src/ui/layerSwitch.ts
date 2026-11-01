/**
 * Optional layers on the globe, switched on and off like Windy's: past empires, drawn from
 * Cliopatria, OpenHistoricalMap, or both at once so their differences show.
 */

import { BORDER_SOURCES, type BorderSource } from '../state/viewState';
import { element } from './dom';

export interface LayerSwitch {
  readonly root: HTMLElement;
  render(empires: boolean, visible: boolean, source: BorderSource): void;
}

const SOURCE_LABELS: Readonly<Record<BorderSource, string>> = {
  cliopatria: 'Cliopatria',
  ohm: 'OpenHistoricalMap',
  both: 'Both: compare',
};

export function createLayerSwitch(
  onEmpires: (on: boolean) => void,
  onSource: (source: BorderSource) => void,
): LayerSwitch {
  let on = false;
  const empires = element('button', { type: 'button', 'aria-pressed': 'false' }, 'Empires');
  empires.addEventListener('click', () => {
    onEmpires(!on);
  });
  const source = element(
    'select',
    { class: 'borders-select', 'aria-label': 'Borders from' },
    ...BORDER_SOURCES.map((option) => element('option', { value: option }, SOURCE_LABELS[option])),
  );
  source.addEventListener('change', () => {
    const picked = BORDER_SOURCES.find((option) => option === source.value);
    if (picked !== undefined) onSource(picked);
  });
  const root = element(
    'div',
    { class: 'view-switch layer-switch', role: 'group', 'aria-label': 'Layers' },
    element('span', { class: 'switch-label' }, 'Layers'),
    empires,
    source,
  );
  return {
    root,
    render(next, visible, current) {
      on = next;
      root.hidden = !visible;
      empires.setAttribute('aria-pressed', String(next));
      source.hidden = !next;
      source.value = current;
    },
  };
}
