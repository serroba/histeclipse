import { type Texture, Vector2, Vector3 } from 'three';
import type * as Three from 'three';
import { describe, expect, it, vi } from 'vitest';
import { IDENTITY } from '../astro/matrix';
import { SkyMoon } from './skyMoon';

const loaded: (() => void)[] = [];
vi.mock('three', async (actual) => {
  const three = await actual<typeof Three>();
  return {
    ...three,
    // No images in tests: the map arrives when the test says so.
    TextureLoader: class {
      load(_url: string, onLoad: () => void): Texture {
        loaded.push(onLoad);
        return new three.Texture();
      }
    },
  };
});

function moon() {
  const dataset: DOMStringMap = {};
  const invalidate = vi.fn();
  const made = new SkyMoon({
    projection: {
      skyScale: { value: new Vector2(1, 1) },
      skyShift: { value: new Vector2() },
      skyClip: { value: 0 },
      skyViewport: { value: new Vector2(1, 1) },
    },
    sunDirection: { value: new Vector3(0, -1, 0) },
    textureUrl: 'moon.jpg',
    dataset,
    invalidate,
  });
  return { made, dataset, invalidate };
}

const SUN: [number, number, number] = [149_600_000, 0, 0];
const moment = {
  horizon: IDENTITY,
  sunJ2000: SUN,
  sunHere: SUN,
  sunHigh: -30,
  motion: [0, 0, 0] as [number, number, number],
};

describe('SkyMoon', () => {
  it('is hidden until placed, and asks for a drawing when its map arrives', () => {
    const { made, invalidate } = moon();
    expect(made.mesh.visible).toBe(false);
    loaded.at(-1)?.();
    expect(invalidate).toHaveBeenCalled();
  });

  it('stands overhead at its size, lit from the side, and says so', () => {
    const { made, dataset } = moon();
    const overhead: [number, number, number] = [0, 0, 384_400];
    made.place({ ...moment, moonJ2000: overhead, moonHere: overhead });
    expect(made.mesh.visible).toBe(true);
    expect(made.mesh.position.y).toBeCloseTo(70);
    expect(made.angularRadius).toBeCloseTo(0.259, 2);
    expect(Number(dataset['moonAltitude'])).toBeCloseTo(90, 1);
    expect(Number(dataset['moonPhase'])).toBeCloseTo(0.5, 2);
    expect(dataset['moonSunlight']).toBeDefined();
  });

  it('hides below the horizon, and with no Moon to place', () => {
    const { made } = moon();
    const below: [number, number, number] = [0, 0, -384_400];
    made.place({ ...moment, moonJ2000: below, moonHere: below });
    expect(made.mesh.visible).toBe(false);
    made.mesh.visible = true;
    made.place({ ...moment, moonJ2000: null, moonHere: null });
    expect(made.mesh.visible).toBe(false);
  });
});
