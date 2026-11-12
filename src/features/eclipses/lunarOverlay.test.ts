import { describe, expect, it } from 'vitest';

import { assembleEarthParts, MAX_SAMPLERS, samplerCount } from '../../globe/earthParts';
import { earthFragment } from '../../globe/earthShader';
import type { LayerHost } from '../../globe/layerHost';
import { lunarOverlayLayer } from './lunarOverlay';
import { LUNAR_OVERLAY_PART } from './lunarOverlayPart';

describe('the lunar overlay, a part of the Earth shader', () => {
  it('Given the Earth shader built with it, Then it is called there, within the texture budget', () => {
    const shader = earthFragment(assembleEarthParts([LUNAR_OVERLAY_PART]));
    expect(shader).toContain('color = lunarOverlay(color, f);');
    expect(samplerCount(shader)).toBeLessThanOrEqual(MAX_SAMPLERS);
  });

  it('Given where the Moon is up, Then the layer shows it there, and hides it again', () => {
    const uniforms = LUNAR_OVERLAY_PART.uniforms();
    const dataset: Record<string, string> = {};
    let frames = 0;
    const host = {
      container: { dataset },
      earthPart: () => uniforms,
      requestRender: () => {
        frames += 1;
      },
    } as unknown as LayerHost;
    const layer = lunarOverlayLayer(host);
    layer.update({ sublunar: [0, 0, 2], west: [0, 3, 0], east: [4, 0, 0], strength: 0.5 });
    expect(uniforms.lunarActive.value).toBe(0.5);
    expect(uniforms.moonCenter.value.toArray()).toEqual([0, 0, 1]);
    expect(uniforms.moonWest.value.toArray()).toEqual([0, 1, 0]);
    expect(uniforms.moonEast.value.toArray()).toEqual([1, 0, 0]);
    expect(dataset['lunarOverlay']).toBe('on');
    layer.update(null);
    expect(uniforms.lunarActive.value).toBe(0);
    expect(dataset['lunarOverlay']).toBe('off');
    expect(frames).toBe(2);
  });

  it('starts hidden, its Moon facing the prime meridian', () => {
    const uniforms = LUNAR_OVERLAY_PART.uniforms();
    expect(uniforms.lunarActive.value).toBe(0);
    expect(uniforms.moonCenter.value.toArray()).toEqual([1, 0, 0]);
  });
});
