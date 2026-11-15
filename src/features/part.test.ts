import { describe, expect, it } from 'vitest';

import { lateTimeline } from './part';

describe('the timeline the parts ask of', () => {
  it('Given nothing bound yet, Then nothing travels or plays and the maps reach their default', () => {
    const { timeline } = lateTimeline(540);
    expect([timeline.travelling(), timeline.playing(), timeline.oldest()]).toEqual([
      false,
      false,
      540,
    ]);
  });

  it('Given the years and deep time bound, Then it asks them', () => {
    const late = lateTimeline(540);
    late.bind({
      years: { travelling: () => true },
      deepTime: { playing: () => true, oldest: () => 1800 },
    });
    expect([late.timeline.travelling(), late.timeline.playing(), late.timeline.oldest()]).toEqual([
      true,
      true,
      1800,
    ]);
  });
});
