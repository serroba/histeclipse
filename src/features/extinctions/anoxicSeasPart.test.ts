import { describe, expect, it } from 'vitest';

import { assembleEarthParts, MAX_SAMPLERS, samplerCount } from '../../globe/earthParts';
import { earthFragment } from '../../globe/earthShader';
import { FEATURE_EARTH_PARTS } from '..';
import { ANOXIA_PATCHES, ANOXIC_SEAS_PART } from './anoxicSeasPart';

describe('the oxygen-poor seas, a part of the Earth shader (#1208)', () => {
  it('is drawn over deep time’s even light with the others, in the textures allowed', () => {
    const shader = earthFragment(assembleEarthParts(FEATURE_EARTH_PARTS));
    const even = shader.indexOf('color = mix(color, surface * (0.6 + 0.45 * facing), evenLight);');
    expect(shader.indexOf('color = anoxicSeas(color, f);')).toBeGreaterThan(even);
    expect(shader.indexOf('float paleoHeight(vec2 uv);')).toBeLessThan(
      shader.indexOf('vec3 anoxicSeas('),
    );
    expect(samplerCount(shader)).toBeLessThanOrEqual(MAX_SAMPLERS);
  });

  it('tints the sea only, from deep time’s heights, darkest over the shelves', () => {
    expect(ANOXIC_SEAS_PART.glsl).toContain('paleoActive < 0.5');
    expect(ANOXIC_SEAS_PART.glsl).toContain('smoothstep(-20.0, 0.0, height)');
    expect(ANOXIC_SEAS_PART.glsl).toContain('smoothstep(-2000.0, -200.0, height)');
  });

  it('starts with nothing drawn, a slot for each patch', () => {
    const uniforms = ANOXIC_SEAS_PART.uniforms();
    expect(uniforms.anoxiaStrength.value).toBe(0);
    expect(uniforms.anoxiaPatches.value).toHaveLength(ANOXIA_PATCHES);
    expect(uniforms.anoxiaPatches.value.every((patch) => patch.w === 0)).toBe(true);
  });
});
