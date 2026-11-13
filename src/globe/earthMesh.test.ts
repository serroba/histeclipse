import { BackSide, type ShaderMaterial, Texture, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { EarthPart } from './earthParts';
import { createEarthMeshes, MOON_RGB, plainTexture } from './earthMesh';

function light() {
  return {
    sunDirection: new Vector3(1, 0, 0),
    evenLight: { value: 0 },
    moonPosition: new Vector3(),
    sunPosition: new Vector3(1e5, 0, 0),
  };
}

const GLOW: EarthPart = {
  name: 'glow',
  order: 10,
  glsl: /* glsl */ `
    uniform float glowStrength;
    vec3 glow(vec3 color, EarthFragment f) { return color + glowStrength; }
  `,
  uniforms: () => ({ glowStrength: { value: 0.5 } }),
};

describe('plainTexture', () => {
  it('is one pixel of one colour', () => {
    const texture = plainTexture(MOON_RGB);
    expect([...(texture.image.data as Uint8Array)]).toEqual([128, 126, 122, 255]);
    expect(texture.image.width).toBe(1);
  });
});

describe('createEarthMeshes', () => {
  it('wears the plain ocean until its map arrives, the overlay painted over it', () => {
    const overlay = new Texture();
    const { earth, plainMap } = createEarthMeshes(light(), overlay, []);
    const { uniforms } = earth.material;
    expect(uniforms['dayMap']?.value).toBe(plainMap);
    expect([...(plainMap.image.data as Uint8Array)]).toEqual([11, 28, 66, 255]);
    expect(uniforms['overlayMap']?.value).toBe(overlay);
  });

  it('shares the light with what sets it: the same vectors and even light', () => {
    const shared = light();
    const { earth, atmosphere } = createEarthMeshes(shared, new Texture(), []);
    expect(earth.material.uniforms['sunDirection']?.value).toBe(shared.sunDirection);
    expect(earth.material.uniforms['moonPosition']?.value).toBe(shared.moonPosition);
    expect(earth.material.uniforms['evenLight']).toBe(shared.evenLight);
    const air = atmosphere.material as ShaderMaterial;
    expect(air.uniforms['sunDirection']?.value).toBe(shared.sunDirection);
    expect(air.side).toBe(BackSide);
  });

  it('builds the features’ parts in, each one’s uniforms found by its part', () => {
    const { earth, parts } = createEarthMeshes(light(), new Texture(), [GLOW]);
    expect(earth.material.fragmentShader).toContain('glowStrength');
    const own = parts.byPart.get(GLOW);
    expect(own?.['glowStrength']).toBe(earth.material.uniforms['glowStrength']);
  });

  it('refuses a part whose uniform clashes with Earth’s own', () => {
    const clash: EarthPart = { ...GLOW, name: 'clash', uniforms: () => ({ dayMap: { value: 0 } }) };
    expect(() => createEarthMeshes(light(), new Texture(), [clash])).toThrow();
  });
});
