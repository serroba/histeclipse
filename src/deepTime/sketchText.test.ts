import { describe, expect, it } from 'vitest';

import { sketchAt } from './sketch';
import { sketchHeadline, sketchLines } from './sketchText';

const choices = { impact: 'early', land: 'dhuime', snowball: 'hard' } as const;

describe('the sketch’s wording', () => {
  it('says the molten surface follows the chosen impact, and flags a clash with the zircon', () => {
    const early = sketchLines(sketchAt(4520, choices, false), choices, 4520);
    expect(early).toHaveLength(1);
    expect(early[0]).toContain('4,510 Ma');
    const young = { ...choices, impact: 'young' } as const;
    const lines = sketchLines(sketchAt(4380, young, false), young, 4380);
    expect(lines[1]).toContain('4,404-million-year-old zircon');
  });

  it('gives the land’s share, its source, and that its shapes are invented', () => {
    const [share, note] = sketchLines(sketchAt(3000, choices, false), choices, 3000);
    expect(share).toContain('invented');
    expect(share).toContain('18% of the surface');
    expect(share).toContain('63% of today’s crust');
    expect(note).toContain('65%');
  });

  it('says only the emerged crust is drawn in the flooded model', () => {
    const flooded = { ...choices, land: 'flooded' } as const;
    const [share] = sketchLines(sketchAt(3000, flooded, false), flooded, 3000);
    expect(share).toContain('2.5% of the surface');
    expect(share).toContain('above the sea in Flament');
  });

  it('names the glaciation and how far the chosen model takes the ice', () => {
    const slush = { ...choices, snowball: 'slush' } as const;
    const lines = sketchLines(sketchAt(700, slush, true), slush, 700);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Sturtian glaciation, 658.5–717.5 Ma');
    expect(lines[0]).toContain('25°');
  });

  it('sums the sketch up in a line', () => {
    expect(sketchHeadline(sketchAt(4520, choices, false))).toBe(
      'Sketch, not a map: a molten surface.',
    );
    expect(sketchHeadline(sketchAt(2440, choices, false))).toBe(
      'Sketch, not a map: 22% of the surface land, its shapes and places invented · Makganyene snowball.',
    );
    expect(sketchHeadline(sketchAt(700, choices, true))).toBe(
      'Sketch, not a map: Sturtian snowball.',
    );
  });

  it('says nothing where a reconstruction draws the land and no snowball is on', () => {
    expect(sketchLines(sketchAt(1000, choices, true), choices, 1000)).toEqual([]);
  });
});
