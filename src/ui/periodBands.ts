/**
 * The chart's units along the deep-time slider: coloured bands, each named where it is wide
 * enough, the one shown marked; a tap jumps to the unit's start.
 *
 * DOM glue, covered by the Playwright suite; the bands are worked out in `deepTime/chart.ts`.
 */

import { bandsFor } from '../deepTime/chart';
import { formatMa } from '../deepTime/periods';
import { element } from './dom';

export interface PeriodBands {
  readonly root: HTMLElement;
  /** Bands for a slider from `oldest` Ma to today, with the one holding `ma` marked. */
  render(oldest: number, ma: number): void;
}

/** The usual symbols for the Phanerozoic's periods, for a band too narrow for its name. */
const SYMBOLS: Readonly<Record<string, string>> = {
  Cambrian: 'Є',
  Ordovician: 'O',
  Silurian: 'S',
  Devonian: 'D',
  Carboniferous: 'C',
  Permian: 'P',
  Triassic: 'T',
  Jurassic: 'J',
  Cretaceous: 'K',
  Paleogene: 'Pg',
  Neogene: 'N',
  Quaternary: 'Q',
};

/** Each band's name if it fits, else its symbol (or first two letters), else its colour only. */
function fit(
  buttons: readonly { readonly button: HTMLButtonElement; readonly name: string }[],
): void {
  for (const { button, name } of buttons) {
    for (const text of [name, SYMBOLS[name] ?? name.slice(0, 2), '']) {
      button.textContent = text;
      if (button.scrollWidth <= button.clientWidth + 1) break;
    }
  }
}

export function createPeriodBands(onMa: (ma: number) => void): PeriodBands {
  const root = element('div', {
    class: 'period-bands',
    role: 'group',
    'aria-label': 'Geological periods',
  });
  let drawnFor = -1;
  let buttons: {
    readonly button: HTMLButtonElement;
    readonly name: string;
    readonly base: number;
    readonly top: number;
  }[] = [];
  // Names are fitted to the bands' widths once laid out, and again when the bar resizes.
  new ResizeObserver(() => {
    fit(buttons);
  }).observe(root);
  return {
    root,
    render(oldest, ma) {
      if (oldest !== drawnFor) {
        drawnFor = oldest;
        buttons = bandsFor(oldest).map(({ unit, left, width }) => {
          const start = Math.min(unit.base, oldest);
          const span = `${formatMa(start)} to ${unit.top === 0 ? 'today' : formatMa(unit.top)}`;
          const button = element(
            'button',
            {
              type: 'button',
              class: 'period-band',
              'aria-label': `${unit.name}, ${span}`,
              title: `${unit.name}: ${span}`,
            },
            unit.name,
          );
          button.style.left = `${String(left * 100)}%`;
          button.style.width = `${String(width * 100)}%`;
          button.style.background = unit.colour;
          button.addEventListener('click', () => {
            onMa(start);
          });
          return { button, name: unit.name, base: unit.base, top: unit.top };
        });
        root.replaceChildren(...buttons.map(({ button }) => button));
        fit(buttons);
      }
      for (const { button, base, top } of buttons) {
        // A base belongs to its own unit, as periodAt has it.
        const here = ma <= base && ma > top;
        if (here) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
    },
  };
}
