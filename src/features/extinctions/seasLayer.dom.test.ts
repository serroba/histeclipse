// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { Group, Mesh } from 'three';

import type { LayerHost } from '../../globe/layerHost';
import { ANOXIC_SEAS_PART } from './anoxicSeasPart';
import { seasLayer } from './seasLayer';

function layer() {
  const added: Group[] = [];
  const container = document.createElement('div');
  const uniforms = ANOXIC_SEAS_PART.uniforms();
  const made = seasLayer({
    container,
    requestRender: vi.fn(),
    onEarth: { add: (group: Group) => added.push(group) },
    earthPart: () => uniforms,
  } as unknown as LayerHost);
  const group = added[0];
  if (group === undefined) throw new Error('nothing added');
  const [ice] = group.children as Mesh[];
  if (ice === undefined) throw new Error('no ice');
  return { made, group, ice, uniforms, container };
}

const anoxia = { latitude: 10, longitude: 0 };

describe('the cold and the suffocating seas on the globe (#1202)', () => {
  it('shows the ice as far as it reaches, and the oxygen-poor water as strongly as it spreads', () => {
    const { made, group, ice, uniforms, container } = layer();
    const pole = { latitude: -80, longitude: 0 };
    made.update({ ice: pole, anoxia, spread: 22, seas: { ice: 30, anoxia: 0.5 } });
    expect(group.visible).toBe(true);
    expect(container.dataset['seas']).toBe('on');
    expect(ice.visible).toBe(true);
    const reach = (ice.geometry as unknown as { parameters: { thetaLength: number } }).parameters;
    expect(reach.thetaLength).toBeCloseTo((30 * Math.PI) / 180);
    expect(uniforms.anoxiaStrength.value).toBe(0.5);
    // Its patches round the place, each reaching a few degrees.
    const [first] = uniforms.anoxiaPatches.value;
    expect(first?.w).toBeCloseTo((5 * Math.PI) / 180);
    expect(Math.hypot(first?.x ?? 0, first?.y ?? 0, first?.z ?? 0)).toBeCloseTo(1);
    // The same places again: nothing turned anew; the ice melted to nothing: hidden.
    made.update({ ice: pole, anoxia, spread: 22, seas: { ice: 0, anoxia: 0 } });
    expect(ice.visible).toBe(false);
    expect(uniforms.anoxiaStrength.value).toBe(0);
  });

  it('has no ice where the crisis had none, and goes when taken away', () => {
    const { made, group, ice, uniforms, container } = layer();
    made.update({ ice: null, anoxia, spread: 22, seas: { ice: 0, anoxia: 1 } });
    expect(ice.visible).toBe(false);
    made.update(null);
    expect(uniforms.anoxiaStrength.value).toBe(0);
    expect(group.visible).toBe(false);
    expect(container.dataset['seas']).toBe('off');
    expect(() => made.dispose?.()).not.toThrow();
  });
});

describe('the seas’ soft edge (#1202)', () => {
  it('fades the caps out to their rim where the page can draw it', () => {
    const stops: string[] = [];
    const context = {
      createLinearGradient: () => ({
        addColorStop: (_: number, colour: string) => stops.push(colour),
      }),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    layer();
    expect(stops).toEqual(['#fff', '#fff', '#000']);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1, 64);
    getContext.mockRestore();
  });
});
