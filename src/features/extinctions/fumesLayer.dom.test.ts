// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Group, Mesh, MeshBasicMaterial, Sprite } from 'three';

import type { LayerHost } from '../../globe/layerHost';
import { fumesLayer } from './fumesLayer';

const KYR = 1000 * 365.25 * 86_400;
const center = { latitude: 56, longitude: 36 };

function layer(lessMotion = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: lessMotion }));
  const added: Group[] = [];
  const container = document.createElement('div');
  const requestRender = vi.fn();
  const made = fumesLayer({
    container,
    requestRender,
    onEarth: { add: (group: Group) => added.push(group) },
  } as unknown as LayerHost);
  const group = added[0];
  if (group === undefined) throw new Error('nothing added');
  const sprites = group.children.filter((child): child is Sprite => child.type === 'Sprite');
  const haze = group.children.find((child): child is Mesh => child.type === 'Mesh');
  return { made, group, sprites, haze, container, requestRender };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the Siberian Traps fuming on the globe (#1192)', () => {
  it('is hidden before the first lavas and when taken away', () => {
    const { made, group, container } = layer();
    made.update({ center, seconds: -350 * KYR });
    expect(group.visible).toBe(false);
    made.update(null);
    expect(group.visible).toBe(false);
    expect(container.dataset['fumes']).toBe('off');
  });

  it('fumes dark over the traps as the extinction begins, the haze over the globe', () => {
    const { made, group, sprites, haze, container } = layer();
    made.update({ center, seconds: 30 * KYR });
    expect(group.visible).toBe(true);
    expect(container.dataset['fumes']).toBe('on');
    expect(sprites.some((sprite) => sprite.material.opacity > 0.3)).toBe(true);
    expect(sprites[0]?.material.color.r).toBeLessThan(0.3);
    expect((haze?.material as MeshBasicMaterial).opacity).toBeCloseTo(0.22);
  });

  it('rises with the time between moments while it plays, and stands still for less motion', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const playing = layer();
    playing.made.update({ center, seconds: 30 * KYR });
    const before = playing.sprites[0]?.position.clone();
    vi.advanceTimersByTime(100);
    playing.made.update({ center, seconds: 30 * KYR });
    expect(playing.sprites[0]?.position.equals(before ?? playing.sprites[0].position)).toBe(false);

    const still = layer(true);
    still.made.update({ center, seconds: 30 * KYR });
    const at = still.sprites[0]?.position.clone();
    vi.advanceTimersByTime(100);
    still.made.update({ center, seconds: 30 * KYR });
    expect(still.sprites[0]?.position.equals(at ?? still.sprites[0].position)).toBe(true);
  });

  it('moves its vents with the traps’ place, and lets go of all it made', () => {
    const { made, sprites } = layer();
    made.update({ center, seconds: 30 * KYR });
    const there = sprites[0]?.position.clone();
    made.update({ center: { latitude: 10, longitude: 0 }, seconds: 30 * KYR });
    expect(sprites[0]?.position.distanceTo(there ?? sprites[0].position)).toBeGreaterThan(0.1);
    expect(() => made.dispose?.()).not.toThrow();
  });
});
