import { describe, expect, it } from 'vitest';

import {
  assembleEarthParts,
  EARTH_SHARED_UNIFORMS,
  MAX_SAMPLERS,
  samplerCount,
} from './earthParts';
import { earthFragment } from './earthShader';

describe('the Earth shader', () => {
  it('samples no more textures than every WebGL GPU allows a shader', () => {
    // WebGL guarantees 16 units per fragment shader (Chrome on a Mac reports exactly 16); the
    // headless browser in the end-to-end suite allows 32, so it would not catch a seventeenth.
    // The features' parts are checked with it where they are made, and when the globe is.
    expect(samplerCount(earthFragment(assembleEarthParts([])))).toBeLessThanOrEqual(MAX_SAMPLERS);
  });

  it('Given Travel view, Then it draws only the ice the photo lacks; deep time all of it', () => {
    const shader = earthFragment(assembleEarthParts([]));
    const travel = shader.slice(shader.indexOf('vec3 holoceneSurface('));
    const holocene = travel.slice(0, travel.indexOf('\n  }\n'));
    expect(holocene).toMatch(/iceAt\(iceYounger, uv\)\.g/);
    expect(holocene).not.toMatch(/iceFrom\(/);
    expect(shader.slice(0, shader.indexOf('vec3 holoceneSurface('))).toMatch(
      /iceFrom\(iceYounger, uv\)/,
    );
  });

  it('declares every uniform it shares with the parts', () => {
    const shader = earthFragment(assembleEarthParts([]));
    for (const name of EARTH_SHARED_UNIFORMS) {
      expect(shader, name).toMatch(new RegExp(String.raw`\buniform\s+\w+\s+${name}\s*;`));
    }
  });

  it('Given parts, Then it declares them and passes the colour through each, in order', () => {
    const parts = assembleEarthParts([
      {
        name: 'later',
        order: 20,
        glsl: 'vec3 later(vec3 color, EarthFragment f) {}',
        uniforms: () => ({}),
      },
      {
        name: 'sooner',
        order: 10,
        glsl: 'vec3 sooner(vec3 color, EarthFragment f) {}',
        uniforms: () => ({}),
      },
    ]);
    const shader = earthFragment(parts);
    expect(shader).toContain('struct EarthFragment');
    const sooner = shader.indexOf('color = sooner(color, f);');
    const later = shader.indexOf('color = later(color, f);');
    expect(sooner).toBeGreaterThan(shader.indexOf('void main()'));
    expect(later).toBeGreaterThan(sooner);
  });
});
