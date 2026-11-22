// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

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
    const dock = layerDock(
      { onAddLayer: () => undefined, onGoTo: () => undefined },
      sealevel,
      humans,
    );
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
    const dock = layerDock({ onAddLayer: () => undefined, onGoTo: () => undefined }, fossils);
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

  it('Given some buttons hidden, Then the dock says which layers it shows (#1072)', () => {
    const { dock, humans } = make();
    expect(dock.shown()).toEqual(new Set(['sealevel', 'humans']));
    humans.hidden = true;
    expect(dock.shown()).toEqual(new Set(['sealevel']));
  });

  it('Given layers off, Then nothing is marked, and they are hidden: Layers switches them on (#752)', () => {
    const { dock, humans, sealevel } = make();
    dock.render([]);
    for (const each of [humans, sealevel]) {
      expect(each.dataset['coverage']).toBeUndefined();
      expect(each.hasAttribute('aria-busy')).toBe(false);
      expect(each.hasAttribute('data-off')).toBe(true);
    }
    expect(dock.shown()).toEqual(new Set());
    expect(dock.root.getAttribute('aria-label')).toBe('The time bar’s layers');
  });
});

describe('the dock holds only the layers on (#752)', () => {
  it('Given Add pressed, Then the Layers panel is asked for, from Add', () => {
    const onAdd = vi.fn();
    const dock = layerDock(
      { onAddLayer: onAdd, onGoTo: () => undefined },
      button('humans', 'Humans'),
    );
    const add = dock.root.querySelector<HTMLButtonElement>('.deep-add');
    expect(add?.getAttribute('aria-label')).toBe('Add a layer');
    add?.click();
    expect(onAdd).toHaveBeenCalledWith(add);
  });

  it('Given a layer turned off from the dock, Then the focus goes to Add, not to nothing', () => {
    const humans = button('humans', 'Humans');
    const sealevel = button('sealevel', 'Sea level');
    const dock = layerDock(
      { onAddLayer: () => undefined, onGoTo: () => undefined },
      sealevel,
      humans,
    );
    document.body.append(dock.root);
    dock.render(activeLayers(at('ma=0.315&scale=ice&layers=humans,sealevel')));
    expect(humans.hasAttribute('data-off')).toBe(false);
    humans.focus();
    humans.click();
    dock.render(activeLayers(at('ma=0.315&scale=ice&layers=sealevel')));
    expect(humans.hasAttribute('data-off')).toBe(true);
    expect(document.activeElement).toBe(dock.root.querySelector('.deep-add'));
    // A render with no press moves nothing.
    sealevel.focus();
    dock.render(activeLayers(at('ma=0.315&scale=ice&layers=sealevel')));
    expect(document.activeElement).toBe(sealevel);
    dock.root.remove();
  });

  it('Given the page drawn again within the press itself, Then the focus still goes to Add', () => {
    const humans = button('humans', 'Humans');
    const dock = layerDock({ onAddLayer: () => undefined, onGoTo: () => undefined }, humans);
    document.body.append(dock.root);
    dock.render(activeLayers(at('ma=0.315&scale=ice&layers=humans')));
    humans.addEventListener('click', () => {
      dock.render(activeLayers(at('ma=0.315&scale=ice')));
    });
    humans.focus();
    humans.click();
    expect(document.activeElement).toBe(dock.root.querySelector('.deep-add'));
    dock.root.remove();
  });
});

describe('the dock says in words a phone shows why a layer on draws nothing (#751)', () => {
  it('Given plates on before their record, Then a line says so and goes to their oldest; it is kept while unchanged', () => {
    const plates = button('plates', 'Plates');
    const went: string[] = [];
    const dock = layerDock(
      { onAddLayer: () => undefined, onGoTo: (to) => went.push(to.label) },
      plates,
    );
    const state = at('ma=2000&scale=eons&layers=plates');
    dock.render(activeLayers(state));
    const line = dock.root.querySelector('.deep-dock-why');
    expect(line?.textContent).toMatch(/^Plates: none before 1,800 million years ago Go to /);
    line?.querySelector('button')?.click();
    expect(went).toHaveLength(1);
    dock.render(activeLayers(state));
    expect(dock.root.querySelector('.deep-dock-why')).toBe(line);
  });

  it('Given a layer loading, Then it says so with no step; once it draws, the line goes', () => {
    const sealevel = button('sealevel', 'Sea level');
    const dock = layerDock({ onAddLayer: () => undefined, onGoTo: () => undefined }, sealevel);
    const state = at('ma=0.315&scale=ice&layers=sealevel');
    dock.render(activeLayers(state, [['sealevel', { state: 'loading' }]]));
    expect(dock.root.querySelector('.deep-dock-why')?.textContent).toBe('Sea level: loading…');
    expect(dock.root.querySelector('.deep-dock-why button')).toBeNull();
    dock.render(activeLayers(state));
    expect(dock.root.querySelector('.deep-dock-why')).toBeNull();
  });
});
