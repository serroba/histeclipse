// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Group, Mesh, MeshBasicMaterial, Sprite } from 'three';

import type { LayerHost } from '../../globe/layerHost';
import { fumesLayer } from './fumesLayer';
import { LAVA_FLOWS_PART } from './lavaFlowsPart';
import { siberianFuming } from './fumesModel';

const KYR = 1000 * 365.25 * 86_400;
const center = { latitude: 56, longitude: 36 };

function layer(lessMotion = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: lessMotion }));
  const added: Group[] = [];
  const container = document.createElement('div');
  const requestRender = vi.fn();
  const lava = LAVA_FLOWS_PART.uniforms();
  const made = fumesLayer({
    container,
    requestRender,
    onEarth: { add: (group: Group) => added.push(group) },
    earthPart: () => lava,
  } as unknown as LayerHost);
  const group = added[0];
  if (group === undefined) throw new Error('nothing added');
  const sprites = group.children.filter((child): child is Sprite => child.type === 'Sprite');
  const haze = group.children.find((child): child is Mesh => child.type === 'Mesh');
  return { made, group, sprites, haze, container, requestRender, lava };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the Siberian Traps fuming on the globe (#1192)', () => {
  it('is hidden before the first lavas and when taken away', () => {
    const { made, group, container } = layer();
    made.update({ center, spread: 9, fuming: siberianFuming(-350 * KYR), cover: 0.5 });
    expect(group.visible).toBe(false);
    made.update(null);
    expect(group.visible).toBe(false);
    expect(container.dataset['fumes']).toBe('off');
  });

  it('fumes dark over the traps as the extinction begins, the haze over the globe', () => {
    const { made, group, sprites, haze, container } = layer();
    made.update({ center, spread: 9, fuming: siberianFuming(30 * KYR), cover: 0.5 });
    expect(group.visible).toBe(true);
    expect(container.dataset['fumes']).toBe('on');
    expect(sprites.some((sprite) => sprite.material.opacity > 0.3)).toBe(true);
    expect(sprites[0]?.material.color.r).toBeLessThan(0.3);
    expect((haze?.material as MeshBasicMaterial).opacity).toBeCloseTo(0.35);
  });

  it('rises with the time between moments while it plays, and stands still for less motion', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const playing = layer();
    playing.made.update({ center, spread: 9, fuming: siberianFuming(30 * KYR), cover: 0.5 });
    const before = playing.sprites[0]?.position.clone();
    vi.advanceTimersByTime(100);
    playing.made.update({ center, spread: 9, fuming: siberianFuming(30 * KYR), cover: 0.5 });
    expect(playing.sprites[0]?.position.equals(before ?? playing.sprites[0].position)).toBe(false);

    const still = layer(true);
    still.made.update({ center, spread: 9, fuming: siberianFuming(30 * KYR), cover: 0.5 });
    const at = still.sprites[0]?.position.clone();
    vi.advanceTimersByTime(100);
    still.made.update({ center, spread: 9, fuming: siberianFuming(30 * KYR), cover: 0.5 });
    expect(still.sprites[0]?.position.equals(at ?? still.sprites[0].position)).toBe(true);
  });

  it('moves its vents with the traps’ place, and lets go of all it made', () => {
    const { made, sprites } = layer();
    made.update({ center, spread: 9, fuming: siberianFuming(30 * KYR), cover: 0.5 });
    const there = sprites[0]?.position.clone();
    made.update({
      center: { latitude: 10, longitude: 0 },
      spread: 9,
      fuming: siberianFuming(30 * KYR),
      cover: 0.5,
    });
    expect(sprites[0]?.position.distanceTo(there ?? sprites[0].position)).toBeGreaterThan(0.1);
    expect(() => made.dispose?.()).not.toThrow();
  });

  it('lets the lava flow over the land as far as it has erupted, hot while it erupts, and fountain at the vents (#1212)', () => {
    const { made, lava, sprites } = layer();
    made.update({ center, spread: 9, fuming: siberianFuming(30 * KYR), cover: 0.8 });
    expect(lava.lavaCover.value).toBe(0.8);
    expect(lava.lavaHeat.value).toBe(1);
    const [vent] = lava.lavaVents.value;
    expect(vent?.w).toBeCloseTo((0.7 * 9 * Math.PI) / 180);
    expect(Math.hypot(vent?.x ?? 0, vent?.y ?? 0, vent?.z ?? 0)).toBeCloseTo(1);
    // Some of the sprites are the fountains' glowing drops, lit while the lava erupts.
    const lit = sprites.filter(
      (sprite) => sprite.material.blending === 2 && sprite.material.opacity > 0,
    );
    expect(lit.length).toBeGreaterThan(18);
    made.update(null);
    expect(lava.lavaCover.value).toBe(0);
    expect(lava.lavaHeat.value).toBe(0);
  });
});
