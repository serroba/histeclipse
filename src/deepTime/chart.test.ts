import { describe, expect, it } from 'vitest';

import { bandsFor, CHART } from './chart';

describe('the chronostratigraphic chart', () => {
  it('holds the chart’s units with their colours', () => {
    const jurassic = CHART.units.find((unit) => unit.id === 'Jurassic');
    expect(jurassic).toMatchObject({ base: 201.4, top: 143.1, colour: '#34B2C9', rank: 'Period' });
  });

  it('draws the periods along the Phanerozoic, oldest first, filling it', () => {
    const bands = bandsFor(540);
    expect(bands.map((band) => band.unit.name).slice(0, 3)).toEqual([
      'Ediacaran',
      'Cambrian',
      'Ordovician',
    ]);
    expect(bands.at(-1)?.unit.name).toBe('Quaternary');
    const total = bands.reduce((sum, band) => sum + band.width, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(bands[0]?.left).toBe(0);
  });

  it('draws the Quaternary’s divisions over the ice ages, the eras over Earth’s history', () => {
    expect(bandsFor(2.6).map((band) => band.unit.name)).toEqual([
      'Gelasian',
      'Calabrian',
      'Chibanian',
      'Upper Pleistocene',
      'Holocene',
    ]);
    expect(bandsFor(0.0117).map((band) => band.unit.name)).toEqual([
      'Greenlandian',
      'Northgrippian',
      'Meghalayan',
    ]);
    const eras = bandsFor(4567).map((band) => band.unit.name);
    expect(eras[0]).toBe('Hadean');
    expect(eras).toContain('Mesozoic');
  });
});

describe('the bands of a part of a span (#1074)', () => {
  it('Given 124 to 76 Ma, Then the Cretaceous alone fills the bar', () => {
    const bands = bandsFor(124, undefined, 76);
    expect(bands.map(({ unit }) => unit.name)).toEqual(['Cretaceous']);
    expect(bands[0]?.left).toBe(0);
    expect(bands[0]?.width).toBeCloseTo(1, 9);
  });

  it('Given 80 to 50 Ma, Then the Cretaceous and the Paleogene share it at 66 Ma', () => {
    const [cretaceous, paleogene] = bandsFor(80, undefined, 50);
    expect(cretaceous?.unit.name).toBe('Cretaceous');
    expect(paleogene?.unit.name).toBe('Paleogene');
    expect(paleogene?.left).toBeCloseTo((80 - 66) / 30, 2);
    expect((paleogene?.left ?? 0) + (paleogene?.width ?? 0)).toBeCloseTo(1, 9);
  });
});
