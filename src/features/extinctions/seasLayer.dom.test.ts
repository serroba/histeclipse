// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { Group, Mesh, MeshBasicMaterial } from 'three';

import type { LayerHost } from '../../globe/layerHost';
import { seasLayer } from './seasLayer';

function layer() {
  const added: Group[] = [];
  const container = document.createElement('div');
  const made = seasLayer({
    container,
    requestRender: vi.fn(),
    onEarth: { add: (group: Group) => added.push(group) },
  } as unknown as LayerHost);
  const group = added[0];
  if (group === undefined) throw new Error('nothing added');
  const [ice, ...patches] = group.children as Mesh[];
  if (ice === undefined) throw new Error('no ice');
  return { made, group, ice, patches, container };
}

const opacity = (mesh: Mesh | undefined) => (mesh?.material as MeshBasicMaterial).opacity;
const anoxia = { latitude: 10, longitude: 0 };

describe('the cold and the suffocating seas on the globe (#1202)', () => {
  it('shows the ice as far as it reaches, and the oxygen-poor water as strongly as it spreads', () => {
    const { made, group, ice, patches, container } = layer();
    const pole = { latitude: -80, longitude: 0 };
    made.update({ ice: pole, anoxia, spread: 22, seas: { ice: 30, anoxia: 0.5 } });
    expect(group.visible).toBe(true);
    expect(container.dataset['seas']).toBe('on');
    expect(ice.visible).toBe(true);
    const reach = (ice.geometry as unknown as { parameters: { thetaLength: number } }).parameters;
    expect(reach.thetaLength).toBeCloseTo((30 * Math.PI) / 180);
    expect(opacity(patches[0])).toBeCloseTo(0.275);
    // The same places again: nothing turned anew; the ice melted to nothing: hidden.
    made.update({ ice: pole, anoxia, spread: 22, seas: { ice: 0, anoxia: 0 } });
    expect(ice.visible).toBe(false);
    expect(patches[0]?.visible).toBe(false);
  });

  it('has no ice where the crisis had none, and goes when taken away', () => {
    const { made, group, ice, container } = layer();
    made.update({ ice: null, anoxia, spread: 22, seas: { ice: 0, anoxia: 1 } });
    expect(ice.visible).toBe(false);
    made.update(null);
    expect(group.visible).toBe(false);
    expect(container.dataset['seas']).toBe('off');
    expect(() => made.dispose?.()).not.toThrow();
  });
});
