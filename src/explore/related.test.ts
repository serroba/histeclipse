import { describe, expect, it } from 'vitest';

import { destinationNear, fromACraft, fromAFind, fromAFossil, whenItStruck } from './related';

describe('related discoveries', () => {
  it('Given a dated crater, Then it leads to the Earth at the middle of its range, saying so', () => {
    const chicxulub = whenItStruck(66.05, 66.03, null);
    expect(chicxulub?.ma).toBe(66);
    expect(chicxulub?.label).toBe('Earth when it struck');
    expect(chicxulub?.explain).toMatch(/^Goes to 66 million years ago \(dated/);
    expect(whenItStruck(100, 100, null)?.explain).toBe(
      'Goes to 100 million years ago, the crater where the plates had it.',
    );
  });

  it('Given an undated, too old, or already shown crater, Then nothing is offered', () => {
    expect(whenItStruck(null, 10, null)).toBeNull();
    expect(whenItStruck(10, null, null)).toBeNull();
    expect(whenItStruck(2023, 2023, null)).toBeNull();
    expect(whenItStruck(66, 66, 64)).toBeNull();
    expect(whenItStruck(66, 66, 50)).not.toBeNull();
  });

  it('Given a find, Then dispersal unless it is drawn, and ancient DNA with its change of time', () => {
    expect(fromAFind(false).spread?.label).toBe('People spreading out of Africa');
    expect(fromAFind(true).spread).toBeNull();
    expect(fromAFind(true).dna.explain).toContain('3000 BCE');
  });

  it('Given a fossil or a craft, Then one step at most, none where it is already shown', () => {
    expect(fromAFossil(false)).toHaveLength(1);
    expect(fromAFossil(true)).toEqual([]);
    expect(fromACraft('Apollo 11', false, '16 July 1969')).toEqual([
      {
        label: 'Follow Apollo 11',
        explain: 'Goes to 16 July 1969, its journey played from the start.',
      },
    ]);
    expect(fromACraft('Apollo 11', true, '16 July 1969')).toEqual([]);
  });

  it('Given a find’s place, Then Ancient DNA opens there; an unknown destination gives nothing', () => {
    expect(destinationNear('ancient-dna', { latitude: 31.85, longitude: -8.87 })?.view).toBe(
      't=-2999-06-01T12:00Z&layers=genomes&cam=31.8500,-8.8700,3.00&yw=-5399,-599&explore=ancient-dna',
    );
    expect(destinationNear('atlantis', { latitude: 0, longitude: 0 })).toBeNull();
  });
});
