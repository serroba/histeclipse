import { describe, expect, it } from 'vitest';

import { elementAt, valueAt } from './arrays';

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

describe('valueAt', () => {
  it('reads typed arrays, and refuses to read past their end', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30]);
    expect(valueAt(pixels, 1)).toBe(20);
    expect(() => valueAt(pixels, 3)).toThrow('outside 0..2');
  });
});
