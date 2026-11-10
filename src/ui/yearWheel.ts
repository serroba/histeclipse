/**
 * A wheel for the year beside the year box (#376): two columns, the hundreds and the years
 * within them ("19 | 26"), each scrolled or flicked to a year. It offers only the years of the
 * era or calendar picked beside it, so 9700 BCE is a flick or two away, not 9,700 steps.
 */

import type { YearRange } from '../time/yearRange';
import { element } from './dom';

/** The height of one row (px), as the stylesheet draws it. */
const ROW = 40;
/** Rows shown above and below the picked one. */
const AROUND = 2;
/** How long a column must be still before its year counts (ms). */
const SETTLE_MS = 140;

/** A year as its hundreds and the years within them: 1926 is 19 and 26. */
export function splitYear(year: number): readonly [number, number] {
  return [Math.floor(year / 100), year % 100];
}

/** The year a pair of columns shows, kept within the range. */
export function joinYear(hundreds: number, units: number, range: YearRange): number {
  return Math.min(range.max, Math.max(range.min, hundreds * 100 + units));
}

export interface YearWheel {
  /** The button that opens and closes the wheel. */
  readonly button: HTMLButtonElement;
  /** The wheel itself, to sit above the year. */
  readonly panel: HTMLElement;
  /** Show a year in its range; ignored while a column is being turned. */
  render(year: number, range: YearRange): void;
  close(): void;
}

interface Column {
  readonly root: HTMLElement;
  /** The value at the middle row. */
  value(): number;
  /** Fill with values from `from` to `to` and turn to `value`. */
  set(from: number, to: number, value: number, label: (value: number) => string): void;
  /** Whether it is being turned (touched, or still moving). */
  busy(): boolean;
}

function column(name: string, step: (by: number) => void, settled: () => void): Column {
  const list = element('ol', { class: 'year-wheel-list', 'aria-hidden': 'true' });
  const root = element(
    'div',
    { class: 'year-wheel-column', role: 'spinbutton', tabindex: '0', 'aria-label': name },
    list,
  );
  let from = 0;
  let to = 0;
  let settle = 0;
  let touching = false;
  let quiet = true;
  // Set while the wheel is turned to a year from outside, so that is not taken as a pick.
  let setting = false;

  function value(): number {
    return Math.min(to, from + Math.max(0, Math.round(root.scrollTop / ROW)));
  }
  function announce(): void {
    root.setAttribute('aria-valuenow', String(value()));
    root.setAttribute('aria-valuetext', list.children[value() - from]?.textContent ?? '');
  }
  let moved = false;
  // A column's year counts once it is let go and has stopped moving.
  function finish(): void {
    if (touching || !quiet || !moved) return;
    moved = false;
    announce();
    settled();
  }
  root.addEventListener('scroll', () => {
    if (setting) return;
    quiet = false;
    moved = true;
    window.clearTimeout(settle);
    settle = window.setTimeout(() => {
      quiet = true;
      finish();
    }, SETTLE_MS);
  });
  root.addEventListener('pointerdown', () => {
    touching = true;
  });
  // On a touch screen the browser takes the pointer over once it scrolls: that is a let-go too.
  const release = (): void => {
    touching = false;
    finish();
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('keydown', (event) => {
    const by = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 }[event.key];
    if (by === undefined) return;
    event.preventDefault();
    step(by);
  });
  // A tap on a row turns the wheel to it.
  list.addEventListener('click', (event) => {
    const row = event.target instanceof Element ? event.target.closest('li') : null;
    const index = row === null ? -1 : Array.prototype.indexOf.call(list.children, row);
    if (index >= 0) root.scrollTo({ top: index * ROW, behavior: 'smooth' });
  });

  return {
    root,
    value,
    busy: () => touching || !quiet,
    set(start, end, picked, label) {
      if (start !== from || end !== to || list.children.length === 0) {
        from = start;
        to = end;
        const rows: HTMLElement[] = [];
        for (let at = start; at <= end; at++) rows.push(element('li', {}, label(at)));
        list.replaceChildren(...rows);
        root.setAttribute('aria-valuemin', String(start));
        root.setAttribute('aria-valuemax', String(end));
      }
      const top = (picked - start) * ROW;
      if (Math.abs(root.scrollTop - top) > 1) {
        setting = true;
        root.scrollTop = top;
        // The scroll event for it comes after this frame.
        requestAnimationFrame(() => {
          setting = false;
        });
      }
      announce();
    },
  };
}

export function createYearWheel(onYear: (year: number) => void): YearWheel {
  let range: YearRange = { min: 1, max: 1 };
  let shown = 1;

  function pick(year: number): void {
    const kept = Math.min(range.max, Math.max(range.min, year));
    if (kept === shown) return;
    shown = kept;
    fill();
    onYear(kept);
  }
  function fromColumns(): void {
    pick(joinYear(hundreds.value(), units.value(), range));
  }

  const hundreds = column(
    'Hundreds of years',
    (by) => {
      pick(shown + by * 100);
    },
    fromColumns,
  );
  const units = column(
    'Years',
    (by) => {
      pick(shown + by);
    },
    fromColumns,
  );

  function fill(): void {
    const [high, low] = splitYear(shown);
    const [minHigh] = splitYear(range.min);
    const [maxHigh] = splitYear(range.max);
    hundreds.set(minHigh, maxHigh, high, (value) => (value === 0 ? '·' : String(value)));
    // Within the first and last hundreds, only the years in range.
    const lowest = high === minHigh ? range.min % 100 : 0;
    const highest = high === maxHigh ? range.max % 100 : 99;
    units.set(lowest, highest, low, (value) =>
      high === 0 ? String(value) : String(value).padStart(2, '0'),
    );
  }

  const panel = element(
    'div',
    { class: 'year-wheel', id: 'year-wheel', role: 'group', 'aria-label': 'Turn to a year' },
    hundreds.root,
    units.root,
    element('div', { class: 'year-wheel-band', 'aria-hidden': 'true' }),
  );
  panel.style.setProperty('--row', `${String(ROW)}px`);
  panel.style.setProperty('--around', String(AROUND));
  panel.hidden = true;

  const button = element(
    'button',
    {
      type: 'button',
      class: 'year-wheel-button',
      'aria-label': 'Turn to a year',
      'aria-expanded': 'false',
      'aria-controls': 'year-wheel',
      title: 'Turn to a year',
    },
    '⇅',
  );

  let isOpen = false;
  function setOpen(open: boolean): void {
    isOpen = open;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      fill();
      units.root.focus({ preventScroll: true });
    }
  }
  button.addEventListener('click', () => {
    setOpen(!isOpen);
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setOpen(false);
    button.focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!isOpen || !(event.target instanceof Node)) return;
    if (!panel.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });

  return {
    button,
    panel,
    render(year, next) {
      range = next;
      if (hundreds.busy() || units.busy()) return;
      shown = Math.min(range.max, Math.max(range.min, year));
      if (isOpen) fill();
    },
    close() {
      setOpen(false);
    },
  };
}
