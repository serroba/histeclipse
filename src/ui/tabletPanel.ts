/**
 * Checking a Babylonian tablet against the sky: VAT 4956, Nebuchadnezzar's year 37, tested
 * against any candidate year, as a dialog (a bottom sheet on phones).
 */

import type { Verdict } from '../tablets/check';
import { civilDateText, computedText, recordedText } from '../tablets/verdictText';
import { element } from './dom';

export interface TabletHandlers {
  /** Check every record against the year beginning in spring of `bce`, Nisannu moved `shift`. */
  check(bce: number, shift: number): Promise<readonly Verdict[]>;
  /** Show the sky of one record. */
  go(verdict: Verdict): void;
}

export interface TabletPanel {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
}

const SHIFTS = [
  ['0', 'where the calendar puts it'],
  ['1', 'a month later'],
  ['-1', 'a month earlier'],
] as const;

export function createTabletPanel(handlers: TabletHandlers): TabletPanel {
  const button = element(
    'button',
    { type: 'button', class: 'famous-open tablet-open', 'aria-haspopup': 'dialog' },
    'Check a tablet',
  );
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const year = element('input', {
    class: 'tablet-year',
    type: 'number',
    inputmode: 'numeric',
    min: '540',
    max: '620',
    value: '568',
    'aria-label': 'Year 37 began in spring of (BCE)',
  });
  const shift = element(
    'select',
    { class: 'tablet-shift', 'aria-label': 'Nisannu begins' },
    ...SHIFTS.map(([value, label]) => element('option', { value }, label)),
  );
  const presets = [568, 588].map((bce) => {
    const preset = element(
      'button',
      { type: 'button', class: 'tablet-preset' },
      `${String(bce)} BCE`,
    );
    preset.addEventListener('click', () => {
      year.value = String(bce);
      shift.value = '0';
      run();
    });
    return preset;
  });
  const summary = element('p', {
    class: 'tablet-summary',
    'data-testid': 'tablet-summary',
    role: 'status',
  });
  const list = element('ul', { class: 'famous-list tablet-list' });
  const dialog = element(
    'dialog',
    { class: 'famous-dialog tablet-dialog', 'aria-labelledby': 'tablet-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'tablet-title' }, 'VAT 4956: Nebuchadnezzar’s year 37'),
      close,
    ),
    element(
      'p',
      { class: 'famous-intro' },
      'An astronomical diary from Babylon (Sachs & Hunger, Astronomical Diaries I, No. −567). Pick the year its year 37 began in, and each record is set beside the sky computed for that date, seen from Babylon. A position fits when its direction is right and, where a distance is given, within a cubit (2.2°); a timing fits within 2 UŠ (8 minutes) or a fifth. The Moon alone repeats every 19 years; the planets tell years apart. A Babylonian day began at sunset, so an evening record of “the 18th” shows on the 17th in the date line, which counts from midnight.',
    ),
    element(
      'div',
      { class: 'tablet-controls' },
      element('label', {}, 'Year 37 began in spring of ', year, ' BCE'),
      element('label', {}, 'Nisannu ', shift),
      element('span', { class: 'tablet-presets' }, ...presets),
    ),
    summary,
    list,
  );

  let asked = 0;
  function run(): void {
    const bce = Number(year.value);
    if (!Number.isInteger(bce)) return;
    const ask = ++asked;
    summary.textContent = 'Computing the sky…';
    list.replaceChildren();
    handlers.check(bce, Number(shift.value)).then(
      (verdicts) => {
        if (ask !== asked) return;
        show(bce, verdicts);
      },
      (error: unknown) => {
        if (ask !== asked) return;
        summary.textContent = error instanceof Error ? error.message : String(error);
      },
    );
  }

  function show(bce: number, verdicts: readonly Verdict[]): void {
    const fitting = verdicts.filter(({ fits }) => fits).length;
    summary.textContent = `${String(fitting)} of ${String(verdicts.length)} records fit ${String(bce)}/${String(bce - 1)} BCE.`;
    list.replaceChildren(
      ...verdicts.map((verdict) => {
        const { observation } = verdict;
        const mark = element(
          'span',
          { class: `tablet-mark ${verdict.fits ? 'fits' : 'misses'}` },
          verdict.fits ? '✓ fits' : '✗ does not fit',
        );
        const when = verdict.date === null ? '' : `${civilDateText(verdict.date)} · `;
        const pick = element(
          'button',
          { type: 'button', class: 'famous-item tablet-item', 'data-record': observation.id },
          element(
            'span',
            { class: 'famous-text' },
            element('span', { class: 'famous-title' }, observation.text),
            element(
              'span',
              { class: 'famous-meta' },
              `${observation.line} · ${when}recorded ${recordedText(verdict)} · computed ${computedText(verdict)} · `,
              mark,
            ),
          ),
        );
        pick.disabled = verdict.date === null || observation.kind === 'leap';
        pick.addEventListener('click', () => {
          dialog.close();
          handlers.go(verdict);
        });
        return element('li', {}, pick);
      }),
    );
  }

  button.addEventListener('click', () => {
    dialog.showModal();
    if (asked === 0) run();
  });
  year.addEventListener('change', run);
  shift.addEventListener('change', run);
  close.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  return { button, dialog };
}
