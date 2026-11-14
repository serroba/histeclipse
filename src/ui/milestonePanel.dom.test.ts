// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { anchorMa, MILESTONES, nextMilestone } from '../deepTime/milestones';
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

  it('steps to the milestone before or after the moment shown', () => {
    // One with milestones on both sides, so both buttons are live.
    const middle = MILESTONES.find(
      (one) =>
        nextMilestone(anchorMa(one), 1, 540) !== null &&
        nextMilestone(anchorMa(one), -1, 540) !== null,
    );
    if (middle === undefined) throw new Error('no milestone between two others');
    const ma = anchorMa(middle);
    const onMa = vi.fn();
    const panel = createMilestonePanel({ onMa });
    panel.render(ma, 540);
    const [earlier, later] = panel.root.querySelectorAll('button');
    earlier?.click();
    later?.click();
    const before = nextMilestone(ma, 1, 540);
    const after = nextMilestone(ma, -1, 540);
    if (before === null || after === null) throw new Error('unreachable');
    expect(onMa.mock.calls).toEqual([[anchorMa(before)], [anchorMa(after)]]);
  });

  it('says where an estimate’s number comes from, when not stated outright', () => {
    const quoted = MILESTONES.find(({ estimates }) =>
      estimates.some(({ basis }) => basis === 'stage'),
    );
    if (quoted === undefined) throw new Error('no milestone dated by a stage');
    const panel = createMilestonePanel({ onMa: () => undefined });
    panel.render(anchorMa(quoted), 540);
    expect(panel.root.textContent).toContain('the source names a geological stage');
  });
});
