// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { ActiveLayer } from '../../state/activeLayers';
import type { Layer } from '../../state/viewState';
import { createLayerRail, railGroups, railOrder } from './layerRail';

const ids = (span: Parameters<typeof railGroups>[0]): Layer[] =>
  railGroups(span).flatMap((group) => group.map((each) => each.id));

describe('the layers on the zoom rail (#1156)', () => {
  it('offers each span only the layers with data in it, leaving the rail’s own buttons to it', () => {
    expect(ids('eons')).toEqual(['plates', 'temperature', 'sealevel']);
    expect(ids('ice')).toContain('humans');
    expect(ids('ice')).not.toContain('fossils');
    expect(ids('all')).toContain('fossils');
    expect(ids('years')).toContain('eclipses');
    for (const own of ['orbits', 'spacecraft', 'asteroids'] as const) {
      expect(ids('years')).not.toContain(own);
    }
    // In the panel's groups: none empty.
    for (const group of railGroups('years')) expect(group.length).toBeGreaterThan(0);
  });

  it('puts the layers on first as the span is shown, and keeps the order as they are turned', () => {
    const order = railOrder('ice', new Set<Layer>(['humans', 'sealevel']));
    expect(order[0]?.map((each) => each.id)).toEqual(['humans', 'sealevel']);
    expect(
      order
        .flat()
        .map((each) => each.id)
        .sort(),
    ).toEqual([...ids('ice')].sort());
    expect(railOrder('ice', new Set())).toEqual(railGroups('ice'));
    const rail = createLayerRail({ onLayer: vi.fn(), onAll: vi.fn() });
    rail.render('ice', new Set<Layer>(['humans']), []);
    const before = [...rail.root.querySelectorAll<HTMLElement>('[data-layer]')].map(
      (button) => button.dataset['layer'],
    );
    rail.render('ice', new Set<Layer>(['humans', 'temperature']), []);
    const after = [...rail.root.querySelectorAll<HTMLElement>('[data-layer]')].map(
      (button) => button.dataset['layer'],
    );
    expect(after).toEqual(before);
  });

  it('Given a span, Then its icons, pressed while on; a tap turns one on or off', () => {
    const onLayer = vi.fn();
    const rail = createLayerRail({ onLayer, onAll: vi.fn() });
    rail.render('eons', new Set<Layer>(['plates']), []);
    expect(rail.offered()).toBe(true);
    const buttons = [...rail.root.querySelectorAll<HTMLButtonElement>('.rail-layer[data-layer]')];
    expect(buttons.map((button) => button.dataset['layer'])).toEqual([
      'plates',
      'temperature',
      'sealevel',
    ]);
    const [plates, temperature] = buttons;
    expect(plates?.getAttribute('aria-pressed')).toBe('true');
    expect(temperature?.getAttribute('aria-pressed')).toBe('false');
    temperature?.click();
    expect(onLayer).toHaveBeenLastCalledWith('temperature', true);
    plates?.click();
    expect(onLayer).toHaveBeenLastCalledWith('plates', false);
  });

  it('Given a layer on that draws nothing here, Then it is marked and says why with its name', () => {
    const rail = createLayerRail({ onLayer: vi.fn(), onAll: vi.fn() });
    const loading: ActiveLayer = {
      layer: 'temperature',
      label: 'Temperature',
      coverage: 'loading',
      draws: false,
      why: 'loading…',
      reach: '',
      goTo: null,
      retry: null,
      list: false,
    };
    rail.render('eons', new Set<Layer>(['temperature']), [loading]);
    const button = rail.root.querySelector<HTMLButtonElement>('[data-layer="temperature"]');
    expect(button?.dataset['coverage']).toBe('loading');
    expect(button?.getAttribute('aria-label')).toBe('Temperature: loading…');
    rail.render('eons', new Set<Layer>(['temperature']), [
      { ...loading, coverage: 'available', draws: true, why: null },
    ]);
    expect(button?.dataset['coverage']).toBeUndefined();
    expect(button?.getAttribute('aria-label')).toBe('Temperature');
  });

  it('Given another span, Then its own icons; All layers opens the panel from the rail', () => {
    const onAll = vi.fn();
    const rail = createLayerRail({ onLayer: vi.fn(), onAll });
    rail.render('eons', new Set(), []);
    rail.render('ice', new Set(), []);
    const shown = [...rail.root.querySelectorAll<HTMLElement>('.rail-layer-list [data-layer]')];
    expect(shown.map((button) => button.dataset['layer'])).toEqual(ids('ice'));
    const all = rail.root.querySelector<HTMLButtonElement>('.rail-all');
    all?.click();
    expect(onAll).toHaveBeenCalledWith(all);
  });
});
