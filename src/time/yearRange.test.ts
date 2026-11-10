import { describe, expect, it } from 'vitest';

import { yearRange } from './yearRange';

describe('yearRange', () => {
  it('reaches 9700 BCE back and 3000 CE forward, each era counted from 1', () => {
    expect(yearRange('western', 'BCE')).toEqual({ min: 1, max: 9700 });
    expect(yearRange('western', 'CE')).toEqual({ min: 1, max: 3000 });
  });

  it('gives each other calendar its years from 1 that fall before 3000 CE ends', () => {
    expect(yearRange('hebrew', 'CE')).toEqual({ min: 1, max: 6761 });
    expect(yearRange('islamic', 'CE')).toEqual({ min: 1, max: 2452 });
    expect(yearRange('roman', 'CE')).toEqual({ min: 1, max: 3753 });
    expect(yearRange('egyptian', 'CE').max).toBe(3750);
    expect(yearRange('babylonian', 'CE').max).toBe(3747);
    expect(yearRange('chinese', 'CE').max).toBe(5697);
  });
});
