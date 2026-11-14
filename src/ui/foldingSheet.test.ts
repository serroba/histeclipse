import { describe, expect, it } from 'vitest';

import { settlesOpen, type Drag } from './foldingSheet';

/** A drag that started at y 300 at 0 ms, the details 400 px tall opened in full. */
function drag(last: { y: number; t: number }, speed = 0): Drag {
  return { x: 0, y: 300, t: 0, scrolled: 0, from: 0, full: 400, last, speed };
}

describe('where a dragged sheet settles', () => {
  it('Given a quick flick up, Then it opens, however little it moved', () => {
    expect(settlesOpen(drag({ y: 250, t: 50 }), 60, 50)).toBe(true);
  });

  it('Given a quick flick down, Then it folds, however open it was', () => {
    expect(settlesOpen(drag({ y: 350, t: 50 }), 60, 350)).toBe(false);
  });

  it('Given a slow drag still moving up at the end, Then it opens', () => {
    expect(settlesOpen(drag({ y: 200, t: 990 }, -1), 1000, 100)).toBe(true);
  });

  it('Given a slow drag held still before lifting, Then more than half open opens', () => {
    expect(settlesOpen(drag({ y: 50, t: 500 }, -1), 1000, 250)).toBe(true);
    expect(settlesOpen(drag({ y: 250, t: 500 }, 1), 1000, 150)).toBe(false);
  });
  it('uses the half-open boundary when there is no flick', () => {
    const held = drag({ y: 100, t: 500 });
    expect(settlesOpen(held, 1000, 200)).toBe(false);
    expect(settlesOpen(held, 1000, 200.1)).toBe(true);
  });

  it('requires speed beyond the flick threshold, not exactly at it', () => {
    expect(settlesOpen(drag({ y: 200, t: 990 }, -0.5), 1000, 100)).toBe(false);
    expect(settlesOpen(drag({ y: 200, t: 990 }, -0.501), 1000, 100)).toBe(true);
    expect(settlesOpen(drag({ y: 200, t: 990 }, 0.5), 1000, 300)).toBe(true);
    expect(settlesOpen(drag({ y: 200, t: 990 }, 0.501), 1000, 300)).toBe(false);
  });

  it('drops the last movement speed after the stillness interval', () => {
    const paused = drag({ y: 250, t: 500 }, -1);
    expect(settlesOpen(paused, 600, 50)).toBe(true);
    expect(settlesOpen(paused, 601, 50)).toBe(false);
  });
});
