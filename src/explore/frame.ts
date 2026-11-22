/**
 * A subject's time (#729): the interval worth seeing it over, at the precision it is known to,
 * and whether the view still shows it. Years are astronomical (0 is 1 BCE), for subjects of the
 * last 11,700 years; deep time is in millions of years before present, oldest first.
 *
 * Fitting brings back the subject's moment and the span that draws it, and fits the bar to its
 * interval (#1078); where the camera looks and what is drawn stay as the reader left them.
 */

import { formatMa } from '../time/format';
import { astronomicalYear, formatYear } from '../time/year';
import type { DeepScale, Span, ViewState } from '../state/viewState';
import { ICE_AGES_MA } from '../state/viewState';
import { fitAxis, YEARS_FIRST } from '../state/timeAxis';
import { deepAxisWindow, targetOf } from '../state/timeZoom';
import { PRESENT_YEAR } from '../time/present';

export type TimeFrame =
  | { readonly kind: 'years'; readonly from: number; readonly to: number }
  | { readonly kind: 'ma'; readonly from: number; readonly to: number };

/** Oldest the 540 Myr span draws: older needs all of Earth's history. */
const PHANEROZOIC_MA = 540;

/** The span that draws a frame: the narrowest that holds its oldest moment. */
export function frameSpan(frame: TimeFrame): Span {
  if (frame.kind === 'years') return 'years';
  const scale: DeepScale =
    frame.from <= ICE_AGES_MA ? 'ice' : frame.from <= PHANEROZOIC_MA ? 'all' : 'eons';
  return scale;
}

/** Whether the view shows a moment inside the frame, on the span that draws it. */
export function showsFrame(state: ViewState, frame: TimeFrame): boolean {
  if (frame.kind === 'years') {
    const year = state.time.date.year;
    return state.ma === null && year >= frame.from && year <= frame.to;
  }
  return (
    state.ma !== null &&
    state.deepScale === frameSpan(frame) &&
    state.ma <= frame.from &&
    state.ma >= frame.to
  );
}

/** The frame in words: "1969 CE – 1972 CE", "315,000 years ago – 40,000 years ago". */
export function frameWords(frame: TimeFrame): string {
  const [from, to] =
    frame.kind === 'years'
      ? [formatYear(astronomicalYear(frame.from)), formatYear(astronomicalYear(frame.to))]
      : [formatMa(frame.from), formatMa(frame.to)];
  return from === to ? from : `${from} – ${to}`;
}

/** What fitting changes in a link: when, on which span, and the bar's window; nothing else. */
const TIMED = ['t', 'cal', 'ma', 'scale', 'mission', 'dw', 'yw'];

/**
 * The bar's window a frame is fitted to (#749, #1078), as a link has it: the frame and a tenth
 * of it more on each side (`fitAxis`), so its ends do not sit on the bar's; a single year gets a
 * decade about it. In deep time, the span that holds that window, and none if it is all of it.
 */
export function frameWindow(frame: TimeFrame, present: number): Record<string, string> {
  if (frame.kind === 'years') {
    const fit = fitAxis({ first: frame.from, last: frame.to }, present);
    const first = Math.max(YEARS_FIRST, fit.first);
    return first <= YEARS_FIRST && fit.last >= present
      ? {}
      : { yw: `${String(first)},${String(fit.last)}` };
  }
  const fit = fitAxis(deepAxisWindow({ oldest: frame.from, youngest: frame.to }, present), present);
  const target = targetOf(fit, fit.last, present);
  if (target.model === 'years')
    return { yw: `${String(target.window.first)},${String(target.window.last)}` };
  const { scale, window } = target;
  return window === null
    ? { scale }
    : { scale, dw: `${String(window.oldest)},${String(window.youngest)}` };
}

/**
 * The link fitting gives: the reader's, with the moment and span of the destination's view
 * (`view`, a link's query) in place of theirs, and the bar fitted to its `frame`.
 */
export function fitQuery(
  view: string,
  current: string,
  frame?: TimeFrame,
  present = PRESENT_YEAR,
): string {
  const params = new URLSearchParams(current);
  const own = new URLSearchParams(view);
  for (const key of TIMED) params.delete(key);
  for (const key of TIMED) {
    const value = own.get(key);
    if (value !== null) params.set(key, value);
  }
  if (frame !== undefined) {
    for (const [key, value] of Object.entries(frameWindow(frame, present))) params.set(key, value);
  }
  return params.toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}
