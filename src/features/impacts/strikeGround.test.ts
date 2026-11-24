import { describe, expect, it } from 'vitest';

import { assembleEarthParts, MAX_SAMPLERS, samplerCount } from '../../globe/earthParts';
import { earthFragment } from '../../globe/earthShader';
import type { LayerHost } from '../../globe/layerHost';
import { strikeGround } from './groundModel';
import { ECLIPSE_EARTH_PARTS } from '../eclipses';
import { IMPACT_EARTH_PARTS } from '.';
import { strikeGroundLayer } from './strikeGroundLayer';
import { STRIKE_GROUND_PART } from './strikeGroundPart';

describe('the strike’s ground, a part of the Earth shader (#1175, #1176)', () => {
  it('is drawn after deep time’s even light, after the eclipses’ parts, in the textures allowed', () => {
    const shader = earthFragment(
      assembleEarthParts([...ECLIPSE_EARTH_PARTS, ...IMPACT_EARTH_PARTS]),
    );
    const even = shader.indexOf('color = mix(color, surface * (0.6 + 0.45 * facing), evenLight);');
    expect(even).toBeGreaterThan(0);
    expect(shader.indexOf('color = strikeGround(color, f);')).toBeGreaterThan(even);
    expect(shader.indexOf('color = moonShadow(color, f);')).toBeLessThan(even);
    // Deep time's heights are declared before the parts, which read them.
    expect(shader.indexOf('float paleoHeight(vec2 uv);')).toBeLessThan(
      shader.indexOf('vec3 strikeGround('),
    );
    expect(samplerCount(shader)).toBeLessThanOrEqual(MAX_SAMPLERS);
  });

  it('draws the tsunami over the sea only, from deep time’s heights', () => {
    expect(STRIKE_GROUND_PART.glsl).toContain('paleoActive > 0.5');
    expect(STRIKE_GROUND_PART.glsl).toContain('paleoHeight(f.uv)');
  });

  it('sets the ground at each moment of the clock, and takes it away', () => {
    const uniforms = STRIKE_GROUND_PART.uniforms();
    const dataset: Record<string, string> = {};
    let frames = 0;
    const host = {
      container: { dataset },
      earthPart: () => uniforms,
      requestRender: () => {
        frames += 1;
      },
    } as unknown as LayerHost;
    const layer = strikeGroundLayer(host);
    layer.update({ place: { latitude: 0, longitude: 0 }, seconds: 3600, worldwide: 1 });
    const ground = strikeGround(3600, 1);
    expect(uniforms.strikeActive.value).toBe(1);
    expect(uniforms.strikeCenter.value.length()).toBeCloseTo(1, 9);
    expect(uniforms.strikeCrater.value).toEqual([
      ground.cavityKm,
      ground.depth,
      ground.uplift,
      ground.peakRing,
    ]);
    expect(uniforms.strikeSpread.value[3]).toBe(ground.tsunamiFront);
    expect(uniforms.strikeTsunami.value).toBe(ground.tsunami);
    expect(dataset['strikeGround']).toBe('on');
    layer.update(null);
    expect(uniforms.strikeActive.value).toBe(0);
    expect(dataset['strikeGround']).toBe('off');
    expect(frames).toBe(2);
  });
});
