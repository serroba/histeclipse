/**
 * One-click views: orbit the body in focus, stand on Earth facing the Moon or the reverse, or
 * stand on the ground and look at the sky. Away from Earth and the Moon, the third looks back
 * at Earth from the body in focus: Earth from Jupiter, Earth from the Sun (#245), and Moon from
 * Earth goes (#329).
 */

import { MOON_NAMES } from '../globe/moonLook';
import type { Body, Mode, Viewpoint } from '../state/viewState';
import { element } from './dom';
import { uiIcon, type UiIcon } from './icons';

export type ViewChoice = Viewpoint | 'sky';

export interface ViewSwitch {
  readonly root: HTMLElement;
  render(mode: Mode, viewpoint: Viewpoint, moonReady: boolean, focus?: Body): void;
}

const LABELS: readonly (readonly [ViewChoice, string, UiIcon])[] = [
  ['free', 'Orbit', 'orbit'],
  ['moon-from-earth', 'Moon from Earth', 'moonFromEarth'],
  ['earth-from-moon', 'Earth from Moon', 'earthFromMoon'],
  ['sky', 'Sky', 'sky'],
];

/** How the body in focus is named after "Earth from". */
const FROM: Readonly<Record<Exclude<Body, 'earth' | 'moon'>, string>> = {
  sun: 'the Sun',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  ...MOON_NAMES,
};

/** The "look back at Earth" choice and its words, for the body in focus. */
export function lookBack(focus: Body): readonly [ViewChoice, string] {
  return focus === 'earth' || focus === 'moon'
    ? ['earth-from-moon', 'Earth from Moon']
    : ['earth-from-here', `Earth from ${FROM[focus]}`];
}

export function createViewSwitch(onSelect: (choice: ViewChoice) => void): ViewSwitch {
  const choices = new Map<HTMLButtonElement, ViewChoice>();
  const buttons = LABELS.map(([choice, label, glyph]) => {
    // The icon and the word; on a phone the word is for screen readers and the tooltip.
    const word = element('span', { class: 'icon-label' }, label);
    const button = element(
      'button',
      { type: 'button', 'aria-pressed': 'false', title: label },
      uiIcon(glyph),
      word,
    );
    choices.set(button, choice);
    button.addEventListener('click', () => {
      onSelect(choices.get(button) ?? choice);
    });
    return [button, word] as const;
  });
  const root = element(
    'div',
    { class: 'view-switch viewpoints', role: 'group', 'aria-label': 'Viewpoint' },
    ...buttons.map(([button]) => button),
  );
  const [, , [back, backWord] = []] = buttons;
  return {
    root,
    render(mode, viewpoint, moonReady, focus = 'earth') {
      if (back !== undefined && backWord !== undefined) {
        const [choice, label] = lookBack(focus);
        choices.set(back, choice);
        backWord.textContent = label;
        back.title = label;
      }
      for (const [button] of buttons) {
        const option = choices.get(button);
        const pressed = mode === 'sky' ? option === 'sky' : option === viewpoint;
        button.setAttribute('aria-pressed', String(pressed));
        // From a planet or the Sun, standing on Earth to face the Moon is beside the point.
        button.hidden = option === 'moon-from-earth' && focus !== 'earth' && focus !== 'moon';
        // The attached views need the Moon's position, which loads just after the page.
        button.disabled = option !== 'free' && option !== 'sky' && !moonReady;
      }
    },
  };
}
