/**
 * One-click views: orbit the body in focus, stand on Earth facing the Moon or the reverse, or
 * stand on the ground and look at the sky.
 */

import type { Mode, Viewpoint } from '../state/viewState';
import { element } from './dom';

export type ViewChoice = Viewpoint | 'sky';

export interface ViewSwitch {
  readonly root: HTMLElement;
  render(mode: Mode, viewpoint: Viewpoint, moonReady: boolean): void;
}

const LABELS: readonly (readonly [ViewChoice, string])[] = [
  ['free', 'Orbit'],
  ['moon-from-earth', 'Moon from Earth'],
  ['earth-from-moon', 'Earth from Moon'],
  ['sky', 'Sky'],
];

export function createViewSwitch(onSelect: (choice: ViewChoice) => void): ViewSwitch {
  const buttons = LABELS.map(([choice, label]) => {
    const button = element('button', { type: 'button', 'aria-pressed': 'false' }, label);
    button.addEventListener('click', () => {
      onSelect(choice);
    });
    return [choice, button] as const;
  });
  const root = element(
    'div',
    { class: 'view-switch', role: 'group', 'aria-label': 'Viewpoint' },
    ...buttons.map(([, button]) => button),
  );
  return {
    root,
    render(mode, viewpoint, moonReady) {
      for (const [option, button] of buttons) {
        const pressed = mode === 'sky' ? option === 'sky' : option === viewpoint;
        button.setAttribute('aria-pressed', String(pressed));
        // The attached views need the Moon's position, which loads just after the page.
        button.disabled = option !== 'free' && option !== 'sky' && !moonReady;
      }
    },
  };
}
