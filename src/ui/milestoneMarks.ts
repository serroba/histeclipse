/**
 * The milestones' ticks along deep time's bar: one at each milestone within the part of time the
 * bar shows (#1074), redrawn only when that part changes. Their meaning is in the milestone
 * panel; the ticks are a glance, hidden from screen readers.
 */

import { milestoneTicks } from './deepBarModel';
import { element } from './dom';

export interface MilestoneMarks {
  readonly root: HTMLElement;
  /** Ticks from `oldest` to `youngest` Ma. */
  render(oldest: number, youngest: number): void;
}

export function createMilestoneMarks(): MilestoneMarks {
  const root = element('div', { class: 'deep-marks', 'aria-hidden': 'true' });
  let drawn = '';
  return {
    root,
    render(oldest, youngest) {
      const span = `${String(oldest)}:${String(youngest)}`;
      if (span === drawn) return;
      drawn = span;
      root.replaceChildren(
        ...milestoneTicks(oldest, youngest).map(({ kind, title, left }) => {
          const mark = element('span', { class: `deep-mark milestone-${kind}`, title });
          mark.style.left = `${String(left)}%`;
          return mark;
        }),
      );
    },
  };
}
