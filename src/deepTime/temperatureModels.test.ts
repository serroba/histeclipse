import { describe, expect, it } from 'vitest';

import cesmIndex from '../../public/data/cesm/index.json';
import scoteseIndex from '../../public/data/paleotemp/index.json';
import type { PaleoTempIndex } from '../data/paleoTemp';
import { mapModel, meanAt, reachMa } from './temperatureModels';

const scotese = scoteseIndex as PaleoTempIndex;
const cesm = cesmIndex as PaleoTempIndex;

describe('the temperature models', () => {
  it('reach back as far as their maps', () => {
    expect(reachMa(scotese)).toBe(540);
    expect(reachMa(cesm)).toBe(250);
  });

  it('give each global mean, and disagree at 250 Ma', () => {
    expect(meanAt(scotese, 250)).toBeCloseTo(32.9, 1);
    expect(meanAt(cesm, 250)).toBeCloseTo(25.5, 1);
    expect(meanAt(cesm, 5)).toBeCloseTo((13.2 + 16.1) / 2, 6);
    expect(meanAt(cesm, 300)).toBeNull();
  });

  it('draw with the model asked for, or stand the other in', () => {
    const both = { scotese, cesm };
    expect(mapModel('cesm', both, 100)).toEqual({ model: 'cesm', instead: null });
    expect(mapModel('cesm', both, 300)).toEqual({ model: 'scotese', instead: 'cesm' });
    expect(mapModel('scotese', both, 300)).toEqual({ model: 'scotese', instead: null });
    expect(mapModel('cesm', { scotese: null, cesm: null }, 100)).toBeNull();
    expect(mapModel('scotese', { scotese, cesm }, 600)).toBeNull();
  });
});
