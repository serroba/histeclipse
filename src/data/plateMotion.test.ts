import { describe, expect, it } from 'vitest';

import data from '../../public/data/plates-motion.json';
import { compass, loadPlateMotion, motionSince, motionText, type PlateMotion } from './plateMotion';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const small: PlateMotion = {
  schemaVersion: 1,
  credit: 'Cao et al. (2024)',
  source: 'https://doi.org/10.5281/zenodo.13628813',
  frame: 'paleomagnetic',
  stepMa: 0.05,
  plates: [
    {
      name: 'Australian',
      latitude: -25.3,
      longitude: 131,
      moved: [
        [0, 0],
        [2, 350],
        [4, 352],
      ],
    },
  ],
};

describe('plate motion', () => {
  it('loads and checks, the real file too', async () => {
    const loaded = await loadPlateMotion('plates-motion.json', serve(data));
    expect(loaded.plates.map((plate) => plate.name)).toContain('Pacific');
    await expect(loadPlateMotion('x', serve({ ...small, frame: 'hotspot' }))).rejects.toThrow();
  });

  it('reads the move between steps, and nothing beyond the record', () => {
    const [later] = motionSince(small, 0.0875);
    expect(later?.km).toBeCloseTo(3.5);
    expect(later?.bearing).toBe(352);
    expect(motionSince(small, 0.06)[0]?.bearing).toBe(350);
    expect(motionSince(small, 0.2)).toEqual([]);
  });

  it('names eight directions', () => {
    expect([0, 44, 90, 180, 270, 315, 359].map(compass)).toEqual([
      'north',
      'north-east',
      'east',
      'south',
      'west',
      'north-west',
      'north',
    ]);
  });

  it('says how far each plate moved, or nothing when none has', () => {
    expect(motionText(small, 0.1)).toBe(
      'Since then the plates have moved, relative to Earth’s spin axis in Cao et al.’s (2024) model: Australian 4 km north. Too little to see on the whole globe; the map is today’s.',
    );
    expect(motionText(small, 0)).toBeNull();
  });

  it('moves India north-north-east by about 150 km over the ice ages in the real model', async () => {
    const loaded = await loadPlateMotion('plates-motion.json', serve(data));
    const india = motionSince(loaded, 2.6).find((move) => move.name === 'Indian');
    expect(india?.km).toBeGreaterThan(100);
    expect(compass(india?.bearing ?? 0)).toBe('north-east');
  });
});
