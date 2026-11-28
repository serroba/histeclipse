import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { Capability, FeatureContext } from '../feature';
import { volcanoesFeature } from '.';

const bodyPick = vi.fn();
const mountBody = vi.fn(() => ({ show: vi.fn(), pick: bodyPick }));
vi.mock('./body', () => ({ mountVolcanoes: mountBody }));

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'volcanoes', true) };

function mounted() {
  const context = { refresh: vi.fn(), notify: vi.fn() } as unknown as FeatureContext<Capability>;
  return volcanoesFeature.mount(context, context);
}

describe('the volcanoes’ front, loaded with the site (#220)', () => {
  it('asks for cards and the timeline, picks volcanoes, and watches the layers, the view and deep time', () => {
    expect(volcanoesFeature.needs).toEqual(['cards', 'timeline']);
    expect(volcanoesFeature.picks).toBe('volcano');
    expect(volcanoesFeature.watches(on)).toEqual([on.layers, on.mode, on.ma]);
  });

  it('Given the layer off, in the sky or in deep time, Then the eruptions’ code is not loaded', async () => {
    const shown = mounted();
    shown.show?.(off, 0);
    shown.show?.({ ...on, mode: 'sky' }, 0);
    shown.show?.({ ...on, ma: 66 }, 0);
    await Promise.resolve();
    expect(mountBody).not.toHaveBeenCalled();
  });

  it('Given a volcano picked from a link, Then the body loads and opens it', async () => {
    const shown = mounted();
    shown.pick?.('263300');
    shown.show?.(on, 0);
    await vi.waitFor(() => {
      expect(bodyPick).toHaveBeenCalledWith('263300');
    });
    expect(mountBody).toHaveBeenCalledTimes(1);
  });
});
