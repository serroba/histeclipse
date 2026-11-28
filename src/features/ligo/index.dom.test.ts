// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, type ViewState } from '../../state/viewState';
import type { WaveContext } from './body';
import { mountWave } from '.';

const render = vi.fn();
const mountBody = vi.fn(() => ({ watches: () => [], elements: [], render }));
vi.mock('./body', () => ({ mountWave: mountBody }));

const closed = defaultViewState(new Date('2026-01-01T00:00:00Z'));

describe('the gravitational wave’s front, loaded with the site (#220)', () => {
  it('watches the wave and its chapter, and loads the wave’s code only once one is named', async () => {
    const part = mountWave({ notify: vi.fn() } as unknown as WaveContext);
    expect(part.watches(closed)).toEqual([closed.wave, closed.waveChapter]);
    part.render(closed);
    await Promise.resolve();
    expect(mountBody).not.toHaveBeenCalled();
    const open: ViewState = { ...closed, wave: 'gw170817' };
    part.render(open);
    await vi.waitFor(() => {
      expect(render).toHaveBeenCalledWith(open);
    });
  });
});
