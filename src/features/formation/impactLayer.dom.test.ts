// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BufferAttribute, Mesh, Points, ShaderMaterial, Sprite } from 'three';
import { Group, PerspectiveCamera, type BufferGeometry } from 'three';

import type { LayerHost } from '../../globe/layerHost';
import { impactLayer } from './impactLayer';
import { CANONICAL } from './impactModel';

/** The canonical hit at `seconds` since it. */
const at = (seconds: number) => ({ seconds, hit: CANONICAL });

const HOUR = 3600;
const DAY = 86_400;
const YEAR = 365.25 * DAY;

function layer(options: { lessMotion?: boolean; phone?: boolean } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced') ? options.lessMotion === true : options.phone === true,
  }));
  const spinAxis = new Group();
  const container = document.createElement('div');
  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, 22);
  const requestRender = vi.fn();
  const made = impactLayer({
    spinAxis,
    container,
    camera,
    requestRender,
    afterRender: vi.fn(),
  } as unknown as LayerHost);
  const group = spinAxis.children[0] as Group;
  const [theia, moon, moonGlow, flash, debris] = group.children as [
    Mesh<BufferGeometry, ShaderMaterial>,
    Mesh<BufferGeometry, ShaderMaterial>,
    Sprite,
    Sprite,
    Points,
  ];
  const lit = (): number => {
    const colours = debris.geometry.getAttribute('color') as BufferAttribute;
    let count = 0;
    for (let index = 0; index < colours.count; index += 1) if (colours.getX(index) > 0) count += 1;
    return count;
  };
  return { made, group, theia, moon, moonGlow, flash, debris, container, requestRender, lit };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the giant impact on the globe (#180)', () => {
  it('draws nothing until Theia comes in, and nothing once taken away', () => {
    const { made, group, container } = layer();
    made.update(null);
    expect(group.visible).toBe(false);
    expect(container.dataset['formationImpact']).toBe('off');
  });

  it('brings Theia in alone, then the flash and the debris as it strikes', () => {
    const { made, group, theia, flash, debris, moon, container, lit } = layer();
    made.update(at(-HOUR));
    expect(group.visible).toBe(true);
    expect(container.dataset['formationImpact']).toBe('theia');
    expect(theia.visible).toBe(true);
    expect(flash.visible).toBe(false);
    expect(debris.visible).toBe(false);
    made.update(at(10 * 60));
    expect(container.dataset['formationImpact']).toBe('debris');
    expect(flash.visible).toBe(true);
    expect(flash.material.opacity).toBeGreaterThan(0.5);
    expect(lit()).toBe(800);
    expect(moon.visible).toBe(false);
  });

  it('gathers the Moon, molten, and clears the disc within a century', () => {
    const { made, theia, moon, moonGlow, debris, container, lit } = layer();
    made.update(at(YEAR));
    expect(container.dataset['formationImpact']).toBe('moon');
    expect(theia.visible).toBe(false);
    expect(moon.visible).toBe(true);
    expect(moonGlow.visible).toBe(true);
    expect(lit()).toBeGreaterThan(0);
    made.update(at(200 * YEAR));
    expect(debris.visible).toBe(false);
    expect(moon.scale.x).toBeCloseTo(0.273);
    made.update(at(2e7 * YEAR));
    expect(moonGlow.visible).toBe(false);
  });

  it('draws fewer pieces on a phone', () => {
    const { made, lit } = layer({ phone: true });
    made.update(at(HOUR));
    expect(lit()).toBe(300);
  });

  it('turns the Moon while it plays, and holds it still for less motion', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const playing = layer();
    playing.made.update(at(YEAR));
    const before = playing.moon.position.clone();
    vi.advanceTimersByTime(150);
    playing.made.update(at(YEAR));
    expect(playing.moon.position.distanceTo(before)).toBeGreaterThan(0);

    const still = layer({ lessMotion: true });
    still.made.update(at(YEAR));
    const resting = still.moon.position.clone();
    vi.advanceTimersByTime(150);
    still.made.update(at(YEAR));
    expect(still.moon.position.distanceTo(resting)).toBe(0);
  });

  it('turns the strike to face the reader when it opens, and lets go of what it made', () => {
    const { made, group } = layer();
    made.update(at(0));
    const turned = group.rotation.y;
    made.update(at(HOUR));
    expect(group.rotation.y).toBe(turned);
    made.dispose?.();
    expect(group.parent).toBeNull();
  });
});
