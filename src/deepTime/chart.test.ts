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
