import { describe, expect, it, vi } from 'vitest';

import real from '../../../public/data/humans/aadr-ice-age.json';
import type { IceAgeGenomes } from '../../data/iceAgeGenomes';
import { iceAgeDna } from './iceAgeDna';
import type { Lazy } from './lazy';

describe('the ice-age DNA sites', () => {
  it('asks for its file, and marks and opens nothing before it comes', () => {
    const ask = vi.fn();
    const dna = iceAgeDna({ value: null, ask });
    expect(dna.at(30, 'all')).toEqual({ sites: [], people: 0 });
    expect(ask).toHaveBeenCalled();
    expect(dna.card('dna-sunghir-russia')).toBeNull();
  });

  it('counts the people reached, gathering places once for the same file', () => {
    const file: Pick<Lazy<IceAgeGenomes>, 'value' | 'ask'> = {
      value: real as IceAgeGenomes,
      ask: () => undefined,
    };
    const dna = iceAgeDna(file);
    const early = dna.at(34, 'all');
    const late = dna.at(11.6, 'sapiens');
    expect(late.sites.length).toBeGreaterThan(early.sites.length);
    expect(late.people).toBe(real.people.length);
    expect(dna.at(12, 'erectus').sites).toEqual([]);
    expect(dna.card('dna-sunghir-russia')?.title).toBe('Ancient DNA: Sunghir, Russia');
  });
});
