import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { Capability, FeatureContext } from '../feature';
import { EXTINCTION_EARTH_PARTS, extinctionsFeature } from '.';

const finds = vi.fn(() => [66, 252]);
const mountBody = vi.fn(() => ({ show: vi.fn(), finds }));
vi.mock('./body', () => ({ mountExtinctions: mountBody }));

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const layerOn: ViewState = { ...off, layers: withLayer(off.layers, 'extinctions', true) };
const deep: ViewState = { ...layerOn, ma: 66 };

function mounted() {
  const context = { refresh: vi.fn(), notify: vi.fn() } as unknown as FeatureContext<Capability>;
  return extinctionsFeature.mount(context, context);
}

describe('the extinctions’ front, loaded with the site (#220)', () => {
  it('asks for the cards, the timeline and the shared clock, and is shown again as deep time changes', () => {
    expect(extinctionsFeature.needs).toEqual(['cards', 'timeline', 'ownTime', 'strikes']);
    expect(extinctionsFeature.picks).toBe('extinction');
    expect(extinctionsFeature.watches(deep)).toEqual([
      deep.layers,
      deep.mode,
      deep.ma,
      deep.deepScale,
    ]);
  });

  it('keeps the lava flows and oxygen-poor seas with the site: the globe is made with them', () => {
    expect(EXTINCTION_EARTH_PARTS).toHaveLength(2);
  });

  it('Given the layer off, or on outside deep time, Then the extinctions’ code is not loaded', async () => {
    const shown = mounted();
    shown.show?.({ ...off, ma: 66 }, 0);
    shown.show?.(layerOn, 0);
    await Promise.resolve();
    expect(mountBody).not.toHaveBeenCalled();
    expect(shown.finds?.(layerOn)).toEqual([]);
  });

  it('Given the layer on in deep time, Then the body loads, and play eases near its moments', async () => {
    const shown = mounted();
    shown.show?.(deep, 0);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(mountBody).toHaveBeenCalledTimes(1);
    });
    expect(shown.finds?.(deep)).toEqual([66, 252]);
  });
});
