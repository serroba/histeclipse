import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { anchorMa, MILESTONES, milestonesNear, nextMilestone, STANDING_MA } from './milestones';

describe('MILESTONES', () => {
  it('runs oldest first, each with sound estimates', () => {
    const anchors = MILESTONES.map(anchorMa);
    expect(anchors).toEqual([...anchors].sort((a, b) => b - a));
    expect(new Set(MILESTONES.map(({ id }) => id)).size).toBe(MILESTONES.length);
    for (const { estimates } of MILESTONES) {
      expect(estimates.length).toBeGreaterThan(0);
      for (const { min, max, url } of estimates) {
        expect(min).toBeLessThanOrEqual(max);
        expect(min).toBeGreaterThanOrEqual(0);
        expect(max).toBeLessThanOrEqual(540);
        expect(url).toMatch(/^https:\/\//);
      }
    }
  });

  it('anchors a milestone at its oldest estimate', () => {
    const india = MILESTONES.find(({ id }) => id === 'india-asia-collision');
    expect(india && anchorMa(india)).toBe(60);
  });
});

describe('milestonesNear', () => {
  it('finds what overlaps the moment, give or take', () => {
    expect(milestonesNear(252, 1).map(({ id }) => id)).toContain('end-permian-extinction');
    expect(milestonesNear(51, 1).map(({ id }) => id)).toEqual(['india-asia-collision']);
    // Every camp counts: the late view of the collision is near 34 Ma too.
    expect(milestonesNear(34, 0.5).map(({ id }) => id)).toEqual([
      'india-asia-collision',
      'antarctic-ice',
    ]);
    expect(milestonesNear(100, 2)).toEqual([]);
  });
});

describe('nextMilestone', () => {
  it('steps towards the present and the past', () => {
    expect(nextMilestone(250, -1)?.id).toBe('first-dinosaurs');
    expect(nextMilestone(250, 1)?.id).toBe('end-permian-extinction');
    expect(nextMilestone(540, 1)).toBeNull();
    expect(nextMilestone(0.1, -1)).toBeNull();
    // Standing on one, the next is the one after.
    const permian = nextMilestone(250, 1);
    expect(permian && nextMilestone(anchorMa(permian), -1)?.id).toBe('first-dinosaurs');
  });

  it('moves on from a milestone a link rounded to a tenth', () => {
    // The end-Permian anchor, 251.978 Ma, written as 252.0.
    expect(nextMilestone(252, -1)?.id).toBe('first-dinosaurs');
    for (const milestone of MILESTONES) {
      const shown = Math.round(anchorMa(milestone) * 10) / 10;
      expect(nextMilestone(shown, -1)?.id).not.toBe(milestone.id);
      expect(nextMilestone(shown, 1)?.id).not.toBe(milestone.id);
    }
  });

  it('keeps milestones further apart than the view can tell', () => {
    const anchors = MILESTONES.map(anchorMa);
    for (let index = 1; index < anchors.length; index += 1) {
      expect((anchors[index - 1] ?? 0) - (anchors[index] ?? 0)).toBeGreaterThan(2 * STANDING_MA);
    }
  });

  it('always moves the way it is asked', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 540, noNaN: true }), (ma) => {
        const younger = nextMilestone(ma, -1);
        const older = nextMilestone(ma, 1);
        if (younger !== null) expect(anchorMa(younger)).toBeLessThan(ma);
        if (older !== null) expect(anchorMa(older)).toBeGreaterThan(ma);
      }),
    );
  });
});
