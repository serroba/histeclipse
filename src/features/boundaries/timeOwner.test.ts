import { describe, expect, it } from 'vitest';

import { createTimeOwner } from './timeOwner';

describe('who has the moment while the Holocene chapter has the globe (#845)', () => {
  it('Given the story gave the globe its moment, Then that moment is not taken for the reader’s', () => {
    const owner = createTimeOwner();
    owner.gave(0.42);
    expect(owner.movedByReader(0.42)).toBe(false);
    expect(owner.movedByReader(null)).toBe(false);
  });

  it('Given the reader moved the bar, Then it is theirs once, and the chart’s echo of the hold is not followed', () => {
    const owner = createTimeOwner();
    owner.gave(0.42);
    expect(owner.movedByReader(2.1)).toBe(true);
    expect(owner.movedByReader(2.1)).toBe(false);
    owner.held(-798_050);
    expect(owner.follows(-798_050)).toBe(false);
  });

  it('Given the chart then moves of itself, Then it has the moment again', () => {
    const owner = createTimeOwner();
    owner.held(-20_000);
    expect(owner.follows(-19_000)).toBe(true);
    expect(owner.follows(-20_000)).toBe(true);
  });

  it('Given the story lets the globe go, Then no hold is left over', () => {
    const owner = createTimeOwner();
    owner.held(-20_000);
    owner.gave(null);
    expect(owner.follows(-20_000)).toBe(true);
    expect(owner.movedByReader(0.1)).toBe(true);
  });
});
