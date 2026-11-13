import { describe, expect, it } from 'vitest';

import { scrubKey } from './scrubKeys';

describe('the keys on a chart used as a slider', () => {
  it('step the cursor a little, or with Shift or the Page keys a leap', () => {
    expect(scrubKey('ArrowRight', false, 0.5)).toBeCloseTo(0.504);
    expect(scrubKey('ArrowUp', false, 0.5)).toBeCloseTo(0.504);
    expect(scrubKey('ArrowLeft', false, 0.5)).toBeCloseTo(0.496);
    expect(scrubKey('ArrowDown', true, 0.5)).toBeCloseTo(0.45);
    expect(scrubKey('PageUp', false, 0.5)).toBeCloseTo(0.55);
    expect(scrubKey('PageDown', false, 0.5)).toBeCloseTo(0.45);
  });

  it('go to the ends, and no further', () => {
    expect(scrubKey('Home', false, 0.5)).toBe(0);
    expect(scrubKey('End', false, 0.5)).toBe(1);
    expect(scrubKey('ArrowLeft', true, 0.01)).toBe(0);
    expect(scrubKey('PageUp', false, 0.99)).toBe(1);
  });

  it('leave other keys to the page', () => {
    expect(scrubKey('Tab', false, 0.5)).toBeNull();
    expect(scrubKey('a', true, 0.5)).toBeNull();
  });
});
