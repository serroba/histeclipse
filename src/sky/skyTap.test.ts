import { describe, expect, it } from 'vitest';
import { pickBody, type TapTarget } from './skyTap';

/** Overhead in the scene's axes (y up), and due south on the horizon (z south). */
const UP = { x: 0, y: 1, z: 0 };
const SOUTH = { x: 0, y: 0, z: 1 };

const venus: TapTarget = { body: 'venus', x: 100, y: 100, radius: 0, scene: UP };
const jupiter: TapTarget = { body: 'jupiter', x: 120, y: 100, radius: 0, scene: SOUTH };
const moon: TapTarget = { body: 'moon', x: 400, y: 300, radius: 0.25, scene: UP };

describe('pickBody', () => {
  it('picks nothing on an empty sky, or a tap out of every body’s reach', () => {
    expect(pickBody([], 10, 10, 10)).toBeNull();
    expect(pickBody([venus], 200, 200, 10)).toBeNull();
  });

  it('picks a point within a fingertip, and says where it stands', () => {
    expect(pickBody([venus], 110, 110, 10)).toEqual({
      body: 'venus',
      azimuth: expect.any(Number) as number,
      altitude: 90,
      radius: 0,
    });
    expect(pickBody([jupiter], 120, 100, 10)).toMatchObject({ azimuth: 180, altitude: 0 });
  });

  it('picks the nearer of two, by share of each one’s reach', () => {
    expect(pickBody([venus, jupiter], 104, 100, 10)?.body).toBe('venus');
    expect(pickBody([venus, jupiter], 116, 100, 10)?.body).toBe('jupiter');
    // Equally near: the first listed keeps it.
    expect(pickBody([venus, jupiter], 110, 100, 10)?.body).toBe('venus');
  });

  it('reaches further for a disc that looks large', () => {
    // 50 px from the Moon's centre: beyond a fingertip, within its disc at 400 px a degree.
    expect(pickBody([moon], 450, 300, 400)?.body).toBe('moon');
    expect(pickBody([moon], 450, 300, 10)).toBeNull();
  });
});
