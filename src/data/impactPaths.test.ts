import { describe, expect, it } from 'vitest';

import data from '../../public/data/impacts.json';
import { impactPath, impactPaths, pathKm, pathsReach } from './impactPaths';
import { placeThen, type Impacts } from './impacts';

const real = data as Impacts;
const named = (name: string) => {
  const impact = real.impacts.find((each) => each.name === name);
  if (impact === undefined) throw new Error(`no ${name}`);
  return impact;
};

describe('impacts’ paths through time', () => {
  it('reaches as far back as the reconstruction places craters', () => {
    expect(pathsReach(real)).toBe(540);
  });

  it('puts every point where the globe draws the crater at that moment', () => {
    for (const name of ['Chicxulub', 'Manicouagan', 'Popigai', 'Acraman', 'Vredefort']) {
      const path = impactPath(real, named(name));
      expect(path).not.toBeNull();
      for (const run of path?.runs ?? []) {
        for (const point of run) {
          const globe = placeThen(real, named(name), point.ma);
          expect(globe?.latitude).toBeCloseTo(point.latitude, 9);
          expect(globe?.longitude).toBeCloseTo(point.longitude, 9);
        }
      }
    }
  });

  it('starts at the strike, steps every 5 million years, and ends today', () => {
    const path = impactPath(real, named('Chicxulub'));
    const times = path?.runs.flat().map((point) => point.ma) ?? [];
    expect(path?.tight).toBe(true);
    expect(times[0]).toBeCloseTo(66.038, 3);
    expect(times.slice(1, 3)).toEqual([65, 60]);
    expect(times.at(-1)).toBe(0);
    // Oldest first, with no step twice.
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
  });

  it('draws what the reconstruction reaches of a crater older than it', () => {
    const path = impactPath(real, named('Vredefort'));
    expect(path?.beyondReach).toBe(true);
    expect(path?.fromMa).toBe(540);
  });

  it('draws a loosely dated crater from the middle of its span, marked as loose', () => {
    const path = impactPath(real, named('Acraman'));
    expect(path?.tight).toBe(false);
    expect(path?.fromMa).toBe(540);
    expect(path?.beyondReach).toBe(true);
  });

  it('never draws a run across the antimeridian', () => {
    for (const path of impactPaths(real)) {
      for (const run of path.runs) {
        for (let at = 1; at < run.length; at++) {
          const step = Math.abs((run[at]?.longitude ?? 0) - (run[at - 1]?.longitude ?? 0));
          expect(step).toBeLessThanOrEqual(180);
        }
      }
    }
  });

  it('draws every dated crater the reconstruction places, largest first', () => {
    const paths = impactPaths(real);
    expect(paths[0]?.impact.name).toBe('Vredefort');
    const dated = real.impacts.filter((each) => each.olderMa !== null).length;
    expect(paths.length).toBeLessThanOrEqual(dated);
    expect(paths.length).toBeGreaterThan(200);
  });

  it('measures how far a crater travelled with its plate', () => {
    const chicxulub = impactPath(real, named('Chicxulub'));
    const km = chicxulub === null ? 0 : pathKm(chicxulub);
    // Yucatán has moved a few thousand km since the Cretaceous on PALEOMAP; not zero, not a world.
    expect(km).toBeGreaterThan(500);
    expect(km).toBeLessThan(10_000);
  });
});
