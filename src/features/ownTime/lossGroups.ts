/**
 * Who an extinction took (#1269): a short list under its gauge of groups readers know, each
 * with the share of its genera lost and how many it had, those never found again marked as
 * the last of them. Its words say whose counts and how they are made.
 */

import { element } from '../../ui/dom';

/** A group, the share of its genera lost, 0–1, of how many, and whether none were found after. */
export interface GroupLoss {
  readonly name: string;
  readonly lost: number;
  readonly genera: number;
  readonly last: boolean;
}

export interface LossGroups {
  /** What the list counts: "Genera lost in the Changhsingian, by group". */
  readonly title: string;
  /** The groups, most lost first. */
  readonly groups: readonly GroupLoss[];
}

/** "Trilobites: 100% of 6 genera, the last of them". */
export function groupText({ name, lost, genera, last }: GroupLoss): string {
  const share = `${String(Math.round(100 * lost))}% of ${String(genera)} genera`;
  return `${name}: ${share}${last ? ', the last of them' : ''}`;
}

/** The list for `losses`. */
export function groupsView(losses: LossGroups): HTMLElement {
  const rows = losses.groups.map((group) => {
    const bar = element('span', { class: 'loss-group-bar', 'aria-hidden': 'true' });
    bar.style.width = `${String(100 * group.lost)}%`;
    return element(
      'li',
      { class: group.last ? 'loss-group loss-group-last' : 'loss-group' },
      element('span', { class: 'loss-group-text' }, groupText(group)),
      element('span', { class: 'loss-group-track', 'aria-hidden': 'true' }, bar),
    );
  });
  return element(
    'figure',
    { class: 'loss-groups' },
    element('figcaption', { class: 'loss-history-title' }, losses.title),
    element('ul', { class: 'loss-group-list' }, ...rows),
  );
}
