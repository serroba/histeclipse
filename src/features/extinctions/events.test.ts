import { describe, expect, it } from 'vitest';

import { MILESTONES } from '../../deepTime/milestones';
import { SOURCES } from '../../sources/registry';
import { ABOUT_THE_LIST, claimLinks, estimatesOf, extinctionOf, EXTINCTIONS } from './events';

describe('the great extinctions', () => {
  it('rest every claim on registered sources', () => {
    for (const each of [...EXTINCTIONS.flatMap((one) => [one.lost, one.causes]), ABOUT_THE_LIST]) {
      expect(each.sources.length).toBeGreaterThan(0);
      for (const id of each.sources) expect(SOURCES).toHaveProperty(id);
    }
  });

  it('count the usual five, each with its milestone, and the end-Guadalupian as argued', () => {
    const five = EXTINCTIONS.filter((each) => each.counted === 'five');
    expect(five).toHaveLength(5);
    for (const each of five) expect(MILESTONES.map((one) => one.id)).toContain(each.id);
    expect(extinctionOf('end-guadalupian-extinction')?.counted).toBe('argued');
    expect(extinctionOf('nothing')).toBeUndefined();
  });

  it('are listed oldest first, each near its milestone’s dates', () => {
    const ages = EXTINCTIONS.map((each) => each.ma);
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
    for (const each of EXTINCTIONS) {
      const milestone = MILESTONES.find((one) => one.id === each.id);
      for (const { min, max } of milestone?.estimates ?? []) {
        expect(Math.abs(each.ma - (min + max) / 2)).toBeLessThan(1.5);
      }
    }
  });

  it('say their dates as their milestones give them, a range or one age', () => {
    const permian = extinctionOf('end-permian-extinction');
    const cretaceous = extinctionOf('k-pg-extinction');
    const guadalupian = extinctionOf('end-guadalupian-extinction');
    if (permian === undefined || cretaceous === undefined || guadalupian === undefined)
      throw new Error('missing');
    expect(estimatesOf(permian)).toEqual([
      'Extinction, Meishan, China (uranium–lead dating): 251.978–251.849 Ma',
    ]);
    expect(estimatesOf(cretaceous)[1]).toBe('Cretaceous–Paleogene boundary: 66 Ma');
    expect(estimatesOf(guadalupian)).toEqual([]);
  });

  it('link each source once', () => {
    const links = claimLinks([
      { text: '', sources: ['schulte2010', 'hull2020'] },
      { text: '', sources: ['schulte2010'] },
    ]);
    expect(links.map((link) => link.label)).toEqual([
      SOURCES.schulte2010.name,
      SOURCES.hull2020.name,
    ]);
    expect(links[0]?.href).toBe(SOURCES.schulte2010.url);
  });
});
