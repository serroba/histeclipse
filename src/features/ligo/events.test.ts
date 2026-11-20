import { describe, expect, it } from 'vitest';

import { WAVE_CHAPTERS } from '../../state/slices/display';
import { SOURCES, WHYS } from '../../sources/registry';
import { NEUTRON_STAR_KM, openingChapter, separationKm, WAVE_EVENTS } from './events';
import { chirp, GW170817_MODEL, newtonianStrain } from './strain';

describe('the waves the story tells (#990)', () => {
  it('gives every event its title, card, why and words for each of its chapters, in order', () => {
    for (const [id, event] of Object.entries(WAVE_EVENTS)) {
      expect(event.id).toBe(id);
      expect(event.title).toContain(event.name);
      expect(event.card.title).toContain(event.name);
      expect(WHYS[event.why]).toBeDefined();
      expect(event.chapters[0]).toBe('source');
      const order = event.chapters.map((chapter) => WAVE_CHAPTERS.indexOf(chapter));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      for (const chapter of event.chapters)
        expect(event.about[chapter]?.length).toBeGreaterThan(80);
    }
  });

  it('cites, in each event’s why, sources the registry has', () => {
    for (const event of Object.values(WAVE_EVENTS)) {
      for (const source of WHYS[event.why].sources) expect(SOURCES[source]).toBeDefined();
    }
  });

  it('draws GW150914 as two black holes and GW170817 as two neutron stars', () => {
    expect(WAVE_EVENTS.gw150914.bodies.kind).toBe('black holes');
    expect(WAVE_EVENTS.gw170817.bodies.kind).toBe('neutron stars');
    expect(WAVE_EVENTS.gw170817.title).toContain('neutron stars');
    expect(WAVE_EVENTS.gw170817.card.facts.map(([name]) => name)).toContain(
      'The two neutron stars',
    );
  });

  it('opens a chapter the story has, or else its source', () => {
    expect(openingChapter(WAVE_EVENTS.gw150914, 'journey')).toBe('journey');
    expect(openingChapter(WAVE_EVENTS.gw170817, 'journey')).toBe('journey');
    expect(openingChapter(WAVE_EVENTS.gw150914, 'kilonova')).toBe('source');
    expect(openingChapter(WAVE_EVENTS.gw170817, 'detector')).toBe('detector');
  });
});

describe('GW170817’s neutron stars, to size (#991)', () => {
  it('puts them about 84 km apart when the wave is at 250 Hz, and touching near 1.5 kHz', () => {
    // Kepler: the orbit goes round at half the wave's frequency.
    expect(separationKm(2.73, 250)).toBeCloseTo(83.7, 0);
    expect(separationKm(2.73, 1500)).toBeCloseTo(25.4, 0);
    expect(2 * NEUTRON_STAR_KM).toBeLessThan(separationKm(2.73, 1500));
    expect(2 * NEUTRON_STAR_KM).toBeGreaterThan(separationKm(2.73, 1700));
  });

  it('draws each star 11.9 km against that distance, a seventh of it', () => {
    const { sizes } = WAVE_EVENTS.gw170817.bodies;
    expect(sizes.first).toBeCloseTo(NEUTRON_STAR_KM / 83.7, 3);
    expect(sizes.second).toBe(sizes.first);
    expect(sizes.final).toBeGreaterThan(sizes.first);
  });
});

describe('GW170817’s model wave (#990)', () => {
  const wave = chirp(GW170817_MODEL);

  it('plays its last fifth of a second, from 250 Hz to the merger near 1.5 kHz, then stops', () => {
    expect(-wave.start).toBeGreaterThan(0.15);
    expect(-wave.start).toBeLessThan(0.25);
    expect(wave.frequency(wave.start)).toBeCloseTo(250, 6);
    expect(wave.frequency(0)).toBeCloseTo(1500, 6);
    expect(wave.end).toBe(0);
    expect(wave.at(0.001)).toEqual({ plus: 0, cross: 0 });
  });

  it('was in band about 100 s from 24 Hz, as the paper says', () => {
    const fromHeard = chirp({ ...GW170817_MODEL, from: 24 });
    expect(-fromHeard.start).toBeGreaterThan(80);
    expect(-fromHeard.start).toBeLessThan(120);
  });

  it('peaks near 5 × 10⁻²², weaker than GW150914’s 10⁻²¹ though ten times nearer', () => {
    expect(wave.peak).toBeCloseTo(5.3e-22, 23);
    expect(Math.hypot(wave.at(0).plus, wave.at(0).cross)).toBeCloseTo(wave.peak, 30);
    // The strain grows as f^⅔ and falls as 1/D.
    expect(newtonianStrain(1.1977, 1500, 80) / newtonianStrain(1.1977, 1500, 40)).toBeCloseTo(
      0.5,
      12,
    );
    expect(newtonianStrain(1.1977, 1000, 40) / newtonianStrain(1.1977, 125, 40)).toBeCloseTo(4, 12);
  });
});
