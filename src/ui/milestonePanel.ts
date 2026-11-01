/**
 * Milestones in the deep-time bar: buttons to jump to the previous or next one, and a folded
 * panel naming those near the moment shown. Open, it lists every estimate with its age, its
 * evidence and its source, side by side, none preferred; and notes where the camps measure
 * different things.
 */

import { basisNote, formatRange } from '../deepTime/milestoneText';
import { anchorMa, type Milestone, milestonesNear, nextMilestone } from '../deepTime/milestones';
import { element } from './dom';

/** A milestone counts as near the moment shown within this many million years. */
export const NEAR_MA = 2.5;

export interface MilestonePanel {
  readonly root: HTMLElement;
  render(ma: number): void;
}

function card(milestone: Milestone): HTMLElement {
  const estimates = element(
    'ul',
    { class: 'milestone-estimates' },
    ...milestone.estimates.map((estimate) => {
      const note = basisNote(estimate.basis);
      return element(
        'li',
        {},
        element('strong', {}, formatRange(estimate.min, estimate.max)),
        ` ${estimate.label}. `,
        element(
          'a',
          { href: estimate.url, target: '_blank', rel: 'noopener noreferrer' },
          estimate.source,
        ),
        note === null ? '' : element('span', { class: 'milestone-basis' }, ` (${note})`),
      );
    }),
  );
  return element(
    'article',
    { class: `milestone milestone-${milestone.kind}`, 'data-milestone': milestone.id },
    element('h3', {}, milestone.title),
    element('p', {}, milestone.description),
    milestone.note === undefined ? '' : element('p', { class: 'milestone-note' }, milestone.note),
    estimates,
  );
}

export function createMilestonePanel(handlers: { onMa(ma: number): void }): MilestonePanel {
  const earlier = element(
    'button',
    { type: 'button', class: 'step', 'aria-label': 'Earlier milestone' },
    '«',
  );
  const later = element(
    'button',
    { type: 'button', class: 'step', 'aria-label': 'Later milestone' },
    '»',
  );
  const summary = element('summary', {});
  const cards = element('div', { class: 'milestone-cards' });
  const panel = element(
    'details',
    { class: 'deep-milestones', 'data-testid': 'deep-milestones' },
    summary,
    cards,
  );
  const root = element('div', { class: 'deep-milestone-row' }, earlier, panel, later);

  let ma = 0;
  earlier.addEventListener('click', () => {
    const milestone = nextMilestone(ma, 1);
    if (milestone !== null) handlers.onMa(anchorMa(milestone));
  });
  later.addEventListener('click', () => {
    const milestone = nextMilestone(ma, -1);
    if (milestone !== null) handlers.onMa(anchorMa(milestone));
  });

  return {
    root,
    render(now) {
      ma = now;
      earlier.disabled = nextMilestone(ma, 1) === null;
      later.disabled = nextMilestone(ma, -1) === null;
      const near = milestonesNear(ma, NEAR_MA);
      summary.textContent =
        near.length === 0
          ? 'Milestones: none near here'
          : `Milestones: ${near.map(({ title }) => title).join(' · ')}`;
      panel.classList.toggle('is-empty', near.length === 0);
      cards.replaceChildren(...near.map(card));
    },
  };
}
