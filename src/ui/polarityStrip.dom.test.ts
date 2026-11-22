// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { createPolarityStrip } from './polarityStrip';

/** The strip's spans: where each starts and how wide, as percentages, and its polarity. */
function spans(root: HTMLElement): { left: number; width: number; polarity: string }[] {
  return [...root.querySelectorAll<HTMLElement>('.polarity-span')].map((span) => ({
    left: Number.parseFloat(span.style.left),
    width: Number.parseFloat(span.style.width),
    polarity: span.dataset['polarity'] ?? '',
  }));
}

describe('the magnetic polarity strip', () => {
  it('Given the 540 Myr span, Then its spans tile the bar from the oldest to today', () => {
    const strip = createPolarityStrip();
    strip.render(null, 540);
    const drawn = spans(strip.root);
    expect(drawn.length).toBeGreaterThan(1);
    // Youngest first, from today back: the oldest at the bar's left edge.
    expect(Math.min(...drawn.map(({ left }) => left))).toBeCloseTo(0, 6);
    const total = drawn.reduce((sum, { width }) => sum + width, 0);
    expect(total).toBeCloseTo(100, 6);
    expect(strip.root.getAttribute('aria-label')).toMatch(/^Magnetic polarity over the span: /);
  });

  it('Given a part of the span (#1074), Then its spans tile that part, the long Cretaceous calm across most of it', () => {
    const strip = createPolarityStrip();
    strip.render(null, 124, 76);
    const drawn = spans(strip.root);
    for (const { left, width } of drawn) {
      expect(left).toBeGreaterThanOrEqual(-1e-9);
      expect(left + width).toBeLessThanOrEqual(100 + 1e-9);
    }
    expect(drawn.reduce((sum, { width }) => sum + width, 0)).toBeCloseTo(100, 6);
    // The Cretaceous Normal Superchron, 121 to 83 Ma: most of the 48 million years shown.
    const calm = drawn.find(({ polarity }) => polarity === 'normal');
    expect(calm?.width ?? 0).toBeGreaterThan(70);
  });

  it('Given the same span twice, Then it is not drawn again; a new part of it is', () => {
    const strip = createPolarityStrip();
    strip.render(null, 124, 76);
    const first = strip.root.querySelector('.polarity-span');
    strip.render(null, 124, 76);
    expect(strip.root.querySelector('.polarity-span')).toBe(first);
    strip.render(null, 124, 80);
    expect(strip.root.querySelector('.polarity-span')).not.toBe(first);
  });
});
