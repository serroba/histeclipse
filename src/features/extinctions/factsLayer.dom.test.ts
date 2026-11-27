// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import type { GeoPoint } from '../../core/geo';
import type { LayerHost, SurfacePin } from '../../globe/layerHost';
import { factsLayer, type PinnedFact } from './factsLayer';

function layer() {
  const shown: (readonly SurfacePin[] | null)[] = [];
  const moved: (readonly GeoPoint[])[] = [];
  const container = document.createElement('div');
  const made = factsLayer({
    container,
    surfaceLabels: () => ({
      show: (pins: readonly SurfacePin[] | null) => shown.push(pins),
      move: (points: readonly GeoPoint[]) => moved.push(points),
    }),
  } as unknown as LayerHost);
  return { made, shown, moved, container };
}

const FACT: PinnedFact = {
  id: 'meishan@0',
  point: { latitude: 0, longitude: 110 },
  text: 'The sea’s surface warms by about 8 °C.',
  source: 'Joachimski et al. 2012',
};

describe('key facts pinned on the globe (#1268)', () => {
  it('shows each fact as a card at its place, saying whose it is', () => {
    const { made, shown, container } = layer();
    made.update([FACT]);
    const [pin] = shown.at(-1) ?? [];
    expect(pin?.element.className).toBe('empire-label extinction-fact');
    expect(pin?.element.querySelector('.extinction-fact-text')?.textContent).toBe(FACT.text);
    expect(pin?.element.querySelector('.extinction-fact-source')?.textContent).toBe(FACT.source);
    expect(pin?.point).toBe(FACT.point);
    expect(container.dataset['facts']).toBe('1');
  });

  it('moves the same facts with their plates, and takes them away when there are none', () => {
    const { made, shown, moved, container } = layer();
    made.update([FACT]);
    made.update([{ ...FACT, point: { latitude: 1, longitude: 110 } }]);
    expect(shown).toHaveLength(1);
    expect(moved).toEqual([[{ latitude: 1, longitude: 110 }]]);
    made.update(null);
    made.update(null);
    expect(shown.at(-1)).toBeNull();
    expect(container.dataset['facts']).toBe('0');
  });
});
