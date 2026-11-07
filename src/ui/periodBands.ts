/**
 * The chart's units along a time slider, as chapters: coloured bands, each named where it is
 * wide enough, the one shown marked and bracketed; thin lines from each boundary up to the
 * slider's line; the span's two ends named beneath; and, over the slider, the moment and
 * chapter under the pointer. A tap on a band jumps to the unit's start.
 *
 * DOM glue, covered by the Playwright suite; the bands are worked out in `deepTime/chart.ts`,
 * and what a point on the slider reads in `readingAt`.
 */

import { bandsFor, type Band } from '../deepTime/chart';
import { formatMa } from '../deepTime/periods';
import { element } from './dom';

export interface PeriodBands {
  readonly root: HTMLElement;
  /**
   * Bands for a slider from `oldest` Ma to `youngest` (today, unless the slider ends a little
   * earlier or later), with the one holding `ma` marked.
   */
  render(oldest: number, ma: number, youngest?: number): void;
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

/**
 * Whether `ma` lies in a unit from `base` to `top`: a base belongs to its own unit, as periodAt
 * has it, and a unit that runs to the present holds the years since 1950 too.
 */
function within(ma: number, base: number, top: number): boolean {
  return ma <= base && (ma > top || top === 0);
}

/** Default wording: deep time's own, "250 million years ago" down to "Today". */
function deepWords(ma: number): string {
  return formatMa(ma);
}

/**
 * What a point `fraction` of the way along a slider from `oldest` to `youngest` Ma reads: the
 * moment there, in `words`, and the band it falls in.
 */
export function readingAt(
  fraction: number,
  oldest: number,
  youngest: number,
  bands: readonly Band[],
  words: (ma: number) => string = deepWords,
): string {
  const share = Math.min(1, Math.max(0, fraction));
  const ma = oldest - share * (oldest - youngest);
  // A base belongs to its own unit, as periodAt has it.
  const band = bands.find(({ unit }) => within(ma, Math.min(unit.base, oldest), unit.top));
  const moment = words(ma);
  return band === undefined ? moment : `${moment} · ${band.unit.name}`;
}

export function createPeriodBands(
  onMa: (ma: number) => void,
  /** How a moment is said at the ends and under the pointer; deep time's wording by default. */
  words: (ma: number) => string = deepWords,
): PeriodBands {
  const row = element('div', {
    class: 'period-bands',
    role: 'group',
    'aria-label': 'Geological periods',
  });
  // Chapter lines from each boundary up to the slider's line, and a bracket over the one shown.
  const ticks = element('div', { class: 'period-ticks' });
  const bracket = element('div', { class: 'period-bracket', hidden: '' });
  const start = element('span', { 'data-testid': 'scale-start' });
  const end = element('span', { 'data-testid': 'scale-end' });
  const scale = element('div', { class: 'period-scale' }, start, end);
  const reading = element('div', {
    class: 'period-reading',
    'data-testid': 'scale-reading',
    hidden: '',
  });
  // Laid over the bands, inset as they are, so a share of its width is a share of the slider.
  // Decorative: the bands' names and the slider's value text say the same to a screen reader.
  const overlay = element(
    'div',
    { class: 'period-overlay', 'aria-hidden': 'true' },
    ticks,
    bracket,
    reading,
  );
  const root = element('div', { class: 'period-axis' }, overlay, row, scale);

  let drawnFor = '';
  let span = { oldest: 1, youngest: 0 };
  let bands: readonly Band[] = [];
  let buttons: {
    readonly button: HTMLButtonElement;
    readonly name: string;
    readonly base: number;
    readonly top: number;
    readonly left: number;
    readonly width: number;
  }[] = [];
  // Names are fitted to the bands' widths once laid out, and again when the bar resizes.
  new ResizeObserver(() => {
    fit(buttons);
  }).observe(row);

  // Under the pointer anywhere over the slider and its bands: the moment and its chapter, on a
  // hairline. Listened for on the lane around the bands, once they are in it.
  let listening = false;
  function listen(): void {
    const lane = root.parentElement;
    if (listening || lane === null) return;
    listening = true;
    const show = (event: PointerEvent): void => {
      const box = row.getBoundingClientRect();
      if (box.width === 0) return;
      const fraction = (event.clientX - box.left) / box.width;
      if (fraction < 0 || fraction > 1) {
        reading.hidden = true;
        return;
      }
      reading.textContent = readingAt(fraction, span.oldest, span.youngest, bands, words);
      reading.style.left = `${String(fraction * 100)}%`;
      reading.hidden = false;
    };
    lane.addEventListener('pointermove', show);
    lane.addEventListener('pointerdown', show);
    lane.addEventListener('pointerleave', () => {
      reading.hidden = true;
    });
    // A finger lifted: the reading stays a moment, then goes.
    lane.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'mouse') {
        window.setTimeout(() => {
          reading.hidden = true;
        }, 1200);
      }
    });
  }

  return {
    root,
    render(oldest, ma, youngest = 0) {
      listen();
      const key = `${String(oldest)}:${String(youngest)}`;
      if (key !== drawnFor) {
        drawnFor = key;
        span = { oldest, youngest };
        bands = bandsFor(oldest);
        buttons = bands.map(({ unit, left, width }) => {
          const from = Math.min(unit.base, oldest);
          const text = `${formatMa(from)} to ${unit.top === 0 ? 'today' : formatMa(unit.top)}`;
          const button = element(
            'button',
            {
              type: 'button',
              class: 'period-band',
              'aria-label': `${unit.name}, ${text}`,
              title: `${unit.name}: ${text}`,
            },
            unit.name,
          );
          button.style.left = `${String(left * 100)}%`;
          button.style.width = `${String(width * 100)}%`;
          button.style.background = unit.colour;
          button.addEventListener('click', () => {
            onMa(from);
          });
          return { button, name: unit.name, base: unit.base, top: unit.top, left, width };
        });
        row.replaceChildren(...buttons.map(({ button }) => button));
        // A line at each boundary between two chapters (not at the span's two ends).
        ticks.replaceChildren(
          ...buttons.slice(1).map(({ left }) => {
            const tick = element('span', { class: 'period-tick' });
            tick.style.left = `${String(left * 100)}%`;
            return tick;
          }),
        );
        start.textContent = words(oldest);
        end.textContent = words(youngest);
        fit(buttons);
      }
      let current: (typeof buttons)[number] | undefined;
      for (const entry of buttons) {
        const here = within(ma, entry.base, entry.top);
        if (here) {
          entry.button.setAttribute('aria-current', 'true');
          current = entry;
        } else entry.button.removeAttribute('aria-current');
      }
      bracket.hidden = current === undefined;
      if (current !== undefined) {
        bracket.style.left = `${String(current.left * 100)}%`;
        bracket.style.width = `${String(current.width * 100)}%`;
      }
    },
  };
}
