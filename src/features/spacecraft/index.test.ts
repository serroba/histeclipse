import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { Capability, FeatureContext } from '../feature';
import { spacecraftFeature } from '.';

vi.mock('./body', () => ({ mountSpacecraft: () => ({ show: vi.fn() }) }));

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));

function mounted() {
  const rail: [boolean, boolean][] = [];
  const refresh = vi.fn();
  const context = {
    refresh,
    notify: vi.fn(),
    zoomRail: { setSpacecraft: (offered: boolean, shown: boolean) => rail.push([offered, shown]) },
  } as unknown as FeatureContext<Capability>;
  return { shown: spacecraftFeature.mount(context, context), rail, refresh };
}

describe('the spacecraft layer’s front, loaded with the site (#220)', () => {
  it('Given the layer off, Then the rail offers it, and the layer’s code is not loaded', () => {
    const { shown, rail } = mounted();
    shown.show?.(base, 0);
    shown.show?.({ ...base, ma: 66 }, 0);
    expect(rail).toEqual([
      [true, false],
      [false, false],
    ]);
    expect(shown.load?.()).toBeNull();
  });

  it.each<[string, ViewState]>([
    ['its layer', { ...base, layers: withLayer(base.layers, 'spacecraft', true) }],
    [
      'the Telescopes’, whose craft fly',
      { ...base, layers: withLayer(base.layers, 'telescopes', true) },
    ],
    ['a mission followed', { ...base, mission: 'd00273' }],
  ])('Given %s, Then its code loads', async (_, state) => {
    const { shown, refresh } = mounted();
    shown.show?.(state, 0);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('Given its layer on in deep time, Then it is not wanted there', () => {
    const { shown } = mounted();
    shown.show?.({ ...base, ma: 66, layers: withLayer(base.layers, 'spacecraft', true) }, 0);
    expect(shown.load?.()).toBeNull();
  });
});
