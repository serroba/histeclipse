// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { anchorMa, MILESTONES } from '../deepTime/milestones';
import { createMilestonePanel } from './milestonePanel';

const [first] = MILESTONES;
if (first === undefined) throw new Error('no milestones');
const at = anchorMa(first);

describe('the milestone panel', () => {
  it('keeps its cards while the same milestones stay near, as deep time plays', () => {
    const panel = createMilestonePanel({ onMa: () => undefined });
    panel.render(at, 540);
    const cards = [...panel.root.querySelectorAll('article')];
    expect(cards.length).toBeGreaterThan(0);
    // A moment later, a hair along: the same milestones, the same elements.
    panel.render(at - 0.001, 540);
    expect([...panel.root.querySelectorAll('article')]).toEqual(cards);
    expect(panel.root.querySelector('article')).toBe(cards[0]);
  });

  it('builds new cards once other milestones are near', () => {
    const panel = createMilestonePanel({ onMa: () => undefined });
    panel.render(at, 540);
    const before = panel.root.querySelector('article');
    // Far from any milestone the panel says so.
    panel.render(-1e6, 540);
    expect(panel.root.querySelectorAll('article')).toHaveLength(0);
    expect(panel.root.querySelector('summary')?.textContent).toBe('Milestones: none near here');
    panel.render(at, 540);
    expect(panel.root.querySelector('article')).not.toBe(before);
  });
});
