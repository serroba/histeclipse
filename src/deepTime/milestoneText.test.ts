import { describe, expect, it } from 'vitest';

import { basisNote, formatRange } from './milestoneText';

describe('formatRange', () => {
  it('gives points and ranges in millions of years', () => {
    expect(formatRange(66.043, 66.043)).toBe('66.043 Ma');
    expect(formatRange(50.6, 52.8)).toBe('50.6–52.8 Ma');
    expect(formatRange(201.2, 201.6)).toBe('201.2–201.6 Ma');
    expect(formatRange(330, 330)).toBe('330 Ma');
    expect(formatRange(4350, 4510)).toBe('4,350–4,510 Ma');
    expect(formatRange(4567.14, 4567.46)).toBe('4,567.14–4,567.46 Ma');
  });

  it('gives the last million years in years', () => {
    expect(formatRange(0.281, 0.349)).toBe('281,000–349,000 years ago');
    expect(formatRange(0.3, 0.3)).toBe('300,000 years ago');
  });
});

describe('basisNote', () => {
  it('explains numbers the source does not state outright', () => {
    expect(basisNote('stated')).toBeNull();
    expect(basisNote('stage')).toContain('geological stage');
    expect(basisNote('secondary')).toContain('later paper');
  });
});
