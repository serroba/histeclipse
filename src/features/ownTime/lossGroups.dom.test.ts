// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { groupsView, groupText, type LossGroups } from './lossGroups';

const TRILOBITES = { name: 'Trilobites', lost: 1, genera: 6, last: true };
const BIVALVES = { name: 'Bivalves', lost: 0.46, genera: 133, last: false };
const LOSSES: LossGroups = {
  title: 'Genera last found in the Changhsingian, by group',
  groups: [TRILOBITES, BIVALVES],
};

describe('groupText', () => {
  it('says the share lost, of how many genera, and whether it was the last of them', () => {
    expect(groupText(TRILOBITES)).toBe('Trilobites: 100% of 6 genera, the last of them');
    expect(groupText(BIVALVES)).toBe('Bivalves: 46% of 133 genera');
  });
});

describe('groupsView', () => {
  const root = groupsView(LOSSES);
  const rows = [...root.querySelectorAll('li')];

  it('lists each group in words, its bar only drawn', () => {
    expect(root.querySelector('figcaption')?.textContent).toBe(LOSSES.title);
    expect(rows.map((row) => row.querySelector('.loss-group-text')?.textContent)).toEqual([
      'Trilobites: 100% of 6 genera, the last of them',
      'Bivalves: 46% of 133 genera',
    ]);
    expect(rows[0]?.querySelector('.loss-group-track')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws each bar as long as the share lost, the last of a group marked', () => {
    expect(rows[1]?.querySelector<HTMLElement>('.loss-group-bar')?.style.width).toBe('46%');
    expect(rows[0]?.classList.contains('loss-group-last')).toBe(true);
    expect(rows[1]?.classList.contains('loss-group-last')).toBe(false);
  });
});
