// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createDeepIceNotes, type DeepIceView } from './deepIceNotes';

const why = (): HTMLElement => document.createElement('button');

const VIEW: DeepIceView = {
  ice: { drawn: true, oldestKa: 80, standIn: null },
  iceOutlines: null,
  plateMotion: 'The plates have moved.',
  seaIce: { model: 'miroc-es2l', mix: 1 },
  coastline: {
    coast: 'spratt-2016',
    seaLevel: -120,
    label: 'Spratt & Lisiecki 2016',
    instead: null,
  },
};

function mount() {
  const onSeaIce = vi.fn();
  const onCoast = vi.fn();
  const notes = createDeepIceNotes({ iceWhy: why(), coastWhy: why(), onSeaIce, onCoast });
  return { notes, onSeaIce, onCoast };
}

describe('deep time’s ice-age notes', () => {
  it('Given the ice ages, Then the ice note with its plate motion and model, and the coast with its source', () => {
    const { notes } = mount();
    notes.render(true, VIEW);
    expect(notes.ice.hidden).toBe(false);
    expect(notes.ice.querySelector('[data-testid="plate-motion"]')?.textContent).toBe(
      'The plates have moved.',
    );
    expect(notes.ice.querySelector('[data-testid="ice-outlines"]')?.hasAttribute('hidden')).toBe(
      true,
    );
    expect(notes.ice.querySelector('select')?.value).toBe('miroc-es2l');
    expect(notes.coast.hidden).toBe(false);
    expect(notes.coast.querySelector('select')?.value).toBe('spratt-2016');
  });

  it('Given no coast, sea ice or motion, Then those are hidden or left as they were', () => {
    const { notes } = mount();
    notes.render(false, { ...VIEW, coastline: null, seaIce: null, plateMotion: null });
    expect(notes.ice.hidden).toBe(true);
    expect(notes.coast.hidden).toBe(true);
    expect(notes.ice.querySelector('[data-testid="plate-motion"]')?.hasAttribute('hidden')).toBe(
      true,
    );
  });

  it('Given a model or a coast picked, Then it is reported; an unknown one is not', () => {
    const { notes, onSeaIce, onCoast } = mount();
    const [seaIce, coast] = [
      notes.ice.querySelector('select'),
      notes.coast.querySelector('select'),
    ];
    if (seaIce === null || coast === null) throw new Error('missing pickers');
    seaIce.value = 'awi-esm-1-1-lr';
    seaIce.dispatchEvent(new Event('change'));
    coast.value = 'bintanja-2008';
    coast.dispatchEvent(new Event('change'));
    expect(onSeaIce).toHaveBeenCalledWith('awi-esm-1-1-lr');
    expect(onCoast).toHaveBeenCalledWith('bintanja-2008');
    for (const select of [seaIce, coast]) {
      select.append(Object.assign(document.createElement('option'), { value: 'nonsense' }));
      select.value = 'nonsense';
      select.dispatchEvent(new Event('change'));
    }
    expect(onSeaIce).toHaveBeenCalledTimes(1);
    expect(onCoast).toHaveBeenCalledTimes(1);
  });
});
