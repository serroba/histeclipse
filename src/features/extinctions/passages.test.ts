import { describe, expect, it } from 'vitest';

import sites from '../../../public/data/extinctions.json';
import type { ExtinctionSites } from '../../data/extinctions';
import { SOURCES } from '../../sources/registry';
import { extinctionPassages } from './passages';

const passages = extinctionPassages(sites as ExtinctionSites);

describe('the extinctions as passages for search (#1210)', () => {
  it('are one for each extinction, the famous ones with their common names', () => {
    expect(passages.map((passage) => passage.id)).toEqual([
      'extinction:end-ordovician-extinction',
      'extinction:late-devonian-extinction',
      'extinction:end-guadalupian-extinction',
      'extinction:end-permian-extinction',
      'extinction:end-triassic-extinction',
      'extinction:k-pg-extinction',
    ]);
    expect(passages[3]?.title).toBe('End-Permian mass extinction: the Great Dying');
    expect(passages[5]?.title).toBe('End-Cretaceous extinction: the end of the dinosaurs');
    expect(passages[0]?.title).toBe('End-Ordovician mass extinction');
  });

  it('hold what each own clock says, phase by phase, and the list’s own argument', () => {
    const permian = passages[3]?.text ?? '';
    expect(permian).toContain('The Great Dying.');
    expect(permian).toContain('Siberian Traps');
    expect(permian).toContain('“Big Five”');
    expect(passages[5]?.text).toContain('Coming in.');
  });

  it('rest on registered sources, the clocks’ included', () => {
    for (const passage of passages) {
      expect(passage.sources.length).toBeGreaterThan(3);
      for (const id of passage.sources) expect(SOURCES).toHaveProperty(id);
    }
    expect(passages[3]?.sources).toContain('penn2018');
    expect(passages[5]?.sources).toContain('bardeen2017');
  });

  it('open each at its moment, the layer on, the globe at each of its places then', () => {
    const permian = passages[3];
    expect(permian?.anchors.map((anchor) => anchor.label)).toEqual([
      'Siberian Traps, Putorana, 251.9 million years ago',
      'Siberian Traps, Norilsk, 251.9 million years ago',
      'Meishan, China, 251.9 million years ago',
    ]);
    const [first] = permian?.anchors ?? [];
    expect(first?.view).toMatch(
      /^layers=extinctions&ma=251\.9&scale=all&cam=5\d\.\d{4},3\d\.\d{4},2\.60$/,
    );
    expect(first?.at?.[0]).toBeGreaterThan(50);
  });
});
