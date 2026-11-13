import { CanvasTexture, type ShaderMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createSkyDome } from './skyDome';
import { projectionUniforms } from '../test/fakes';
import { SkySun } from './skySun';

// The glare's and the corona's textures are drawn on a canvas: not in unit tests.
vi.mock('./skyTextures', () => ({
  glowTexture: () => new CanvasTexture(undefined),
  coronaTexture: () => new CanvasTexture(undefined),
}));

const PROJECTION = projectionUniforms();

function sun(fov = 60) {
  const view = { fov };
  return { made: new SkySun(PROJECTION, () => view.fov), view };
}

const glare = (made: SkySun): number =>
  ((made.glow.material as ShaderMaterial).uniforms['opacity']?.value as number | undefined) ?? NaN;

describe('SkySun', () => {
  it('is due south and below until placed, the corona hidden', () => {
    const { made } = sun();
    expect(made.light.sunAltitude.value).toBe(-90);
    expect(made.corona.visible).toBe(false);
    expect([made.disc, made.glow, made.corona].map(({ renderOrder }) => renderOrder)).toEqual([
      3, 3, 3,
    ]);
  });

  it('stands where it is seen, lights the sky, and shows its glare', () => {
    const { made } = sun();
    made.place({ seen: [0, 0, 1], altitude: 90, share: 1 });
    expect(made.disc.position.y).toBeCloseTo(80);
    expect(made.glow.position.equals(made.disc.position)).toBe(true);
    expect(made.light.sunDirection.value.y).toBe(1);
    expect(made.light.sunAltitude.value).toBe(90);
    expect(made.light.sunlight.value).toBe(1);
    expect([made.disc.visible, made.glow.visible, made.corona.visible]).toEqual([
      true,
      true,
      false,
    ]);
    expect(glare(made)).toBe(1);
  });

  it('shows the corona when the Moon covers the whole bright disc, and no glare', () => {
    const { made } = sun();
    made.place({ seen: [0, 0, 1], altitude: 40, share: 0 });
    expect(made.corona.visible).toBe(true);
    expect(made.glow.visible).toBe(false);
    expect(made.light.sunlight.value).toBe(0);
  });

  it('hides below the horizon', () => {
    const { made } = sun();
    made.place({ seen: [0, 1, -0.5], altitude: -20, share: 1 });
    expect([made.disc.visible, made.glow.visible, made.corona.visible]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('fades the glare as the view closes in, and as the Moon covers the Sun', () => {
    const { made, view } = sun(60);
    made.place({ seen: [0, 0, 1], altitude: 90, share: 0.1 });
    expect(glare(made)).toBeCloseTo(0.4);
    view.fov = 4;
    made.showGlow();
    expect(glare(made)).toBeCloseTo(0.4 * 0.2);
    view.fov = 1;
    made.showGlow();
    expect(glare(made)).toBeCloseTo(0.4 * 0.1);
  });
});

describe('createSkyDome', () => {
  it('lights the dome and the ground with the Sun’s light, the ground drawn last', () => {
    const { made } = sun();
    const { dome, ground } = createSkyDome(PROJECTION, made.light);
    const uniforms = (mesh: typeof dome) => (mesh.material as ShaderMaterial).uniforms;
    expect(uniforms(dome)['sunDirection']).toBe(made.light.sunDirection);
    expect(uniforms(ground)['sunlight']).toBe(made.light.sunlight);
    expect([dome.renderOrder, ground.renderOrder]).toEqual([0, 4]);
    expect((ground.material as ShaderMaterial).transparent).toBe(true);
  });
});
