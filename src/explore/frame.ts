/**
 * A subject's time (#729): the interval worth seeing it over, at the precision it is known to,
 * and whether the view still shows it. Years are astronomical (0 is 1 BCE), for subjects of the
 * last 11,700 years; deep time is in millions of years before present, oldest first.
 *
 * Fitting brings back the subject's moment and the span that draws it; where the camera looks
 * and what is drawn stay as the reader left them.
 */

import { formatMa } from '../time/format';
import { astronomicalYear, formatYear } from '../time/year';
import type { DeepScale, Span, ViewState } from '../state/viewState';
import { ICE_AGES_MA } from '../state/viewState';

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

/** What fitting changes in a link: when, and on which span; nothing else. */
const TIMED = ['t', 'cal', 'ma', 'scale', 'mission'];

/**
 * The link fitting gives: the reader's, with the moment and span of the destination's view
 * (`view`, a link's query) in place of theirs.
 */
export function fitQuery(view: string, current: string): string {
  const params = new URLSearchParams(current);
  const own = new URLSearchParams(view);
  for (const key of TIMED) params.delete(key);
  for (const key of TIMED) {
    const value = own.get(key);
    if (value !== null) params.set(key, value);
  }
  return params.toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}
