import { describe, expect, it } from 'vitest';

import data from '../../public/data/tree-of-life.json';
import fixture from '../../e2e/fixtures/tree-of-life.json';
import { hasFlag, lineage, loadTreeOfLife, namedLineage, type TreeOfLife } from './treeOfLife';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));
const real = data as TreeOfLife;

describe('the tree of life (Open Tree of Life, trimmed)', () => {
  it('loads and checks the real file, and refuses a broken one', async () => {
    await expect(loadTreeOfLife('/t.json', serve(real))).resolves.toEqual(real);
    const orphan = { ...real, parent: [-1, 5, ...real.parent.slice(2)] };
    await expect(loadTreeOfLife('/t.json', serve(orphan))).rejects.toThrow();
    const short = { ...real, name: real.name.slice(1) };
    await expect(loadTreeOfLife('/t.json', serve(short))).rejects.toThrow();
    const lost = { ...real, ours: { ...real.ours, humans: { sapiens: real.parent.length } } };
    await expect(loadTreeOfLife('/t.json', serve(lost))).rejects.toThrow();
    const unlisted = { ...real, rank: [real.ranks.length, ...real.rank.slice(1)] };
    await expect(loadTreeOfLife('/t.json', serve(unlisted))).rejects.toThrow();
  });

  it('keeps real ancestry and flags in the small PR navigation fixture', async () => {
    const small = await loadTreeOfLife('/fixture.json', serve(fixture));
    expect(small.parent.length).toBeLessThan(100);
    for (const name of [
      'Homo sapiens',
      'Homo sapiens neanderthalensis',
      'Tyrannosaurus',
      'Triceratops',
    ]) {
      const node = small.name.indexOf(name);
      const source = real.name.indexOf(name);
      expect(node).toBeGreaterThanOrEqual(0);
      expect(namedLineage(small, node)).toEqual(namedLineage(real, source));
      expect(small.ott[node]).toBe(real.ott[source]);
      expect(small.nodeFlags[node]).toBe(real.nodeFlags[source]);
    }
    expect(small.name[small.ours.humans['sapiens'] ?? -1]).toBe('Homo sapiens');
  });

  it('places our species among the primates and mammals', () => {
    const sapiens = real.ours.humans['sapiens'] ?? -1;
    const line = namedLineage(real, sapiens);
    expect(line[0]).toBe('Homo sapiens');
    expect(line).toContain('Primates');
    expect(line).toContain('Mammalia');
    expect(line.at(-1)).toBe('cellular organisms');
    expect(lineage(real, sapiens).at(-1)).toBe(0);
  });

  it('hangs fossil genera on the tree, most by the taxonomy alone, extinct', () => {
    const olenus = real.ours.fossilGenera['Olenus'] ?? -1;
    expect(namedLineage(real, olenus)).toContain('Trilobita');
    expect(hasFlag(real, olenus, 'extinct')).toBe(true);
    expect(hasFlag(real, olenus, 'taxonomyOnly')).toBe(true);
    expect(Object.keys(real.ours.fossilGroups).sort()).toEqual([
      'ammonoids',
      'dinosaurs',
      'mammals',
      'trilobites',
    ]);
    // Matched within the groups' clades; the rest are listed, not guessed.
    const matched = Object.keys(real.ours.fossilGenera).length;
    expect(matched + real.unmatched.missing.length + real.unmatched.ambiguous.length).toBe(5233);
  });

  it('marks which groups published phylogenies support', () => {
    const mammals = real.ours.fossilGroups['mammals'] ?? -1;
    expect(hasFlag(real, mammals, 'taxonomyOnly')).toBe(false);
    expect(real.nodeFlags.some((flags) => (flags & real.flags.phylogeny) !== 0)).toBe(true);
  });
});
