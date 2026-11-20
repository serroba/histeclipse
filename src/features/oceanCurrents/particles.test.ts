import { describe, expect, it } from 'vitest';

import type { Field } from '../../data/oceanCurrents';
import { PACE, particles, sample, step } from './particles';

/** A 1° node grid, the current the same everywhere but where `holes` say. */
function field(
  u: number,
  v: number,
  bound = 1,
  holes: (row: number) => boolean = () => false,
): Field {
  const width = 361;
  const height = 181;
  const east = new Float32Array(width * height).fill(u);
  const north = new Float32Array(width * height).fill(v);
  for (let row = 0; row < height; row += 1) {
    if (!holes(row)) continue;
    for (let column = 0; column < width; column += 1) {
      east[row * width + column] = Number.NaN;
      north[row * width + column] = Number.NaN;
    }
  }
  return { width, height, u: east, v: north, bound };
}

/** A repeatable random: 0.5, then 0.25, 0.75, … */
function steady(): () => number {
  let at = 0;
  const values = [0.5, 0.6, 0.4, 0.7];
  return () => values[at++ % values.length] ?? 0.5;
}

describe('particles carried by the currents (#927)', () => {
  it('Given a field, Then the current at a place, between the nodes; none where it has holes', () => {
    expect(sample(field(0.3, -0.1), 10.5, 20.5)).toEqual({
      u: expect.closeTo(0.3) as unknown,
      v: expect.closeTo(-0.1) as unknown,
    });
    expect(
      sample(
        field(0.3, 0, 1, (row) => row === 90),
        0,
        0.5,
      ),
    ).toBeNull();
    expect(sample(field(0.3, 0), -180, -90)).not.toBeNull();
  });

  it('Given particles, Then they start at sea, then move with the current at its pace', () => {
    const flow = field(1, 0);
    const flock = particles(3);
    step(flow, flock, 0.1, steady());
    // All started somewhere at sea; none moved yet.
    expect([...flock.speed]).toEqual([0, 0, 0]);
    const before = flock.longitude[0] ?? 0;
    const latitude = flock.latitude[0] ?? 0;
    step(flow, flock, 0.1, steady());
    const moved = (flock.longitude[0] ?? 0) - before;
    expect(moved).toBeCloseTo(
      (PACE * 0.1) / Math.max(0.2, Math.cos((latitude * Math.PI) / 180)),
      4,
    );
    expect(flock.speed[0]).toBeCloseTo(1);
    expect(flock.fromLongitude[0]).toBeCloseTo(before);
  });

  it('Given a slow deep field, Then the same pace on the screen at its bound', () => {
    const flock = particles(1);
    step(field(0.2, 0, 0.2), flock, 0.1, steady());
    const before = flock.longitude[0] ?? 0;
    step(field(0.2, 0, 0.2), flock, 0.1, steady());
    expect((flock.longitude[0] ?? 0) - before).toBeGreaterThan(0.5);
  });

  it('Given a current a quarter of the bound, Then it moves at half the pace: slow water still flows', () => {
    const flock = particles(1);
    step(field(0.25, 0), flock, 0.1, steady());
    const before = flock.longitude[0] ?? 0;
    const latitude = flock.latitude[0] ?? 0;
    step(field(0.25, 0), flock, 0.1, steady());
    expect((flock.longitude[0] ?? 0) - before).toBeCloseTo(
      (PACE * 0.1 * 0.5) / Math.max(0.2, Math.cos((latitude * Math.PI) / 180)),
      4,
    );
    expect(flock.speed[0]).toBeCloseTo(0.25);
  });

  it('Given still water, Then a particle stays put', () => {
    const flock = particles(1);
    step(field(0, 0), flock, 0.1, steady());
    const before = flock.longitude[0] ?? 0;
    step(field(0, 0), flock, 0.1, steady());
    expect(flock.longitude[0]).toBeCloseTo(before);
    expect(flock.speed[0]).toBe(0);
  });

  it('Given the date line, the poles, old age or no current, Then wrapped, held, or started again', () => {
    const flock = particles(1);
    const east = field(1, 1);
    step(east, flock, 0.01, () => 0.999);
    flock.longitude[0] = 179.9;
    flock.latitude[0] = 89.85;
    flock.age[0] = 0;
    step(east, flock, 0.05, steady());
    expect(flock.longitude[0]).toBeLessThan(0);
    expect(flock.latitude[0]).toBeCloseTo(89.9);
    flock.longitude[0] = -179.9;
    step(field(-1, 0), flock, 0.05, steady());
    expect(flock.longitude[0]).toBeGreaterThan(0);
    flock.age[0] = 100;
    step(east, flock, 0.01, steady());
    expect(flock.age[0]).toBeLessThan(10);
    // Nowhere with a current: it rests, to try again next time.
    const dry = field(0, 0, 1, () => true);
    flock.age[0] = 100;
    step(dry, flock, 0.01, steady());
    expect(flock.age[0]).toBe(6);
  });
});
