import { describe, expect, it, vi } from 'vitest';

import { yearLender } from './chartPart';

describe('the chart’s year in the header through the last thousand years (#1285)', () => {
  it('lends its year where deep time would say "Today", and shows deep time again only when that changes', () => {
    const deep = { again: vi.fn() };
    let showing: { what: string | null } | null = { what: null };
    const lender = yearLender(deep, () => showing);
    lender.set(-18_050);
    expect(lender.date()).toBeNull();
    // A thousand years ago: deep time's own words still serve.
    lender.set(950);
    expect(lender.date()).toBeNull();
    expect(deep.again).not.toHaveBeenCalled();
    lender.set(1943);
    expect(lender.date()).toEqual({ when: '1943', what: null });
    expect(deep.again).toHaveBeenCalledTimes(1);
    lender.set(1943.2);
    expect(deep.again).toHaveBeenCalledTimes(1);
    lender.set(1200);
    expect(lender.date()?.when).toBe('1200 CE');
    expect(deep.again).toHaveBeenCalledTimes(2);
    // What the globe shows then, as the feature says.
    showing = { what: 'Industrial era · measured warming, 5-year mean' };
    lender.set(2025);
    expect(lender.date()).toEqual({ when: '2025', what: showing.what });
    // The chart gone: nothing lent, and deep time says its own again.
    showing = null;
    lender.set(2025);
    expect(lender.date()).toBeNull();
    lender.set(null);
    expect(lender.date()).toBeNull();
  });

  it('checks again what it lends when what shows changes, the year the same', () => {
    const deep = { again: vi.fn() };
    let showing: { what: string | null } | null = null;
    const lender = yearLender(deep, () => showing);
    lender.set(1990);
    expect(deep.again).not.toHaveBeenCalled();
    showing = { what: null };
    lender.check();
    expect(deep.again).toHaveBeenCalledTimes(1);
    lender.check();
    expect(deep.again).toHaveBeenCalledTimes(1);
  });
});
