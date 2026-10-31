/** One-click viewpoints: orbit the globe, stand on Earth facing the Moon, or the reverse. */

import type { Viewpoint } from '../state/viewState';
import { element } from './dom';

export interface ViewSwitch {
  readonly root: HTMLElement;
  render(viewpoint: Viewpoint, moonReady: boolean): void;
}

const LABELS: readonly (readonly [Viewpoint, string])[] = [
  ['free', 'Globe'],
  ['moon-from-earth', 'Moon from Earth'],
  ['earth-from-moon', 'Earth from Moon'],
];

export function createViewSwitch(onSelect: (viewpoint: Viewpoint) => void): ViewSwitch {
  const buttons = LABELS.map(([viewpoint, label]) => {
    const button = element('button', { type: 'button', 'aria-pressed': 'false' }, label);
    button.addEventListener('click', () => {
      onSelect(viewpoint);
    });
    return [viewpoint, button] as const;
  });
  const root = element(
    'div',
    { class: 'view-switch', role: 'group', 'aria-label': 'Viewpoint' },
    ...buttons.map(([, button]) => button),
  );
  return {
    root,
    render(viewpoint, moonReady) {
      for (const [option, button] of buttons) {
        button.setAttribute('aria-pressed', String(option === viewpoint));
        // The attached views need the Moon's position, which loads just after the page.
        button.disabled = option !== 'free' && !moonReady;
      }
    },
  };
}
