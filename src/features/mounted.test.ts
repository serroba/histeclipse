import { describe, expect, it, vi } from 'vitest';
import { defaultViewState, type ViewState } from '../state/viewState';
import type { Feature, FeatureContext, FeatureInstance } from './feature';
import { deepChipsOf, mountFeatures } from './mounted';

const base = defaultViewState(new Date(Date.UTC(2024, 3, 8)));

function fake(id: Feature['id'], watches: (s: ViewState) => readonly unknown[], picks?: string) {
  const shown = {
    show: vi.fn(),
    deep: vi.fn(() => (id === 'fossils' ? { text: 'some' } : null)),
    pick: vi.fn(),
    unpick: vi.fn(),
    said: vi.fn(() => `${id} said`),
  };
  const feature = {
    id,
    watches,
    ...(picks === undefined ? {} : { picks }),
    mount: () => shown as unknown as FeatureInstance,
  } as Feature;
  return { feature, shown };
}

describe('the features as mounted together', () => {
  const fossils = fake('fossils', (s) => [s.layers], 'fossil');
  const asteroids = fake('asteroids', (s) => [s.camera], 'asteroid');
  const features = mountFeatures([fossils.feature, asteroids.feature], {} as FeatureContext);

  it('shows each at the moment, and again only those whose watches changed', () => {
    features.show(base, 1);
    expect(fossils.shown.show).toHaveBeenCalledWith(base, 1);
    expect(asteroids.shown.show).toHaveBeenCalledWith(base, 1);
    vi.clearAllMocks();
    const moved = { ...base, camera: { ...base.camera } };
    features.redraw(moved, base, 2);
    expect(fossils.shown.show).not.toHaveBeenCalled();
    expect(asteroids.shown.show).toHaveBeenCalledWith(moved, 2);
    vi.clearAllMocks();
    features.redraw(moved, base, null);
    features.redraw(moved, null, 2);
    features.show(base, null);
    expect(asteroids.shown.show).not.toHaveBeenCalled();
  });

  it('gathers deep chips by layer, and tells each when deep time is left', () => {
    const chips = features.deep(base, { ma: 66, scale: 'all' });
    expect([...chips.keys()]).toEqual(['fossils']);
    features.deepOff(base);
    expect(asteroids.shown.deep).toHaveBeenLastCalledWith(base, null);
  });

  it('picks by kind after unpicking all, and says when a key is none of theirs', () => {
    vi.clearAllMocks();
    expect(features.pick('asteroid:12:b')).toBe(true);
    expect(asteroids.shown.pick).toHaveBeenCalledWith('12:b');
    expect(fossils.shown.unpick).toHaveBeenCalled();
    expect(features.pick('impact:3')).toBe(false);
    expect(features.pick('nothing')).toBe(false);
  });

  it('says what the Layers panel says under each', () => {
    expect(features.said()).toEqual([
      ['fossils', 'fossils said'],
      ['asteroids', 'asteroids said'],
    ]);
  });
});

describe("deep time's chips", () => {
  it('come from the features that have one, in their order', () => {
    const chip = { label: 'Fossils', icon: 'fossils', why: 'fossils' } as const;
    const withChip = { ...fake('fossils', () => []).feature, deepChip: chip } as Feature;
    const without = fake('asteroids', () => []).feature;
    expect(deepChipsOf([without, withChip])).toEqual([{ layer: 'fossils', ...chip }]);
  });
});
