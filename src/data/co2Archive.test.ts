import { describe, expect, it } from 'vitest';

import data from '../../public/data/air-co2-archive.json';
import {
  archiveDots,
  archiveNear,
  archiveText,
  loadCo2Archive,
  medianNear,
  studiesNear,
  type Co2Archive,
} from './co2Archive';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const small: Co2Archive = {
  schemaVersion: 1,
  credit: 'Paleo-CO2 Data Archive',
  source: 'https://doi.org/10.5281/zenodo.15546408',
  accessed: '2026-11-04',
  methods: ['Boron', 'Paleosols'],
  studies: [
    { author: 'Haynes', year: 2020, doi: '10.1073/pnas.2003197117' },
    { author: '', year: null, doi: null },
  ],
  estimates: [
    [55.7, 650, 520, 820, 0, 0],
    [55.8, 700, null, null, 0, 0],
    [56.5, 1600, 800, 3200, 1, 1],
    [300, 400, null, null, 1, 1],
  ],
};

describe('the Paleo-CO2 Data Archive', () => {
  it('loads and checks, the real file too', async () => {
    await expect(loadCo2Archive('x', serve(small))).resolves.toEqual(small);
    const real = await loadCo2Archive('air-co2-archive.json', serve(data));
    expect(real.estimates.length).toBeGreaterThan(9000);
    expect(real.methods).toContain('Boron');
    // The Paleocene–Eocene Thermal Maximum is well studied: many estimates near 56 Ma.
    expect(archiveNear(real, 56, 1).reduce((sum, { count }) => sum + count, 0)).toBeGreaterThan(20);
  });

  it('gives a chart its dots, of one method or all', () => {
    expect(archiveDots(small, null)).toHaveLength(4);
    expect(archiveDots(small, 1)).toEqual([
      [56.5, 1600],
      [300, 400],
    ]);
  });

  it('counts the estimates near a moment by method, and names their studies', () => {
    expect(archiveNear(small, 56, 1)).toEqual([
      { name: 'Boron', count: 2 },
      { name: 'Paleosols', count: 1 },
    ]);
    expect(studiesNear(small, 56, 1, null)).toEqual([
      { label: 'Haynes 2020', doi: '10.1073/pnas.2003197117', count: 2 },
      { label: 'Unnamed study', doi: null, count: 1 },
    ]);
    expect(studiesNear(small, 56, 1, 1)).toEqual([{ label: 'Unnamed study', doi: null, count: 1 }]);
  });

  it('takes the middle of the estimates near a moment', () => {
    expect(medianNear(small, 56, 1, null)).toBe(700);
    expect(medianNear(small, 56, 1, 0)).toBe(675);
    expect(medianNear(small, 100, 1, null)).toBeNull();
  });

  it('says what the archive has near then, by method', () => {
    expect(archiveText(small, 56, 1, null)).toBe(
      'The Paleo-CO₂ Data Archive: 3 estimates within 1 million years of then, their middle 700 ppm. By method: Boron 2, Paleosols 1. Each method has its own assumptions; where they part, the archive keeps both.',
    );
    expect(archiveText(small, 56, 1, 0)).toBe(
      'The Paleo-CO₂ Data Archive: 2 estimates by Boron within 1 million years of then, their middle 675 ppm. Each method has its own assumptions; where they part, the archive keeps both.',
    );
    expect(archiveText(small, 100, 5, 1)).toBe(
      'The Paleo-CO₂ Data Archive has no estimates by Paleosols within 5 million years of then.',
    );
  });
});
