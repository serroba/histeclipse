import { describe, expect, it } from 'vitest';

import { PRESENT_YEAR } from './present';

describe('PRESENT_YEAR', () => {
  it('is this year, as the page was opened', () => {
    expect(PRESENT_YEAR).toBe(new Date().getUTCFullYear());
  });
});
