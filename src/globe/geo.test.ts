import fc from 'fast-check';
import { SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';

import { cameraFromPosition, cameraPosition, geoToVector, vectorToGeo } from './geo';

describe('geoToVector', () => {
  it.each([
    [{ latitude: 0, longitude: 0 }, [1, 0, 0]],
    [{ latitude: 0, longitude: 90 }, [0, 0, -1]],
    [{ latitude: 0, longitude: -90 }, [0, 0, 1]],
    [{ latitude: 90, longitude: 0 }, [0, 1, 0]],
    [{ latitude: -90, longitude: 45 }, [0, -1, 0]],
  ] as const)('puts %o at %o', (point, expected) => {
    const vector = geoToVector(point);
    expected.forEach((value, axis) => {
      expect(vector[axis]).toBeCloseTo(value, 12);
    });
  });

  it('agrees with how three.js maps an equirectangular texture onto a sphere', () => {
    const sphere = new SphereGeometry(1, 36, 18);
    const position = sphere.getAttribute('position');
    const uv = sphere.getAttribute('uv');
    for (let index = 0; index < position.count; index += 1) {
      // u = 0 is the texture's left edge (180° W); v = 1 is its top (90° N).
      const point = { latitude: uv.getY(index) * 180 - 90, longitude: uv.getX(index) * 360 - 180 };
      const [x, y, z] = geoToVector(point);
      expect(x).toBeCloseTo(position.getX(index), 6);
      expect(y).toBeCloseTo(position.getY(index), 6);
      expect(z).toBeCloseTo(position.getZ(index), 6);
    }
  });
});

describe('vectorToGeo', () => {
  const latitudes = fc.double({ min: -89.999, max: 89.999, noNaN: true });
  const longitudes = fc.double({ min: -179.999, max: 180, noNaN: true });

  it('inverts geoToVector', () => {
    fc.assert(
      fc.property(
        latitudes,
        longitudes,
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        (lat, lon, r) => {
          const point = vectorToGeo(geoToVector({ latitude: lat, longitude: lon }, r));
          expect(point.latitude).toBeCloseTo(lat, 9);
          expect(point.longitude).toBeCloseTo(lon, 9);
        },
      ),
    );
  });

  it('stays precise right next to the poles', () => {
    // asin(y / r) loses precision here; this case once failed.
    const point = vectorToGeo(geoToVector({ latitude: -89.9989959253038, longitude: 0 }, 0.152));
    expect(point.latitude).toBeCloseTo(-89.9989959253038, 9);
  });

  it('reports longitude 0 at the poles and 180 rather than -180', () => {
    expect(vectorToGeo([0, 2, 0])).toEqual({ latitude: 90, longitude: 0 });
    // atan2(-0, -1) is -180°; the antimeridian is reported as +180.
    expect(vectorToGeo([-1, 0, 0]).longitude).toBe(180);
  });

  it('rejects the zero vector', () => {
    expect(() => vectorToGeo([0, 0, 0])).toThrow(RangeError);
  });
});

describe('camera', () => {
  it('round-trips through a position', () => {
    const camera = { target: { latitude: 32.5, longitude: 44.4 }, distance: 3 };
    const result = cameraFromPosition(cameraPosition(camera));
    expect(result.distance).toBeCloseTo(3, 12);
    expect(result.target.latitude).toBeCloseTo(32.5, 9);
    expect(result.target.longitude).toBeCloseTo(44.4, 9);
  });
});
