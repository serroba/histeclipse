import { describe, expect, it, vi } from 'vitest';

import { heldStrikes, playedImpact, type PlayedImpact } from './heldStrikes';

function strike(): PlayedImpact & { over: boolean; holds: number } {
  let held = false;
  return {
    over: false,
    holds: 0,
    moveTo: () => undefined,
    held: () => held,
    hold(next) {
      held = next;
      this.holds += 1;
    },
    step: () => undefined,
    at: () => undefined,
    end: () => undefined,
    playing() {
      return !this.over;
    },
  };
}

describe('strikes held while deep time is paused (#807)', () => {
  it('hold every strike playing, and let them play on', () => {
    const strikes = heldStrikes();
    const one = strike();
    const two = strike();
    expect(strikes.add(one)).toBe(one);
    strikes.add(two);
    strikes.sync(true);
    expect([one.held(), two.held()]).toEqual([true, true]);
    strikes.sync(false);
    expect([one.held(), two.held()]).toEqual([false, false]);
  });

  it('leave alone one already as asked, and let go of one played out', () => {
    const strikes = heldStrikes();
    const one = strike();
    strikes.add(one);
    strikes.sync(false);
    expect(one.holds).toBe(0);
    one.over = true;
    strikes.sync(true);
    expect(one.held()).toBe(false);
  });

  it('hand whoever played one each change drawn at once, only while it plays', () => {
    const impact = strike();
    const moved = vi.spyOn(impact, 'moveTo');
    const stepped = vi.spyOn(impact, 'step');
    const redraw = vi.fn();
    let playing = true;
    const played = playedImpact(impact, () => playing, redraw);
    played.moveTo({ latitude: 1, longitude: 2 });
    played.hold(true);
    played.step(250);
    expect(moved).toHaveBeenCalledOnce();
    expect(played.held()).toBe(true);
    expect(stepped).toHaveBeenCalledWith(250);
    expect(redraw).toHaveBeenCalledTimes(3);
    expect(played.playing()).toBe(true);
    playing = false;
    played.hold(false);
    expect(played.held()).toBe(true);
    expect(redraw).toHaveBeenCalledTimes(3);
  });
});
