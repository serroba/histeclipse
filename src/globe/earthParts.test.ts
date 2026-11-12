import { describe, expect, it } from 'vitest';

import {
  assembleEarthParts,
  checkSamplers,
  MAX_SAMPLERS,
  samplerCount,
  type EarthPart,
} from './earthParts';

/** A part named `name`, declaring its function and `extra` GLSL, with the uniforms given. */
function part(
  name: string,
  order: number,
  uniforms: Record<string, { value: unknown }> = {},
  extra = '',
): EarthPart {
  return {
    name,
    order,
    glsl: `${extra}\nvec3 ${name}(vec3 color, EarthFragment f) { return color; }`,
    uniforms: () => uniforms,
  };
}

describe('the parts of the Earth shader', () => {
  it('Given parts in any order, Then their GLSL and calls follow their order', () => {
    const assembled = assembleEarthParts([part('shadow', 60), part('lunar', 30)]);
    expect(assembled.calls).toBe('color = lunar(color, f);\n    color = shadow(color, f);');
    expect(assembled.glsl.indexOf('vec3 lunar(')).toBeLessThan(
      assembled.glsl.indexOf('vec3 shadow('),
    );
  });

  it('Given their uniforms, Then the globe gets them all and each part its own, the same objects', () => {
    const active = { value: 0 };
    const lunar = part('lunar', 30, { lunarActive: active });
    const shadow = part('shadow', 60, { shadowAxis: { value: 1 } });
    const assembled = assembleEarthParts([lunar, shadow]);
    expect(Object.keys(assembled.uniforms)).toEqual(['lunarActive', 'shadowAxis']);
    expect(assembled.uniforms['lunarActive']).toBe(active);
    expect(assembled.byPart.get(lunar)).toEqual({ lunarActive: active });
  });

  it('Given no parts, Then nothing is called', () => {
    expect(assembleEarthParts([])).toMatchObject({ glsl: '', calls: '', uniforms: {} });
  });

  it('Given a name that is no GLSL function, Then it is refused', () => {
    expect(() => assembleEarthParts([part('lunar-overlay', 30)])).toThrow(/GLSL function/);
  });

  it('Given a part twice, Then it is refused', () => {
    expect(() => assembleEarthParts([part('lunar', 30), part('lunar', 40)])).toThrow(/twice/);
  });

  it('Given a part whose function is not the one its name says, Then it is refused', () => {
    const wrong: EarthPart = {
      name: 'lunar',
      order: 30,
      glsl: 'vec3 lunar(vec3 color, vec3 normal) { return color; }',
      uniforms: () => ({}),
    };
    expect(() => assembleEarthParts([wrong])).toThrow(/must declare vec3 lunar/);
  });

  it('Given a part declaring a uniform the Earth shader shares, Then it is refused', () => {
    expect(() =>
      assembleEarthParts([part('shadow', 50, {}, 'uniform vec3 moonPosition;')]),
    ).toThrow(/declares moonPosition/);
  });

  it('Given a uniform the shader or another part has, Then it is refused', () => {
    expect(() =>
      assembleEarthParts(
        [part('lunar', 30, { sunDirection: { value: 0 } })],
        new Set(['sunDirection']),
      ),
    ).toThrow(/sunDirection is taken/);
    expect(() =>
      assembleEarthParts([
        part('a', 1, { same: { value: 0 } }),
        part('b', 2, { same: { value: 0 } }),
      ]),
    ).toThrow(/same is taken/);
  });

  it('counts textures, and refuses a shader with more than every GPU allows', () => {
    const textures = (count: number) => 'uniform sampler2D map;\n'.repeat(count);
    expect(samplerCount(textures(3))).toBe(3);
    expect(() => {
      checkSamplers(textures(MAX_SAMPLERS));
    }).not.toThrow();
    expect(() => {
      checkSamplers(textures(MAX_SAMPLERS + 1));
    }).toThrow(/samples 17 textures/);
  });
});
