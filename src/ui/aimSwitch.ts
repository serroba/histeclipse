/** One click to turn the sky view toward the Sun or the Moon. */

import { element } from './dom';

export type AimTarget = 'sun' | 'moon';

export interface AimSwitch {
  readonly root: HTMLElement;
  render(visible: boolean, moonReady: boolean): void;
}

const LABELS: readonly (readonly [AimTarget, string])[] = [
  ['sun', 'Sun'],
  ['moon', 'Moon'],
];

export function createAimSwitch(onAim: (target: AimTarget) => void): AimSwitch {
  const buttons = LABELS.map(([target, label]) => {
    const button = element('button', { type: 'button' }, label);
    button.addEventListener('click', () => {
      onAim(target);
    });
    return [target, button] as const;
  });
  const root = element(
    'div',
    { class: 'view-switch aim-switch', role: 'group', 'aria-label': 'Look at' },
    element('span', { class: 'switch-label' }, 'Look at'),
    ...buttons.map(([, button]) => button),
  );
  return {
    root,
    render(visible, moonReady) {
      root.hidden = !visible;
      for (const [target, button] of buttons) button.disabled = target === 'moon' && !moonReady;
    },
  };
}
