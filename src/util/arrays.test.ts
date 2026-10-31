import { describe, expect, it } from 'vitest';

import { elementAt } from './arrays';

describe('elementAt', () => {
  it('returns the element at a valid index', () => {
    expect(elementAt(['a', 'b'], 1)).toBe('b');
  });

  it('returns null elements that are really there', () => {
    expect(elementAt([null], 0)).toBeNull();
  });

  it.each([-1, 2, 0.5, Number.NaN])('rejects index %d', (index) => {
    expect(() => elementAt(['a', 'b'], index)).toThrow(RangeError);
  });
});
