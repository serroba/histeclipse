import { describe, expect, it } from 'vitest';

import type { PlayedImpact } from '../../globe/heldStrikes';
import { illustrationKeys, LEAP_MS, STEP_MS } from './illustrationKeys';

function fakeImpact(): PlayedImpact & { steps: number[] } {
  let held = false;
  const steps: number[] = [];
  return {
    steps,
    moveTo: () => undefined,
    held: () => held,
    hold(next) {
      held = next;
    },
    step(ms) {
      steps.push(ms);
    },
    at: () => undefined,
    end: () => undefined,
    playing: () => true,
  };
}

describe('the keys for a crater card’s illustration (#807)', () => {
  it('take the keys only while it plays and deep time does not', () => {
    const impact = fakeImpact();
    let deep = false;
    let current: PlayedImpact | null = null;
    const keys = illustrationKeys(
      () => current,
      () => deep,
    );
    expect(keys.shown()).toBe(false);
    current = impact;
    expect(keys.shown()).toBe(true);
    deep = true;
    expect(keys.shown()).toBe(false);
    expect(keys.over).toBe(true);
  });

  it('hold it with Space and let it play on, and step it held', () => {
    const impact = fakeImpact();
    const keys = illustrationKeys(
      () => impact,
      () => false,
    );
    keys.toggle();
    expect(impact.held()).toBe(true);
    keys.toggle();
    expect(impact.held()).toBe(false);
    keys.step(-1, false);
    keys.step(1, true);
    expect(impact.held()).toBe(true);
    expect(impact.steps).toEqual([-STEP_MS, LEAP_MS]);
  });

  it('do nothing with nothing playing', () => {
    const keys = illustrationKeys(
      () => null,
      () => false,
    );
    expect(() => {
      keys.toggle();
      keys.step(1, false);
    }).not.toThrow();
  });
});
