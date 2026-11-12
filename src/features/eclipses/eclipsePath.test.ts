import type { ShaderMaterial, Vector3, Vector4, WebGLRenderTarget } from 'three';
import { describe, expect, it } from 'vitest';

import { SIDEREAL_DEGREES_PER_SECOND } from '../../eclipses/solar';
import { assembleEarthParts, MAX_SAMPLERS, samplerCount } from '../../globe/earthParts';
import type { LayerHost } from '../../globe/layerHost';
import { earthFragment } from '../../globe/scene';
import { eclipsePathLayer, type SolarPath } from './eclipsePath';
import { ECLIPSE_PATH_PART } from './eclipsePathPart';
import { LUNAR_OVERLAY_PART } from './lunarOverlayPart';

const PATH: SolarPath = {
  elements: {
    x: [0.1, 0.5, 0, 0],
    y: [0.2, -0.1, 0, 0],
    d: [10, 0.01, 0, 0],
    mu: [180, 15, 0, 0],
    l1: [0.54, 0, 0, 0],
    l2: [-0.01, 0, 0, 0],
    tanF1: 0.0047,
    tanF2: 0.0046,
  } as SolarPath['elements'],
  deltaTSeconds: 3600,
  uncertaintySeconds: 600,
};

/** A host that keeps what the layer draws into a texture, and the frames it asks for. */
function fakeHost() {
  const uniforms = ECLIPSE_PATH_PART.uniforms();
  const dataset: Record<string, string> = {};
  const drawn: { target: WebGLRenderTarget; material: ShaderMaterial }[] = [];
  let frames = 0;
  const host = {
    container: { dataset },
    earthPart: () => uniforms,
    renderToTexture: (target: WebGLRenderTarget, scene: { children: { material: unknown }[] }) => {
      drawn.push({ target, material: scene.children[0]?.material as ShaderMaterial });
    },
    requestRender: () => {
      frames += 1;
    },
  } as unknown as LayerHost;
  return { host, uniforms, dataset, drawn, frames: () => frames };
}

describe('the eclipse path, a part of the Earth shader', () => {
  it('Given the shader built with it, Then it is called after the lunar overlay, within budget', () => {
    const shader = earthFragment(assembleEarthParts([ECLIPSE_PATH_PART, LUNAR_OVERLAY_PART]));
    const lunar = shader.indexOf('color = lunarOverlay(color, f);');
    expect(shader.indexOf('color = eclipsePath(color, f);')).toBeGreaterThan(lunar);
    expect(lunar).toBeGreaterThan(-1);
    expect(samplerCount(shader)).toBeLessThanOrEqual(MAX_SAMPLERS);
  });

  it('Given an eclipse, Then its path is drawn into the texture the shader reads, and shown', () => {
    const { host, uniforms, dataset, drawn, frames } = fakeHost();
    eclipsePathLayer(host).update(PATH);
    expect(drawn).toHaveLength(1);
    const [{ target, material } = { target: null, material: null }] = drawn;
    expect(uniforms.solarPath.value).toBe(target?.texture);
    expect(uniforms.solarPathActive.value).toBe(1);
    expect(dataset['solarPath']).toBe('on');
    expect(frames()).toBe(1);
    const values = material?.uniforms ?? {};
    // Degrees become radians; the hour angle turns with ΔT and its uncertainty either side.
    expect((values['coefficientsD']?.value as Vector4).x).toBeCloseTo((10 * Math.PI) / 180);
    const shift = (seconds: number) => (seconds * SIDEREAL_DEGREES_PER_SECOND * Math.PI) / 180;
    const shifts = values['muShifts']?.value as Vector3;
    expect(shifts.x).toBeCloseTo(shift(3600));
    expect(shifts.y).toBeCloseTo(shift(3000));
    expect(shifts.z).toBeCloseTo(shift(4200));
  });

  it('Given none, Then the path is hidden, and nothing is drawn', () => {
    const { host, uniforms, dataset, drawn } = fakeHost();
    const layer = eclipsePathLayer(host);
    layer.update(PATH);
    layer.update(null);
    expect(drawn).toHaveLength(1);
    expect(uniforms.solarPathActive.value).toBe(0);
    expect(dataset['solarPath']).toBe('off');
    layer.dispose?.();
  });
});
