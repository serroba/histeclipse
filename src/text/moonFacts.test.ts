import { describe, expect, it } from 'vitest';

import data from '../../public/data/moon-orbits.json';
import { loadMoonOrbits, MOONS } from '../astro/moonOrbits';
import { SOURCES } from '../sources/registry';
import { MOON_FACTS, moonAbout, moonLine } from './moonFacts';

const serve = (body: string) => () => Promise.resolve(new Response(body));
const orbits = await loadMoonOrbits('moon-orbits.json', serve(JSON.stringify(data)));
const AU_KM = 149_597_870.7;

describe('what the bar says of each moon', () => {
  it('Given every moon drawn, Then each has its finder, its story, and sources the site lists', () => {
    for (const moon of Object.values(MOONS).flat()) {
      const { found, about, sources } = MOON_FACTS[moon];
      expect(found).not.toBe('');
      expect(about.length).toBeGreaterThan(40);
      expect(sources.length).toBeGreaterThan(0);
      for (const key of sources) expect(Object.keys(SOURCES)).toContain(key);
    }
  });

  it('Given the moons that may hold life, Then their stories say so, at more length than a small moon’s', () => {
    expect(MOON_FACTS.europa.about).toContain('ocean');
    expect(MOON_FACTS.enceladus.about).toContain('phosphates');
    expect(MOON_FACTS.titan.about).toContain('methane');
    expect(MOON_FACTS.enceladus.about.length).toBeGreaterThan(2 * MOON_FACTS.deimos.about.length);
  });

  it('Given Europa 4.27 AU away, Then its line says whose it is, its size, its orbit and its distance', () => {
    expect(moonLine('europa', orbits.europa, 4.27 * AU_KM)).toBe(
      'A moon of Jupiter · 3,122 km across · goes round every 3.55 days, 671,000 km out · 4.27 AU from Earth',
    );
  });

  it('Given a moon that goes round in under two days, Then its period is in hours', () => {
    expect(moonLine('phobos', orbits.phobos, AU_KM)).toContain('goes round every 7.7 hours');
  });

  it('Given a moon, Then its story starts with who found it', () => {
    expect(moonAbout('titan')).toMatch(/^Titan was found by Christiaan Huygens, March 1655\. /);
  });
});
