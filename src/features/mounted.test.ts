import { describe, expect, it, vi } from 'vitest';
import { defaultViewState, type ViewState } from '../state/viewState';
import type { Capabilities, Feature, FeatureCore, FeatureInstance } from './feature';
import { deepChipsOf, mountFeatures } from './mounted';

const base = defaultViewState(new Date(Date.UTC(2024, 3, 8)));

function fake(id: Feature['id'], watches: (s: ViewState) => readonly unknown[], picks?: string) {
  const shown = {
    show: vi.fn(),
    deep: vi.fn(() => (id === 'fossils' ? { text: 'some' } : null)),
    pick: vi.fn(),
    unpick: vi.fn(),
    said: vi.fn(() => `${id} said`),
    ...(id === 'fossils' && {
      action: () => ({ label: 'Go', run: () => undefined }),
      load: () => ({ state: 'loading' }),
      here: () => ({ title: 'Fossils', text: 'Here.', why: 'fossils' }),
    }),
  };
  const feature = {
    id,
    needs: [],
    watches,
    ...(picks === undefined ? {} : { picks }),
    mount: () => shown as unknown as FeatureInstance,
  } as Feature;
  return { feature, shown };
}

describe('the features as mounted together', () => {
  const fossils = fake('fossils', (s) => [s.layers], 'fossil');
  const asteroids = fake('asteroids', (s) => [s.camera], 'asteroid');
  const features = mountFeatures(
    [fossils.feature, asteroids.feature],
    {} as FeatureCore,
    {} as Capabilities,
  );

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

  it('gathers the step each offers from its row in the Layers panel, or none', () => {
    const actions = new Map(features.actions());
    expect(actions.get('fossils')?.label).toBe('Go');
    expect(actions.get('asteroids')).toBeNull();
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

  it('says how each one’s load stands, none where it does not report one (#751)', () => {
    expect(features.loads()).toEqual([
      ['fossils', { state: 'loading' }],
      ['asteroids', null],
    ]);
  });
});

describe('the facts of the place picked (#893)', () => {
  it('gathers what each feature has there, none from those that have nothing', () => {
    const features = mountFeatures(
      [fake('fossils', () => []).feature, fake('asteroids', () => []).feature],
      {} as FeatureCore,
      {} as Capabilities,
    );
    expect(features.here(base)).toEqual([
      ['fossils', { title: 'Fossils', text: 'Here.', why: 'fossils' }],
    ]);
  });
});

describe("deep time's chips", () => {
  it('come from the features that have one, in their order', () => {
    const chip = { label: 'Fossils', why: 'fossils' } as const;
    const withChip = { ...fake('fossils', () => []).feature, deepChip: chip } as Feature;
    const without = fake('asteroids', () => []).feature;
    expect(deepChipsOf([without, withChip])).toEqual([{ layer: 'fossils', ...chip }]);
  });

  it('puts a chip that asks to come later after the others, whatever the order mounted (#909)', () => {
    const fossils = { label: 'Fossils', why: 'fossils' } as const;
    const impacts = { label: 'Impacts', why: 'impacts' } as const;
    const first = {
      ...fake('impacts', () => []).feature,
      deepChip: impacts,
      deepChipOrder: 1,
    } as Feature;
    const second = { ...fake('fossils', () => []).feature, deepChip: fossils } as Feature;
    expect(deepChipsOf([first, second]).map(({ layer }) => layer)).toEqual(['fossils', 'impacts']);
  });
});
