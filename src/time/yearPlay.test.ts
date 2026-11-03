import { describe, expect, it } from 'vitest';

import { yearPlayhead } from './yearPlay';

describe('the Holocene playhead', () => {
  it('moves at the same pace at any frame rate', () => {
    for (const fps of [30, 60, 120, 144]) {
      const head = yearPlayhead();
      let year = -600;
      for (let frame = 0; frame < fps * 2; frame += 1) year = head.step(year, 10, 1 / fps, 2026);
      expect(year).toBe(-580);
    }
  });

  it('stops at the last year', () => {
    const head = yearPlayhead();
    expect(head.step(2020, 1000, 0.2, 2026)).toBe(2026);
  });

  it('carries on from a year changed elsewhere', () => {
    const head = yearPlayhead();
    expect(head.step(0, 10, 0.1, 2026)).toBe(1);
    expect(head.step(500, 10, 0.1, 2026)).toBe(501);
  });

  it('does not leap after a stall, nor go back for a clock that does', () => {
    const head = yearPlayhead();
    expect(head.step(0, 100, 10, 2026)).toBe(25);
    expect(head.step(25, 100, -1, 2026)).toBe(25);
  });
});
