import { describe, expect, it } from 'vitest';

import { createLinger, LINGER_PACE, LINGER_SECONDS } from './linger';

describe('lingering at the moments that matter (#1267)', () => {
  it('stops on a key moment it would pass, creeps on for a while, then goes on', () => {
    const linger = createLinger([3]);
    expect(linger.step(2, 0.5, 0.1)).toEqual({ delta: 0.5, lingering: false });
    // It would pass 3: it stops on it.
    expect(linger.step(2.5, 1, 0.1)).toEqual({ delta: 0.5, lingering: true });
    let position = 3;
    let held = 0;
    for (;;) {
      const { delta, lingering } = linger.step(position, 0.1, 0.1);
      if (!lingering) break;
      expect(delta).toBeCloseTo(0.1 * LINGER_PACE, 9);
      position += delta;
      held += 0.1;
    }
    expect(held).toBeCloseTo(LINGER_SECONDS - 0.1, 6);
    // Past it, play goes at its pace again, and does not stop on it twice.
    expect(linger.step(position, 0.1, 0.1).lingering).toBe(false);
  });

  it('lingers again at the key moments ahead when the reader moves it back', () => {
    const linger = createLinger([3]);
    linger.step(2.9, 0.2, 0.1);
    // Moved back by the slider: 3 is ahead again.
    expect(linger.step(1, 3, 0.1)).toEqual({ delta: 2, lingering: true });
    // Moved past it: not lingered at.
    expect(linger.step(5, 0.1, 0.1)).toEqual({ delta: 0.1, lingering: false });
  });

  it('plays on at its pace with no key moments', () => {
    expect(createLinger([]).step(1, 0.2, 0.1)).toEqual({ delta: 0.2, lingering: false });
  });
});
