// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BufferAttribute, Mesh, MeshBasicMaterial, Points } from 'three';
import { Group } from 'three';

import type { LayerHost } from '../../globe/layerHost';
import { discLayer } from './discLayer';

function layer(options: { lessMotion?: boolean; phone?: boolean } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced') ? options.lessMotion === true : options.phone === true,
  }));
  const spinAxis = new Group();
  const container = document.createElement('div');
  const made = discLayer({ spinAxis, container, requestRender: vi.fn() } as unknown as LayerHost);
  const group = spinAxis.children[0] as Group;
  const [haze, ...swarms] = group.children as [Mesh<never, MeshBasicMaterial>, ...Points[]];
  const lit = (): number =>
    swarms.reduce((sum, points) => {
      const colours = points.geometry.getAttribute('color') as BufferAttribute;
      let count = 0;
      for (let index = 0; index < colours.count; index += 1)
        if (colours.getX(index) > 0) count += 1;
      return sum + count;
    }, 0);
  const firstPlace = (): number[] => {
    const positions = swarms[0]?.geometry.getAttribute('position') as BufferAttribute;
    return [positions.getX(0), positions.getZ(0)];
  };
  return { made, group, haze, swarms, container, lit, firstPlace };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the disc round the growing Earth, on the globe (#1219)', () => {
  it('draws nothing when taken away', () => {
    const { made, group, container } = layer();
    made.update(null);
    expect(group.visible).toBe(false);
    expect(container.dataset['formationDisc']).toBe('off');
  });

  it('hazes with gas early, the swarm thick; clear of gas later, the swarm thinner', () => {
    const { made, haze, container, lit } = layer();
    made.update({ myr: 0.5, growth: 'slow' });
    expect(container.dataset['formationDisc']).toBe('gas');
    expect(haze.material.opacity).toBeCloseTo(0.25);
    const early = lit();
    made.update({ myr: 20, growth: 'slow' });
    expect(container.dataset['formationDisc']).toBe('swarm');
    expect(haze.visible).toBe(false);
    expect(lit()).toBeLessThan(early);
    made.update({ myr: 400, growth: 'slow' });
    expect(container.dataset['formationDisc']).toBe('clear');
  });

  it('sweeps faster with the pebbles', () => {
    const slow = layer();
    slow.made.update({ myr: 4, growth: 'slow' });
    const fast = layer();
    fast.made.update({ myr: 4, growth: 'fast' });
    expect(fast.lit()).toBeLessThan(slow.lit());
  });

  it('draws fewer pieces on a phone', () => {
    const phone = layer({ phone: true });
    phone.made.update({ myr: 0.01, growth: 'slow' });
    const desk = layer();
    desk.made.update({ myr: 0.01, growth: 'slow' });
    expect(phone.lit()).toBeLessThan(desk.lit());
  });

  it('streams while it plays, and stands still for less motion', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const playing = layer();
    playing.made.update({ myr: 0.5, growth: 'slow' });
    const before = playing.firstPlace();
    vi.advanceTimersByTime(150);
    playing.made.update({ myr: 0.5, growth: 'slow' });
    expect(playing.firstPlace()).not.toEqual(before);

    const still = layer({ lessMotion: true });
    still.made.update({ myr: 0.5, growth: 'slow' });
    const resting = still.firstPlace();
    vi.advanceTimersByTime(150);
    still.made.update({ myr: 0.5, growth: 'slow' });
    expect(still.firstPlace()).toEqual(resting);
  });

  it('lets go of what it made', () => {
    const { made, group } = layer();
    made.dispose?.();
    expect(group.parent).toBeNull();
  });
});
