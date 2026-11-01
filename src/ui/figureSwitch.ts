/** Which constellation figures the sky view draws: the best-known, all 88, or none. */

import { FIGURES, type Figures } from '../state/viewState';
import { element } from './dom';

export interface FigureSwitch {
  readonly root: HTMLElement;
  render(figures: Figures, visible: boolean, modern?: boolean): void;
}

const LABELS: Readonly<Record<Figures, string>> = {
  famous: 'Famous',
  all: 'All 88',
  none: 'None',
};

export function createFigureSwitch(onSelect: (figures: Figures) => void): FigureSwitch {
  const buttons = FIGURES.map((figures) => {
    const button = element('button', { type: 'button', 'aria-pressed': 'false' }, LABELS[figures]);
    button.addEventListener('click', () => {
      onSelect(figures);
    });
    return [figures, button] as const;
  });
  const root = element(
    'div',
    { class: 'view-switch figure-switch', role: 'group', 'aria-label': 'Constellations' },
    element('span', { class: 'switch-label' }, 'Constellations'),
    ...buttons.map(([, button]) => button),
  );
  return {
    root,
    render(figures, visible, modern = true) {
      root.hidden = !visible;
      for (const [option, button] of buttons) {
        button.setAttribute('aria-pressed', String(option === figures));
        // Only the modern sky has exactly 88.
        if (option === 'all') button.textContent = modern ? LABELS.all : 'All';
      }
    },
  };
}
