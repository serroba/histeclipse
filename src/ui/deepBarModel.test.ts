import { describe, expect, it } from 'vitest';

import { anchorMa, MILESTONES } from '../deepTime/milestones';
import {
  barWindow,
  milestoneTicks,
  notesShown,
  sliderUnit,
  stepped,
  stepWords,
} from './deepBarModel';

describe('the slider and the steps', () => {
  it('counts the slider in thousands of years on the ice-age scale, else in millions', () => {
    expect(sliderUnit('ice')).toBe(1000);
    expect(sliderUnit('all')).toBe(1);
    expect(sliderUnit('eons')).toBe(1);
    expect(sliderUnit(undefined)).toBe(1);
  });

  it('steps 5,000 years, 5 million or 50 million, by span, and says so', () => {
    expect(stepped(1, 2.6, 'ice', true)).toBeCloseTo(1.005);
    expect(stepped(100, 540, 'all', true)).toBe(105);
    expect(stepped(1000, 4568, 'eons', false)).toBe(950);
    expect(stepWords('ice')).toBe('5,000 years');
    expect(stepWords('all')).toBe('5 million years');
    expect(stepWords('eons')).toBe('50 million years');
  });

  it('steps no further back than the span reaches, nor past today', () => {
    expect(stepped(538, 540, 'all', true)).toBe(540);
    expect(stepped(3, 540, 'all', false)).toBe(0);
  });
});

describe('milestoneTicks', () => {
  it('places a tick for each milestone within the span, oldest on the left', () => {
    const within = MILESTONES.filter((milestone) => anchorMa(milestone) <= 540);
    const ticks = milestoneTicks(540);
    expect(ticks.map((tick) => tick.title)).toEqual(within.map((milestone) => milestone.title));
    ticks.forEach((tick, index) => {
      const milestone = within[index];
      if (milestone === undefined) throw new Error('a tick for no milestone');
      expect(tick.left).toBeCloseTo((1 - anchorMa(milestone) / 540) * 100);
      expect(tick.left).toBeGreaterThanOrEqual(0);
      expect(tick.left).toBeLessThanOrEqual(100);
    });
  });

  it('leaves out the milestones older than the span', () => {
    expect(milestoneTicks(2.6).length).toBeLessThan(milestoneTicks(4568).length);
  });
});

describe('notesShown', () => {
  const at = { ma: 100, mapsReach: 540, scale: 'all', sketchQuestions: null } as const;

  it('shows no note of a missing map while the maps reach', () => {
    expect(notesShown(at)).toEqual({ uncharted: false, noMap: false, sketch: false, ice: false });
  });

  it('says there is no map beyond them, unless a sketch says what is drawn instead', () => {
    expect(notesShown({ ...at, ma: 800, scale: 'eons' }).noMap).toBe(true);
    expect(notesShown({ ...at, ma: 800, scale: 'eons', sketchQuestions: 0 }).noMap).toBe(true);
    expect(notesShown({ ...at, ma: 800, scale: 'eons', sketchQuestions: 2 })).toMatchObject({
      uncharted: true,
      noMap: false,
      sketch: true,
    });
  });

  it('shows the ice ages’ notes on their scale', () => {
    expect(notesShown({ ...at, ma: 0.02, scale: 'ice' }).ice).toBe(true);
  });
});

describe('the part of a span the bar shows (#1074)', () => {
  it('Given no window, Then the whole span to today', () => {
    expect(barWindow(null, 540, 100)).toEqual({ oldest: 540, youngest: 0 });
  });

  it('Given a window around the moment, Then that window, held to the span', () => {
    expect(barWindow({ oldest: 124, youngest: 76 }, 540, 100)).toEqual({
      oldest: 124,
      youngest: 76,
    });
    expect(barWindow({ oldest: 900, youngest: 76 }, 540, 100)).toEqual({
      oldest: 540,
      youngest: 76,
    });
  });

  it('Given the moment outside the window, Then the whole span, so the moment stays on the bar', () => {
    expect(barWindow({ oldest: 124, youngest: 76 }, 540, 66)).toEqual({ oldest: 540, youngest: 0 });
    expect(barWindow({ oldest: 124, youngest: 76 }, 540, 200)).toEqual({
      oldest: 540,
      youngest: 0,
    });
  });
});

describe('steps and ticks within a part of the span (#1074)', () => {
  it('Given a window ending 76 Ma ago, Then a step later stops there, and ticks fall within it', () => {
    expect(stepped(78, 124, 'all', false, 76)).toBe(76);
    const ticks = milestoneTicks(124, 76);
    for (const { left } of ticks) {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(100);
    }
    expect(ticks.length).toBeLessThan(milestoneTicks(540).length);
  });
});
