/**
 * How long life took to come back (#1269): a short list under an extinction's gauge, each row a
 * thing a study measured, how long it took to return, and whose figure it is, quickest first.
 * The studies measure different things, so their times differ by a thousandfold; the list says
 * each as its study does rather than settling on one.
 */

import { element } from '../../ui/dom';

/** One study's recovery: what it measured, how long it took, as it says it, and whose. */
export interface Recovery {
  readonly what: string;
  readonly took: string;
  readonly whose: string;
}

export interface LossRecovery {
  readonly title: string;
  /** Quickest first. */
  readonly rows: readonly Recovery[];
}

/** The list for `recovery`. */
export function recoveryView(recovery: LossRecovery): HTMLElement {
  const rows = recovery.rows.map(({ what, took, whose }) =>
    element(
      'li',
      { class: 'loss-recovery' },
      element('span', { class: 'loss-recovery-what' }, `${what}: `),
      element('span', { class: 'loss-recovery-took' }, took),
      element('span', { class: 'loss-recovery-whose' }, ` (${whose})`),
    ),
  );
  return element(
    'figure',
    { class: 'loss-recoveries' },
    element('figcaption', { class: 'loss-history-title' }, recovery.title),
    element('ul', { class: 'loss-recovery-list' }, ...rows),
  );
}
