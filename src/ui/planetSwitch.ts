/**
 * How a planet is shown close up (#239): as it looks, or by another light where a mission gives
 * one, Venus's ground by radar first. The same panel as the Sun's channels; what the picture is
 * stays in the body bar's caption below.
 */

import type { PlanetView } from '../globe/planetLook';
import type { PlanetLight } from '../state/viewState';
import { element } from './dom';
import './switches.css';

export interface PlanetSwitch {
  readonly root: HTMLElement;
  /** Show the planet's views with the one picked pressed; none, or one only, hides it. */
  render(views: readonly PlanetView[] | null, picked: string): void;
}

export function createPlanetSwitch(onSelect: (light: PlanetLight) => void): PlanetSwitch {
  const buttons = element('div', {
    class: 'view-switch sun-switch',
    role: 'group',
    'aria-label': 'Light',
  });
  const root = element(
    'div',
    { class: 'sun-panel planet-panel', 'data-testid': 'planet-light', hidden: '' },
    buttons,
  );
  let drawn = '';

  return {
    root,
    render(views, picked) {
      root.hidden = views === null || views.length < 2;
      if (views === null || views.length < 2) return;
      const key = views.map((view) => view.key).join(' ');
      if (key !== drawn) {
        drawn = key;
        buttons.replaceChildren(
          element('span', { class: 'switch-label' }, 'Light'),
          ...views.map((view, i) => {
            const button = element(
              'button',
              { type: 'button', 'aria-pressed': 'false', 'data-view': view.key },
              element('span', { class: 'sun-channel-name' }, view.label),
              element('span', { class: 'sun-channel-detail' }, view.detail),
            );
            button.addEventListener('click', () => {
              // The first is how it looks; the others are named by their light.
              onSelect(i === 0 ? 'look' : (view.key as PlanetLight));
            });
            return button;
          }),
        );
      }
      for (const [i, button] of [...buttons.querySelectorAll('button')].entries()) {
        const pressed =
          picked === button.dataset['view'] || (i === 0 && !views.some((v) => v.key === picked));
        button.setAttribute('aria-pressed', String(pressed));
      }
    },
  };
}
