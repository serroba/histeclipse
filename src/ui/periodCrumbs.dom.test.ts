// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { EARTH_AGE_MA } from '../deepTime/scale';
import { createPeriodCrumbs } from './periodCrumbs';

const names = (root: HTMLElement) =>
  [...root.querySelectorAll('button')].map((button) => button.textContent);

describe('where the bar is in Earth’s history (#1075)', () => {
  it('Given part of the Cretaceous, Then Earth and the units that hold it; a tap fits the bar to one', () => {
    const onFit = vi.fn();
    const crumbs = createPeriodCrumbs(onFit);
    crumbs.render(124, 76, true);
    expect(crumbs.root.hidden).toBe(false);
    expect(names(crumbs.root)).toEqual(['Earth', 'Phanerozoic', 'Mesozoic', 'Cretaceous']);
    expect(crumbs.root.querySelector('[aria-current]')).toBeNull();
    const buttons = [...crumbs.root.querySelectorAll('button')];
    buttons[3]?.click();
    expect(onFit).toHaveBeenLastCalledWith(143.1, 66);
    buttons[0]?.click();
    expect(onFit).toHaveBeenLastCalledWith(EARTH_AGE_MA, 0);
  });

  it('Given the bar fitted to the Cretaceous, Then the Cretaceous is where it is', () => {
    const crumbs = createPeriodCrumbs(vi.fn());
    crumbs.render(143.1, 66, true);
    expect(crumbs.root.querySelector('[aria-current="location"]')?.textContent).toBe('Cretaceous');
  });

  it('Given a whole span, Then no crumbs', () => {
    const crumbs = createPeriodCrumbs(vi.fn());
    crumbs.render(124, 76, true);
    crumbs.render(2.6, 0, false);
    expect(crumbs.root.hidden).toBe(true);
    expect(names(crumbs.root)).toEqual([]);
  });
});
