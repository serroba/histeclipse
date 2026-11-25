/**
 * What an extinction took, shown on its clock (#1223): a bar of the life left, falling over the
 * pulses its losses are drawn across to the share a study estimates was lost, its range drawn
 * lighter. The total is the study's; how it falls over time is drawn, and its words say so.
 *
 * Its bar is set each moment the clock shows, never animated between them, so it moves only as
 * the clock does, reduced motion or not.
 */

import { element } from '../../ui/dom';
import { setText } from '../../util/pageWrites';

/** A span of an extinction's clock its losses are drawn falling across, and its share of them. */
export interface LossPulse {
  /** Seconds since the clock's zero. */
  readonly from: number;
  readonly to: number;
  /** Its share of all the losses, 0–1: the pulses' shares add up to 1. */
  readonly share: number;
}

export interface LossGauge {
  /** What was lost, as said before "left": "Marine genera". */
  readonly what: string;
  /** The share lost, lowest and highest estimate, 0–1. */
  readonly lost: readonly [number, number];
  readonly pulses: readonly LossPulse[];
  /** Whose estimate, how it compares with others, and what is drawn, not measured. */
  readonly says: string;
}

/** How far through its losses the extinction is at `seconds`, 0–1. */
export function lossDone(pulses: readonly LossPulse[], seconds: number): number {
  return pulses.reduce((done, { from, to, share }) => {
    const through = to > from ? (seconds - from) / (to - from) : seconds >= from ? 1 : 0;
    return done + share * Math.min(1, Math.max(0, through));
  }, 0);
}

/** "62%" or "60–62%": the share left, lowest to highest, as whole percents. */
export function leftText(lost: readonly [number, number], done: number): string {
  const low = Math.round(100 * (1 - lost[1] * done));
  const high = Math.round(100 * (1 - lost[0] * done));
  return low === high ? `${String(low)}%` : `${String(low)}–${String(high)}%`;
}

export interface LossView {
  readonly root: HTMLElement;
  /** Show the life left at `seconds` since the clock's zero. */
  at(seconds: number): void;
}

/** The gauge for `gauge`, under its clock's words. */
export function lossView(gauge: LossGauge): LossView {
  const says = element('p', { class: 'loss-gauge-says' }, gauge.says);
  const { lost } = gauge;
  const label = element('p', { class: 'loss-gauge-label', 'aria-live': 'off' });
  const sure = element('span', { class: 'loss-gauge-sure' });
  const maybe = element('span', { class: 'loss-gauge-maybe' });
  const bar = element('div', { class: 'loss-gauge-bar', 'aria-hidden': 'true' }, sure, maybe);
  const root = element('div', { class: 'loss-gauge' }, label, bar, says);
  return {
    root,
    at(seconds) {
      const done = lossDone(gauge.pulses, seconds);
      // Surely left: the highest estimate lost; perhaps left too, up to the lowest.
      sure.style.width = `${String(100 * (1 - lost[1] * done))}%`;
      maybe.style.width = `${String(100 * (lost[1] - lost[0]) * done)}%`;
      setText(label, `${gauge.what} left: ${leftText(lost, done)}`);
    },
  };
}
