// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { ShowerContext } from './body';
import { mountShower, showerFront } from '.';

vi.mock('./body', () => ({ mountShower: () => ({ container: null, stage: null, watch: null }) }));

function body() {
  const container = document.createElement('section');
  const stage = document.createElement('aside');
  const watch = vi.fn();
  const mountBody = vi.fn(() => ({ container, stage, watch }));
  return { container, stage, watch, mountBody };
}

describe('the shower’s front, loaded with the site (#220)', () => {
  it('holds the places of the 3D chapters and the stage until a shower is watched', () => {
    const part = mountShower({ notify: vi.fn() } as unknown as ShowerContext);
    expect(part.container.style.display).toBe('contents');
    expect(part.stage.style.display).toBe('contents');
    expect(part.container.childElementCount).toBe(0);
  });

  it('loads the story the first time a shower is watched, then plays it; once', async () => {
    const real = body();
    const load = vi.fn(() => Promise.resolve({ mountShower: real.mountBody }));
    const notify = vi.fn();
    const part = showerFront({ notify } as unknown as ShowerContext, load);
    expect(load).not.toHaveBeenCalled();
    part.watch(0.5, true);
    await vi.waitFor(() => {
      expect(real.watch).toHaveBeenCalledWith(0.5, true);
    });
    expect(part.container.firstElementChild).toBe(real.container);
    expect(part.stage.firstElementChild).toBe(real.stage);
    part.watch(1, false);
    await vi.waitFor(() => {
      expect(real.watch).toHaveBeenCalledWith(1, false);
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it('says when the story cannot load, and plays it once Try again loads it', async () => {
    const real = body();
    const load = vi
      .fn<() => Promise<{ mountShower: typeof real.mountBody }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ mountShower: real.mountBody });
    const notify = vi.fn();
    const part = showerFront({ notify } as unknown as ShowerContext, load);
    part.watch(0.25, false);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'Could not load the shower: offline',
        expect.any(Function),
      );
    });
    (notify.mock.calls[0]?.[1] as () => void)();
    await vi.waitFor(() => {
      expect(real.watch).toHaveBeenCalledWith(0.25, false);
    });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
