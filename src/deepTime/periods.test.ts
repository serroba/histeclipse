import { describe, expect, it } from 'vitest';

import { formatMa, PERIODS, periodAt, periodShort, periodWords } from './periods';

describe('geological periods', () => {
  it('run youngest to oldest without gaps', () => {
    const bases = PERIODS.map(({ base }) => base);
    expect(bases).toEqual([...bases].sort((a, b) => a - b));
  });

  it('name the period of a moment in deep time', () => {
    expect(periodAt(0)?.name).toBe('Quaternary');
    expect(periodAt(66)?.name).toBe('Paleogene');
    expect(periodAt(65.9)?.name).toBe('Paleogene');
    expect(periodAt(66.1)?.name).toBe('Cretaceous');
    // Pangaea at 250 Ma: the Triassic had just begun (251.902 Ma).
    expect(periodAt(250)).toMatchObject({ name: 'Triassic', era: 'Mesozoic' });
    expect(periodAt(540)?.name).toBe('Ediacaran');
    expect(periodAt(2000)?.name).toBe('Orosirian');
  });

  it('write ages in words', () => {
    expect(formatMa(0)).toBe('Today');
    expect(formatMa(250)).toBe('250 million years ago');
    expect(formatMa(1.5)).toBe('1,500,000 years ago');
    expect(formatMa(0.021)).toBe('21,000 years ago');
    expect(formatMa(2.999)).toBe('2,999,000 years ago');
    expect(formatMa(3)).toBe('3 million years ago');
    expect(formatMa(252.5)).toBe('252.5 million years ago');
    expect(formatMa(4200)).toBe('4,200 million years ago');
  });
});

describe('the Precambrian', () => {
  it('runs back to the Hadean, by period, era or eon', () => {
    const tonian = periodAt(900);
    const archean = periodAt(3000);
    const hadean = periodAt(4300);
    expect(tonian && periodWords(tonian)).toBe('Tonian period · Neoproterozoic era');
    expect(archean && periodWords(archean)).toBe('Mesoarchean era · Archean eon');
    expect(hadean && periodWords(hadean)).toBe('Hadean eon');
    expect(hadean && periodShort(hadean)).toBe('Hadean');
    expect(archean && periodShort(archean)).toBe('Mesoarchean · Archean');
    expect(periodAt(4031)?.name).toBe('Eoarchean');
    expect(periodAt(4032)?.name).toBe('Hadean');
    expect(periodAt(4600)).toBeNull();
  });

  it('keeps its bases in order', () => {
    const bases = PERIODS.map(({ base }) => base);
    expect(bases).toEqual([...bases].sort((a, b) => a - b));
  });
});
