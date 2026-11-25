// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import sites from '../../../public/data/extinctions.json';
import type { ExtinctionSites } from '../../data/extinctions';
import type { GeoPoint } from '../../core/geo';
import type { LayerHost, SurfacePin } from '../../globe/layerHost';
import { extinctionLayer } from './extinctionLayer';
import { extinctionMarks } from './view';

const DATA = sites as ExtinctionSites;

function layer() {
  const shown: (readonly SurfacePin[] | null)[] = [];
  const moved: (readonly GeoPoint[])[] = [];
  const container = document.createElement('div');
  const made = extinctionLayer({
    container,
    pickable: () => undefined,
    surfaceLabels: () => ({
      show: (pins: readonly SurfacePin[] | null) => shown.push(pins),
      move: (points: readonly GeoPoint[]) => moved.push(points),
    }),
  } as unknown as LayerHost);
  return { made, shown, moved, container };
}

describe('the extinctions on the globe', () => {
  it('Given the end-Cretaceous, Then its causes are rings and where it is dated a dot, each named', () => {
    const { made, shown, container } = layer();
    made.update(extinctionMarks(DATA, 66));
    const pins = shown.at(-1) ?? [];
    expect(pins.map((pin) => [pin.element.textContent, pin.element.className])).toEqual([
      ['Chicxulub', 'empire-label extinction-mark is-cause'],
      ['Deccan Traps, Western Ghats', 'empire-label extinction-mark is-cause'],
      ['El Kef, Tunisia', 'empire-label extinction-mark is-record'],
      ['Bottaccione Gorge, Gubbio', 'empire-label extinction-mark is-record'],
    ]);
    expect(pins[0]?.element.dataset['pick']).toBe('extinction:chicxulub');
    expect(pins[0]?.element.getAttribute('aria-label')).toBe(
      'Chicxulub, End-Cretaceous extinction: details',
    );
    expect(container.dataset['extinctions']).toBe('4');
  });

  it('Given the same places as time plays on, Then they are moved with their plates, not laid out again', () => {
    const { made, shown, moved } = layer();
    made.update(extinctionMarks(DATA, 66));
    made.update(extinctionMarks(DATA, 65));
    expect(shown).toHaveLength(1);
    expect(moved).toHaveLength(1);
  });

  it('Given the layer off, Then nothing is shown, and the same again changes nothing', () => {
    const { made, shown, moved, container } = layer();
    made.update(null);
    made.update(null);
    expect(shown).toEqual([null]);
    expect(moved).toEqual([]);
    expect(container.dataset['extinctions']).toBe('off');
  });
});
