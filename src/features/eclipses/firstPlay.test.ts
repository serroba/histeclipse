import { describe, expect, it, vi } from 'vitest';

import { firstPlay } from './firstPlay';

describe('where ▶ plays an eclipse from (#986)', () => {
  it('Given Thales opened at Anatolia’s deepest, Then the first ▶ plays it from its start', () => {
    const first = firstPlay();
    const goTo = vi.fn();
    first.show('solar:-0584-05-28');
    first.play(95, 180, goTo);
    expect(goTo).toHaveBeenCalledWith(-180);
  });

  it('Given it played and paused, Then ▶ goes on from there', () => {
    const first = firstPlay();
    const goTo = vi.fn();
    first.show('solar:-0584-05-28');
    first.play(95, 180, goTo);
    first.show('solar:-0584-05-28');
    first.play(-20, 180, goTo);
    expect(goTo).toHaveBeenCalledTimes(1);
  });

  it('Given the reader moved the time first, Then ▶ goes on from where they put it', () => {
    const first = firstPlay();
    const goTo = vi.fn();
    first.show('solar:-0584-05-28');
    first.moved();
    first.play(40, 180, goTo);
    expect(goTo).not.toHaveBeenCalled();
  });

  it('Given another eclipse opened, Then its first ▶ plays it from its start too', () => {
    const first = firstPlay();
    const goTo = vi.fn();
    first.show('a');
    first.play(0, 180, goTo);
    first.show('b');
    first.play(30, 180, goTo);
    expect(goTo).toHaveBeenLastCalledWith(-180);
    expect(goTo).toHaveBeenCalledTimes(2);
  });

  it('Given the end, Then ▶ starts again from the start, as it always did', () => {
    const first = firstPlay();
    const goTo = vi.fn();
    first.show('a');
    first.moved();
    first.play(180, 180, goTo);
    expect(goTo).toHaveBeenCalledWith(-180);
  });
});
