import { describe, expect, it, vi } from 'vitest';

import sites from '../../../public/data/extinctions.json';
import type { ExtinctionSites } from '../../data/extinctions';
import { ownTimeOf } from './ownTimeEvents';

const DATA = sites as ExtinctionSites;

describe('the extinctions in their own time (#1191, #1192, #1201)', () => {
  it('are the end-Cretaceous and the three volcanic provinces, none for the others', () => {
    expect(ownTimeOf(DATA, 'k-pg-extinction', 66)?.key).toBe('Chicxulub');
    for (const [id, ma] of [
      ['end-permian-extinction', 251.9],
      ['end-triassic-extinction', 201.5],
      ['end-guadalupian-extinction', 259.8],
    ] as const)
      expect(ownTimeOf(DATA, id, ma)?.key).toBe(id);
    expect(ownTimeOf(DATA, 'late-devonian-extinction', 372)).toBeNull();
  });

  it('are none where their places are missing from the data', () => {
    const empty: ExtinctionSites = { ...DATA, sites: [] };
    expect(ownTimeOf(empty, 'end-triassic-extinction', 201.5)).toBeNull();
    expect(ownTimeOf(empty, 'k-pg-extinction', 66)).toBeNull();
  });

  it('turn the globe to the province, fume with the clock, and stop when closed', () => {
    const event = ownTimeOf(DATA, 'end-guadalupian-extinction', 259.8);
    const update = vi.fn();
    const strikes = { flyTo: vi.fn(), zoomTo: vi.fn() };
    const played = event?.play({
      strikes,
      layer: () => ({ update }),
    } as unknown as Parameters<NonNullable<typeof event>['play']>[0]);
    expect(strikes.flyTo).toHaveBeenCalledTimes(1);
    played?.at(0);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ spread: 4 }));
    played?.end();
    expect(update).toHaveBeenLastCalledWith(null);
    expect(event?.offer).toBe('Watch the end-Guadalupian in its own time');
    expect(event?.scale.marks[0]?.[1]).toBe('Before');
    expect(ownTimeOf(DATA, 'end-triassic-extinction', 201.5)?.scale.marks[0]?.[1]).toBe(
      'Intrusions',
    );
  });
});
