import { describe, expect, it } from 'vitest';

import json from '../../../public/data/planetary-boundaries.json';
import {
  BOUNDARY_NAMES,
  loadPlanetaryBoundaries,
  type BoundaryId,
  type PlanetaryBoundaries,
} from '../../data/planetaryBoundaries';
import { LAYER_GROUPS } from '../../state/layerCatalog';
import { boundariesView, detailOf } from './boundariesLayer';

const data: PlanetaryBoundaries = await loadPlanetaryBoundaries('/pb.json', () =>
  Promise.resolve(new Response(JSON.stringify(json))),
);

describe('the planetary boundaries as a layer', () => {
  it('heads the panel with the assessment shown and its count', () => {
    const none = { compare: false, picked: null };
    expect(boundariesView(data, 'phc2026', none, new Set()).heading).toBe(
      'Planetary Health Check 2026: 7 of 9 boundaries crossed.',
    );
    expect(boundariesView(data, 'richardson2023', none, new Set()).heading).toBe(
      'Richardson et al. (2023): 6 of 9 boundaries crossed.',
    );
  });

  it('offers to compare only in 2026, with 2023 the one to compare with', () => {
    const asked = { compare: true, picked: null };
    expect(boundariesView(data, 'phc2026', asked, new Set()).compare.on).toBe(true);
    const then = boundariesView(data, 'richardson2023', asked, new Set());
    expect(then.compare).toMatchObject({ offered: false, on: false });
  });

  it('offers, for a boundary picked, the layers whose entries name it, and says which are on', () => {
    const climate = detailOf(data, 'climate', 'phc2026', null, new Set(['warming']));
    expect(climate?.layers).toEqual([
      { id: 'warming', label: 'Warming since 1850', on: true },
      { id: 'air', label: 'Air', on: false },
    ]);
    expect(climate?.status).toBe('crossed, into high risk');
    expect(climate?.values[0]).toMatch(/^Atmospheric CO₂: /);
    expect(detailOf(data, 'ozone', 'phc2026', null, new Set())?.layers.map(({ id }) => id)).toEqual(
      ['ozone'],
    );
    expect(detailOf(data, 'novel', 'phc2026', null, new Set())?.layers).toEqual([]);
  });

  it('gives 2023’s values beside 2026’s when comparing, and the 2026 words only for 2026', () => {
    const compared = detailOf(data, 'ocean', 'phc2026', 'richardson2023', new Set());
    expect(compared?.values[0]).toMatch(/; 2023: /);
    expect(compared?.summary).not.toBeNull();
    expect(detailOf(data, 'ocean', 'richardson2023', null, new Set())?.summary).toBeNull();
  });

  it('has every boundary a layer names be one of the nine', () => {
    const named = LAYER_GROUPS.flatMap((group) => group.layers).flatMap((layer) =>
      layer.boundary === undefined ? [] : [layer.boundary],
    );
    expect(named.length).toBeGreaterThan(0);
    for (const id of named) expect(Object.keys(BOUNDARY_NAMES)).toContain(id satisfies BoundaryId);
  });
});
