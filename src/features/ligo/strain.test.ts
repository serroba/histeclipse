import { describe, expect, it } from 'vitest';

import {
  chirp,
  displacement,
  displacementInPlane,
  GW150914_STAND_IN,
  waveAxes,
  type Polarisations,
  type Triple,
} from './strain';

const h = (plus: number, cross: number): Polarisations => ({ plus, cross });

/** The area a small square at the origin has once each corner has moved. */
function areaAfter(strain: Polarisations): number {
  const moved = (x: number, y: number): [number, number] => {
    const [dx, dy] = displacementInPlane(strain, x, y);
    return [x + dx, y + dy];
  };
  const [ax, ay] = moved(1, 0);
  const [bx, by] = moved(0, 1);
  return ax * by - ay * bx;
}

describe('displacement by a gravitational wave', () => {
  it('stretches x and squeezes y under h₊, as a plus', () => {
    expect(displacementInPlane(h(0.1, 0), 1, 0)).toEqual([0.05, 0]);
    expect(displacementInPlane(h(0.1, 0), 0, 1)).toEqual([0, -0.05]);
  });

  it('keeps areas, to first order in the strain', () => {
    for (const strain of [h(1e-3, 0), h(0, 1e-3), h(6e-4, -8e-4)]) {
      const change = areaAfter(strain) - 1;
      // ¼(h₊² + h×²): second order, a millionth of the strain itself here.
      expect(Math.abs(change)).toBeLessThan(1e-6);
      expect(change).toBeCloseTo(-0.25 * (strain.plus ** 2 + strain.cross ** 2), 12);
    }
  });

  it('turns the plus into the cross a quarter cycle on, turned by 45°', () => {
    const wave = (phase: number): Polarisations => h(Math.cos(phase), Math.sin(phase));
    const r = Math.SQRT1_2;
    // The plus pattern stretches along x; a quarter cycle on, it stretches along the diagonal.
    const [px, py] = displacementInPlane(wave(0), 1, 0);
    const [cx, cy] = displacementInPlane(wave(Math.PI / 2), r, r);
    expect(Math.hypot(cx, cy)).toBeCloseTo(Math.hypot(px, py), 12);
    expect(cx * r + cy * r).toBeCloseTo(px, 12);
    expect(py).toBeCloseTo(0, 12);
  });

  it('moves nothing along the wave’s own direction', () => {
    const directions: Triple[] = [
      [0, 0, 1],
      [1, 0, 0],
      [0.3, -0.5, 0.8],
      [0, 0, -1],
    ];
    for (const direction of directions) {
      const length = Math.hypot(...direction);
      const n: Triple = [direction[0] / length, direction[1] / length, direction[2] / length];
      expect(displacement(h(0.2, 0.1), direction, n).every((d) => Math.abs(d) < 1e-12)).toBe(true);
      const moved = displacement(h(0.2, 0.1), direction, [0.4, 0.9, -0.2]);
      expect(moved[0] * n[0] + moved[1] * n[1] + moved[2] * n[2]).toBeCloseTo(0, 12);
    }
  });

  it('agrees with the plane’s own formula for a wave along z', () => {
    const strain = h(0.3, -0.2);
    const [dx, dy] = displacementInPlane(strain, 0.7, -0.4);
    expect(displacement(strain, [0, 0, 1], [0.7, -0.4, 5])).toEqual([dx, dy, 0]);
  });

  it('measures the polarisations across the wave, at right angles', () => {
    const { p, q } = waveAxes([1, 1, 0]);
    expect(p[0] * q[0] + p[1] * q[1] + p[2] * q[2]).toBeCloseTo(0, 12);
    expect(p[0] + p[1]).toBeCloseTo(0, 12);
    expect(() => waveAxes([0, 0, 0])).toThrow('direction');
  });
});

describe('the stand-in chirp', () => {
  const wave = chirp(GW150914_STAND_IN);

  it('lasts about as long as GW150914 was heard, a fifth of a second', () => {
    expect(wave.start).toBeGreaterThan(-0.25);
    expect(wave.start).toBeLessThan(-0.12);
    expect(wave.end).toBeCloseTo(0.024, 6);
  });

  it('rises in pitch and loudness to the merger, then rings down', () => {
    const size = (t: number): number => Math.hypot(wave.at(t).plus, wave.at(t).cross);
    expect(wave.frequency(wave.start)).toBeCloseTo(35, 6);
    expect(wave.frequency(0)).toBeCloseTo(150, 6);
    expect(wave.frequency(0.01)).toBe(250);
    expect(size(-0.1)).toBeLessThan(size(-0.01));
    expect(size(0)).toBeCloseTo(1e-21, 30);
    expect(size(0.004)).toBeCloseTo(1e-21 / Math.E, 30);
  });

  it('is silent outside its span', () => {
    expect(wave.at(wave.start - 0.01)).toEqual({ plus: 0, cross: 0 });
    expect(wave.at(1)).toEqual({ plus: 0, cross: 0 });
    expect(wave.frequency(1)).toBe(0);
  });

  it('is continuous at the merger', () => {
    const before = wave.at(-1e-7);
    const after = wave.at(1e-7);
    expect(after.plus).toBeCloseTo(before.plus, 23);
    expect(after.cross).toBeCloseTo(before.cross, 23);
  });
});

describe('the stand-in against the paper', () => {
  it('goes about eight cycles from 35 to 150 Hz, as GW150914 did', () => {
    const wave = chirp(GW150914_STAND_IN);
    let turns = 0;
    let last = Math.atan2(wave.at(wave.start).cross, wave.at(wave.start).plus);
    for (let t = wave.start; t <= 0; t += 1e-5) {
      const angle = Math.atan2(wave.at(t).cross, wave.at(t).plus);
      let step = angle - last;
      if (step < -Math.PI) step += 2 * Math.PI;
      turns += step;
      last = angle;
    }
    expect(turns / (2 * Math.PI)).toBeGreaterThan(7.5);
    expect(turns / (2 * Math.PI)).toBeLessThan(9.5);
  });
});
