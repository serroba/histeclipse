import { describe, expect, it } from 'vitest';

import { assembleEarthParts, MAX_SAMPLERS, samplerCount } from './earthParts';
import { earthFragment } from './scene';

describe('the Earth shader', () => {
  it('samples no more textures than every WebGL GPU allows a shader', () => {
    // WebGL guarantees 16 units per fragment shader (Chrome on a Mac reports exactly 16); the
    // headless browser in the end-to-end suite allows 32, so it would not catch a seventeenth.
    // The features' parts are checked with it where they are made, and when the globe is.
    expect(samplerCount(earthFragment(assembleEarthParts([])))).toBeLessThanOrEqual(MAX_SAMPLERS);
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
