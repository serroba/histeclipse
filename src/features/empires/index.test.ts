import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { Capability, FeatureContext } from '../feature';
import { empiresFeature } from '.';

const bodyShow = vi.fn();
const mountBody = vi.fn(() => ({ show: bodyShow }));
vi.mock('./body', () => ({ mountEmpires: mountBody }));

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'empires', true) };

function mounted() {
  const context = { refresh: vi.fn(), notify: vi.fn() } as unknown as FeatureContext<Capability>;
  return empiresFeature.mount(context, context);
}

describe('the borders of past states’ front, loaded with the site (#220)', () => {
  it('asks for the border files, the years’ track and "Why here?", and watches the layers, deep time and the source', () => {
    expect(empiresFeature.needs).toEqual(['stateBorders', 'yearsTrack', 'whyHere']);
    expect(empiresFeature.watches(on)).toEqual([on.layers, on.ma, on.borders]);
  });

  it('Given the layer off, or on in deep time, Then the borders’ code is not loaded', async () => {
    const shown = mounted();
    shown.show?.(off, 0);
    shown.show?.({ ...on, ma: 66 }, 0);
    await Promise.resolve();
    expect(mountBody).not.toHaveBeenCalled();
    expect(shown.load?.()).toBeNull();
  });

  it('Given the layer on in historical time, Then the body loads, says it is loading, and is shown', async () => {
    const shown = mounted();
    shown.show?.(on, 0);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(mountBody).toHaveBeenCalledTimes(1);
    });
    shown.show?.(on, 1);
    expect(bodyShow).toHaveBeenCalledWith(on, 1);
  });
});
