import { describe, expect, it } from 'vitest';

import type { ShadowGeometry } from '../../eclipses/solar';
import { assembleEarthParts, MAX_SAMPLERS, samplerCount } from '../../globe/earthParts';
import type { LayerHost } from '../../globe/layerHost';
import { earthFragment } from '../../globe/scene';
import { ECLIPSE_EARTH_PARTS } from '.';
import { moonShadowLayer } from './moonShadow';
import { MOON_SHADOW_PART } from './moonShadowPart';

describe("the Moon's shadow, a part of the Earth shader", () => {
  it('Given the eclipses’ parts, Then the shadow falls last, over the overlay and the path', () => {
    const shader = earthFragment(assembleEarthParts(ECLIPSE_EARTH_PARTS));
    const calls = ['lunarOverlay', 'eclipsePath', 'moonShadow'].map((name) =>
      shader.indexOf(`color = ${name}(color, f);`),
    );
    expect(calls.every((at) => at > 0)).toBe(true);
    expect(calls).toEqual(calls.toSorted((a, b) => a - b));
    expect(samplerCount(shader)).toBeLessThanOrEqual(MAX_SAMPLERS);
  });

  it('Given a selected eclipse, Then its shadow is drawn from the catalog, in radians', () => {
    const uniforms = MOON_SHADOW_PART.uniforms();
    const dataset: Record<string, string> = {};
    let frames = 0;
    const host = {
      container: { dataset },
      earthPart: () => uniforms,
      requestRender: () => {
        frames += 1;
      },
    } as unknown as LayerHost;
    const layer = moonShadowLayer(host);
    const shadow: ShadowGeometry = {
      x: 0.1,
      y: 0.2,
      d: 7,
      mu: 90,
      l1: 0.54,
      l2: -0.01,
      tanF1: 0.0047,
      tanF2: 0.0046,
    };
    layer.update(shadow);
    expect(uniforms.solarActive.value).toBe(1);
    expect(uniforms.shadowAxis.value.toArray()).toEqual([
      0.1,
      0.2,
      (7 * Math.PI) / 180,
      Math.PI / 2,
    ]);
    expect(uniforms.shadowCones.value.toArray()).toEqual([0.54, -0.01, 0.0047, 0.0046]);
    expect(dataset['solarShadow']).toBe('on');
    layer.update(null);
    expect(uniforms.solarActive.value).toBe(0);
    expect(dataset['solarShadow']).toBe('off');
    expect(frames).toBe(2);
  });
});
