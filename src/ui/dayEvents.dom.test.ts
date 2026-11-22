// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../text/passages';
import { createDayEvents } from './dayEvents';

describe("the years bar's single days (#837)", () => {
  it('Given a year with no event, Then the row is hidden', () => {
    const days = createDayEvents(vi.fn());
    days.render(2014);
    expect(days.root.hidden).toBe(true);
  });

  it('Given 2015, Then a chip for GW150914 that opens it, and gone again in 2016', () => {
    const open = vi.fn<(anchor: Anchor) => void>();
    const days = createDayEvents(open);
    days.render(2015);
    expect(days.root.hidden).toBe(false);
    const chips = days.root.querySelectorAll('button');
    expect(chips).toHaveLength(1);
    expect(chips[0]?.textContent).toBe('14 SepGW150914: first gravitational wave');
    chips[0]?.click();
    expect(open.mock.calls[0]?.[0].view).toContain('wave=gw150914');
    days.render(2016);
    expect(days.root.hidden).toBe(true);
    expect(days.root.querySelectorAll('button')).toHaveLength(0);
  });

  it('Given the same year again, Then the chips are kept, not made again', () => {
    const days = createDayEvents(vi.fn());
    days.render(2017);
    const chip = days.root.querySelector('button');
    days.render(2017);
    expect(days.root.querySelector('button')).toBe(chip);
    expect(chip?.textContent).toContain('GW170817');
  });
});
