import { describe, expect, it } from 'vitest';

import index from '../../public/data/sealevel/index.json';
import type { SeaLevelIndex } from '../data/seaLevel';
import { coastlineAt } from './coastline';

const levels = index as SeaLevelIndex;

describe('coastlineAt', () => {
  it('follows the source asked for, from its own present day', () => {
    const glacial = coastlineAt(levels, 'bintanja-2008', 21);
    expect(glacial?.series.id).toBe('bintanja-2008');
    expect(glacial?.instead).toBeNull();
    expect(glacial?.seaLevel).toBeCloseTo(-122.8 - -1.5, 1);
    // Spratt & Lisiecki's stack reads about +9 m at 0 ka; today is today.
    expect(coastlineAt(levels, 'spratt-2016', 0)?.seaLevel).toBe(0);
    expect(coastlineAt(levels, 'spratt-2016', 21)?.seaLevel).toBeCloseTo(-118.6 - 9, 0);
  });

  it('stands another in where the source asked for does not reach, and says which', () => {
    const old = coastlineAt(levels, 'spratt-2016', 1500);
    expect(old?.series.id).toBe('bintanja-2008');
    expect(old?.instead?.id).toBe('spratt-2016');
  });

  it('has nothing where none reaches', () => {
    expect(coastlineAt(levels, 'bintanja-2008', 5000)).toBeNull();
    expect(coastlineAt({ schemaVersion: 1, series: [] }, 'bintanja-2008', 21)).toBeNull();
  });
});
