// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { activeLayers } from '../state/activeLayers';
import { parseViewState } from '../state/url';
import { element } from './dom';
import { layerDock } from './layerDock';

const at = (query: string) => parseViewState(query, new Date('2026-11-15T00:00:00Z')).state;

/** A dock button as the bar makes them: its layer, its icon's place, its word. */
function button(layer: string, label: string): HTMLButtonElement {
  return element(
    'button',
    { type: 'button', class: 'deep-layer', 'data-layer': layer, 'aria-pressed': 'false' },
    element('span', { class: 'icon-label' }, label),
  );
}

describe('the dock wears each layer’s state (#1071)', () => {
  const make = () => {
    const humans = button('humans', 'Humans');
    const sealevel = button('sealevel', 'Sea level');
    const dock = layerDock(sealevel, humans);
    return { dock, humans, sealevel };
  };

  it('Given a layer on that draws here, Then it carries no warning, and its name is unchanged', () => {
    const { dock, humans } = make();
    dock.render(activeLayers(at('ma=0.315&scale=ice&layers=humans')));
    expect(humans.dataset['coverage']).toBeUndefined();
    expect(humans.title).toBe('Humans');
    expect(dock.root.querySelector('#dock-state-humans')?.textContent).toBe('');
  });

  it('Given a layer on with nothing here, Then it is marked and says why in words', () => {
    const fossils = button('fossils', 'Fossils');
    const dock = layerDock(fossils);
    // Fossils are drawn on the 540 Myr span, not the ice ages.
    dock.render(activeLayers(at('ma=0.021&scale=ice&layers=fossils')));
    expect(fossils.dataset['coverage']).toBe('other-span');
    expect(fossils.getAttribute('aria-describedby')).toBe('dock-state-fossils');
    expect(dock.root.querySelector('#dock-state-fossils')?.textContent).toBe(
      'Not drawn here: on 540 Myr.',
    );
    expect(fossils.title).toBe('Fossils: Not drawn here: on 540 Myr.');
  });

  it('Given a layer loading or failed, Then it says so, busy while it loads, and clears when it draws', () => {
    const { dock, sealevel } = make();
    const state = at('ma=0.315&scale=ice&layers=sealevel');
    dock.render(activeLayers(state, [['sealevel', { state: 'loading' }]]));
    expect(sealevel.dataset['coverage']).toBe('loading');
    expect(sealevel.getAttribute('aria-busy')).toBe('true');
    expect(dock.root.querySelector('#dock-state-sealevel')?.textContent).toBe('Loading.');
    dock.render(activeLayers(state, [['sealevel', { state: 'failed', retry: () => undefined }]]));
    expect(sealevel.dataset['coverage']).toBe('failed');
    expect(sealevel.hasAttribute('aria-busy')).toBe(false);
    expect(sealevel.title).toBe('Sea level: Could not load.');
    dock.render(activeLayers(state, [['sealevel', null]]));
    expect(sealevel.dataset['coverage']).toBeUndefined();
    expect(sealevel.title).toBe('Sea level');
  });

  it('Given layers off, Then nothing is marked', () => {
    const { dock, humans, sealevel } = make();
    dock.render([]);
    for (const each of [humans, sealevel]) {
      expect(each.dataset['coverage']).toBeUndefined();
      expect(each.hasAttribute('aria-busy')).toBe(false);
    }
    expect(dock.root.getAttribute('aria-label')).toBe('The time bar’s layers');
  });
});
