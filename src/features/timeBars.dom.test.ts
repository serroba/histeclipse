// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { defaultViewState } from '../state/viewState';
import type { LaunchesContext } from './spacecraft';
import { mountTimeBars } from './timeBars';

const launches = {
  root: document.createElement('div'),
  extras: document.createElement('span'),
  show: vi.fn(),
  render: vi.fn(),
  earthFace: vi.fn((jd: number) => jd + 1),
};
const ozone = {
  root: document.createElement('div'),
  extras: document.createElement('span'),
  show: vi.fn(),
  render: vi.fn(),
};
vi.mock('./spacecraft', () => ({ mountLaunches: () => launches }));
vi.mock('./ozone', () => ({ mountOzoneBar: () => ozone }));

describe('the bars that run the time in place of the years’ own (#805)', () => {
  it('Given the page, Then the launches’ bar and ozone’s are mounted as one part: both shown and drawn, each where the one part lies, the launches turning Earth’s face', () => {
    const bars = mountTimeBars({} as LaunchesContext);
    expect([...bars.root.children]).toEqual([launches.root, ozone.root]);
    expect([...bars.extras.children]).toEqual([launches.extras, ozone.extras]);
    // Not boxes themselves: their children lie where they do.
    expect(bars.root.style.display).toBe('contents');
    expect(bars.extras.style.display).toBe('contents');
    const state = defaultViewState(new Date('2026-01-01T00:00:00Z'));
    bars.show(state);
    bars.render(state);
    expect(launches.show).toHaveBeenCalledWith(state);
    expect(ozone.show).toHaveBeenCalledWith(state);
    expect(launches.render).toHaveBeenCalledWith(state);
    expect(ozone.render).toHaveBeenCalledWith(state);
    expect(bars.earthFace(10)).toBe(11);
  });
});
