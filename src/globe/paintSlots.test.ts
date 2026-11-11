import { describe, expect, it } from 'vitest';

import { createPaintSlots } from './paintSlots';

describe('places on a painted map', () => {
  it('Given parts added in any order, Then they paint lowest order first', () => {
    const slots = createPaintSlots<string>(() => undefined);
    const dates = slots.add(20);
    const rocks = slots.add(0);
    const ways = slots.add(10);
    dates.show('dates');
    rocks.show('rocks');
    ways.show('ways');
    expect(slots.painters()).toEqual(['rocks', 'ways', 'dates']);
  });

  it('Given a part taken away, Then the rest still paint', () => {
    const slots = createPaintSlots<string>(() => undefined);
    const rocks = slots.add(0);
    slots.add(10).show('ways');
    rocks.show('rocks');
    rocks.show(null);
    expect(slots.painters()).toEqual(['ways']);
  });

  it('Given any part shown or taken away, Then the whole map is painted again', () => {
    let painted = 0;
    const slots = createPaintSlots<string>(() => {
      painted += 1;
    });
    const rocks = slots.add(0);
    expect(painted).toBe(0);
    rocks.show('rocks');
    rocks.show(null);
    expect(painted).toBe(2);
  });
});
