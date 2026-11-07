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
import { astronomicalYear, formatYear } from '../time/year';
import { element } from './dom';

export interface AxisView {
  /** The slider runs from `oldest` Ma to `youngest` (today, unless it ends a little later). */
  readonly oldest: number;
  readonly youngest?: number;
  /** The moment shown, whose band is marked and bracketed. */
  readonly ma: number;
  /** While playing, the chapter rides above the thumb. */
  readonly playing?: boolean;
}

export interface PeriodBands {
  readonly root: HTMLElement;
  render(view: AxisView): void;
}

/** A round mark between the slider's ends, at `ma`, and what it says. */
export interface Tick {
  readonly ma: number;
  readonly label: string;
}

/** The roundest step (1, 2 or 5 times a power of ten) giving about `count` marks over `range`. */
export function roundStep(range: number, count: number): number {
  const rough = range / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((each) => each * power).find((each) => each >= rough);
  return step ?? 10 * power;
}

/** No closer to an end than this share of the slider, where the end's own name is. */
const END_ROOM = 0.16;

/** Deep time's round marks: in Ma, or ka under a million years. */
export function deepTicks(oldest: number, youngest: number): Tick[] {
  const step = roundStep(oldest - youngest, 5);
  const ticks: Tick[] = [];
  for (let ma = step; ma < oldest; ma += step) {
    const share = (oldest - ma) / (oldest - youngest);
    if (share < END_ROOM || share > 1 - END_ROOM) continue;
    // Rounded to the step, so sums of 0.1 do not show as 0.30000000000000004.
    const value = Number(ma.toPrecision(6));
    ticks.push({
      ma: value,
      label:
        value >= 1
          ? `${value.toLocaleString('en')} Ma`
          : `${Math.round(value * 1000).toLocaleString('en')} ka`,
    });
  }
  return ticks;
}

/**
 * The years' round marks: round historical years (8000 BCE, 6000 BCE… 2000 CE), which have no
 * year 0, between a slider's ends given in Ma before 1950.
 */
export function yearTicks(oldest: number, youngest: number): Tick[] {
  const yearOf = (ma: number): number => 1950 - ma * 1e6;
  const first = yearOf(oldest);
  const last = yearOf(youngest);
  const step = roundStep(last - first, 6);
  const ticks: Tick[] = [];
  for (let count = Math.ceil(first / step); count * step <= last; count += 1) {
    // Counted as historians count: 2000 BCE is astronomical year -1999.
    const historical = count * step;
    if (historical === 0) continue;
    const astronomical = historical < 0 ? historical + 1 : historical;
    const ma = (1950 - astronomical) / 1e6;
    const share = (oldest - ma) / (oldest - youngest);
    if (share < END_ROOM || share > 1 - END_ROOM) continue;
    ticks.push({ ma, label: formatYear(astronomicalYear(astronomical)) });
  }
  return ticks;
}

/** How long a unit from `base` to `top` Ma lasted, in words that suit its length. */
export function lengthText(base: number, top: number): string {
  const ma = base - top;
  if (ma >= 1) return `${Number(ma.toPrecision(3)).toLocaleString('en')} Myr`;
  const years = Number((ma * 1e6).toPrecision(3));
  return `${years.toLocaleString('en')} years`;
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
  /** The round marks between the ends; deep time's, in Ma or ka, by default. */
  marks: (oldest: number, youngest: number) => readonly Tick[] = deepTicks,
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
  // The round marks between the ends, above the line.
  const rounds = element('div', { class: 'period-rounds' });
  // While playing: the chapter over the thumb, its name and how long it lasted.
  const chapter = element('div', {
    class: 'period-chapter',
    'data-testid': 'scale-chapter',
    hidden: '',
  });
  // Laid over the bands, inset as they are, so a share of its width is a share of the slider.
  // Decorative: the bands' names and the slider's value text say the same to a screen reader.
  const overlay = element(
    'div',
    { class: 'period-overlay', 'aria-hidden': 'true' },
    ticks,
    rounds,
    bracket,
    chapter,
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
    render({ oldest, ma, youngest = 0, playing = false }) {
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
        rounds.replaceChildren(
          ...marks(oldest, youngest).map((tick) => {
            const mark = element(
              'span',
              { class: 'period-round' },
              element('span', { class: 'period-round-label' }, tick.label),
            );
            mark.style.left = `${String(((oldest - tick.ma) / (oldest - youngest)) * 100)}%`;
            return mark;
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
      // The chapter rides over the thumb while playing, and pulses as a new one begins.
      chapter.hidden = !playing || current === undefined;
      // Playing, the chapter takes the marks' place above the line.
      root.classList.toggle('is-playing', playing);
      if (playing && current !== undefined) {
        const text = `${current.name} · ${lengthText(current.base, current.top)}`;
        if (chapter.textContent !== text) {
          chapter.textContent = text;
          // A short rise, unless the reader asks for less motion.
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            chapter.animate(
              [
                { opacity: 0.3, transform: 'translate(-50%, 6px)' },
                { opacity: 1, transform: 'translate(-50%, 0)' },
              ],
              { duration: 350, easing: 'ease-out' },
            );
          }
        }
        const share = Math.min(1, Math.max(0, (oldest - ma) / (oldest - youngest)));
        chapter.style.left = `${String(share * 100)}%`;
      }
      bracket.hidden = current === undefined;
      if (current !== undefined) {
        bracket.style.left = `${String(current.left * 100)}%`;
        bracket.style.width = `${String(current.width * 100)}%`;
      }
    },
  };
}
