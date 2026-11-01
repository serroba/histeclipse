/** Whose constellations the sky view draws, and where that culture's figures come from. */

import { CULTURE_INFO, SKY_CULTURES, type SkyCulture } from '../data/skyCultures';
import { element } from './dom';

export interface CultureSwitch {
  readonly root: HTMLElement;
  render(culture: SkyCulture, visible: boolean): void;
}

export function createCultureSwitch(
  base: string,
  onSelect: (culture: SkyCulture) => void,
): CultureSwitch {
  const select = element(
    'select',
    { class: 'culture-select', 'aria-label': 'Sky culture' },
    ...SKY_CULTURES.map((culture) =>
      element('option', { value: culture }, CULTURE_INFO[culture].label),
    ),
  );
  select.addEventListener('change', () => {
    const picked = SKY_CULTURES.find((culture) => culture === select.value);
    if (picked !== undefined) onSelect(picked);
  });
  const about = element('p', { class: 'culture-caption', 'data-testid': 'culture-caption' });
  // Folded away by default: on a phone the panel must leave room for the sky.
  const details = element(
    'details',
    { class: 'culture-details' },
    element('summary', {}, 'About these figures'),
    about,
  );
  const root = element(
    'div',
    { class: 'culture-switch' },
    element('label', { class: 'switch-label' }, 'Sky of', select),
    details,
  );
  return {
    root,
    render(culture, visible) {
      root.hidden = !visible;
      select.value = culture;
      const info = CULTURE_INFO[culture];
      if (culture === 'modern') {
        about.replaceChildren(info.about);
        return;
      }
      // Credit the culture's authors and licence, as its own description states them.
      about.replaceChildren(
        `${info.about} Figures from Stellarium (`,
        element(
          'a',
          { href: `${base}skycultures/${culture}/description.md` },
          'authors and sources',
        ),
        `), ${info.licence}.`,
      );
    },
  };
}
