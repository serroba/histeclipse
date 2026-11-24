import { describe, expect, it } from 'vitest';

import { assembleEarthParts, MAX_SAMPLERS, samplerCount } from '../../globe/earthParts';
import { earthFragment } from '../../globe/earthShader';
import { FEATURE_EARTH_PARTS } from '..';
import { LAVA_FLOWS_PART, LAVA_VENTS } from './lavaFlowsPart';

describe('the flood lavas, a part of the Earth shader (#1212)', () => {
  it('is drawn over deep time’s even light, before the oxygen-poor seas, in the textures allowed', () => {
    const shader = earthFragment(assembleEarthParts(FEATURE_EARTH_PARTS));
    const even = shader.indexOf('color = mix(color, surface * (0.6 + 0.45 * facing), evenLight);');
    const lava = shader.indexOf('color = lavaFlows(color, f);');
    expect(lava).toBeGreaterThan(even);
    expect(lava).toBeLessThan(shader.indexOf('color = anoxicSeas(color, f);'));
    expect(samplerCount(shader)).toBeLessThanOrEqual(MAX_SAMPLERS);
  });

  it('flows over the land only, where deep time’s heights are drawn, glowing as it erupts', () => {
    expect(LAVA_FLOWS_PART.glsl).toContain('smoothstep(-20.0, 0.0, paleoHeight(f.uv))');
    expect(LAVA_FLOWS_PART.glsl).toContain('lavaHeat * flicker');
  });

  it('starts with nothing flowed, a slot for each vent', () => {
    const uniforms = LAVA_FLOWS_PART.uniforms();
    expect(uniforms.lavaCover.value).toBe(0);
    expect(uniforms.lavaVents.value).toHaveLength(LAVA_VENTS);
  });
});
