import { describe, expect, it, vi } from 'vitest';

import sites from '../../../public/data/extinctions.json';
import type { ExtinctionSites } from '../../data/extinctions';
import { ownTimeOf } from './ownTimeEvents';

const DATA = sites as ExtinctionSites;

const KYR = 1000 * 365.25 * 86_400;

describe('the extinctions in their own time (#1191, #1192, #1201)', () => {
  it('are all six: the end-Cretaceous, the three volcanic provinces and the two of the seas', () => {
    expect(ownTimeOf(DATA, 'k-pg-extinction', 66)?.key).toBe('Chicxulub');
    for (const [id, ma] of [
      ['end-permian-extinction', 251.9],
      ['end-triassic-extinction', 201.5],
      ['end-guadalupian-extinction', 259.8],
    ] as const)
      expect(ownTimeOf(DATA, id, ma)?.key).toBe(id);
    expect(ownTimeOf(DATA, 'late-devonian-extinction', 372.2)?.scale.marks[1]?.[1]).toBe(
      'First pulse',
    );
    expect(ownTimeOf(DATA, 'end-ordovician-extinction', 444)?.title).toBe(
      'The end-Ordovician, in its own time',
    );
    expect(ownTimeOf(DATA, 'no-such-extinction', 100)).toBeNull();
  });

  it('carry what each took, for the gauge on its clock (#1223)', () => {
    expect(ownTimeOf(DATA, 'k-pg-extinction', 66)?.loss?.lost).toEqual([0.38, 0.4]);
    expect(ownTimeOf(DATA, 'end-triassic-extinction', 201.5)?.loss?.lost).toEqual([0.33, 0.73]);
  });

  it('draw the end-Triassic’s dated window, its length the uncertain end (#1228)', () => {
    const dated = ownTimeOf(DATA, 'end-triassic-extinction', 201.5)?.dated;
    expect(dated?.from).toBe(0);
    expect(dated?.plusMinus[0]).toBe(0);
    expect(dated?.says).toMatch(/Blackburn.*Deenen.*Lindström/);
  });

  it('are none where their places are missing from the data', () => {
    const empty: ExtinctionSites = { ...DATA, sites: [] };
    expect(ownTimeOf(empty, 'end-triassic-extinction', 201.5)).toBeNull();
    expect(ownTimeOf(empty, 'k-pg-extinction', 66)).toBeNull();
    expect(ownTimeOf(empty, 'late-devonian-extinction', 372.2)).toBeNull();
  });

  it('turn the globe to the province, fume with the clock, and stop when closed', () => {
    const event = ownTimeOf(DATA, 'end-guadalupian-extinction', 259.8);
    const update = vi.fn();
    const strikes = { flyTo: vi.fn(), zoomTo: vi.fn() };
    const played = event?.play({
      strikes,
      layer: () => ({ update }),
    } as unknown as Parameters<NonNullable<typeof event>['play']>[0]);
    // The camera is the guide's, as the clock plays (#1266): one view, from a little south.
    expect(strikes.flyTo).not.toHaveBeenCalled();
    expect(event?.views).toHaveLength(1);
    played?.at(0);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ spread: 4 }));
    played?.end();
    expect(update).toHaveBeenLastCalledWith(null);
    expect(event?.offer).toBe('Watch the end-Guadalupian in its own time');
    expect(event?.scale.marks[0]?.[1]).toBe('Before');
    expect(ownTimeOf(DATA, 'end-triassic-extinction', 201.5)?.scale.marks[0]?.[1]).toBe('Rifting');
  });

  it('guide the camera from the traps to Meishan, then out to the world (#1266)', () => {
    const views = ownTimeOf(DATA, 'end-permian-extinction', 251.9)?.views ?? [];
    expect(views.map((view) => view.distance)).toEqual([2.3, 2.3, 4.5]);
    expect(views.map((view) => view.from)).toEqual([-Infinity, 2 * KYR, 75 * KYR]);
    const triassic = ownTimeOf(DATA, 'end-triassic-extinction', 201.5)?.views ?? [];
    expect(triassic).toHaveLength(3);
    const [, meishan] = views;
    expect(meishan?.place).not.toEqual(views[0]?.place);
  });

  it('linger at the end-Permian’s and end-Triassic’s key moments (#1267)', () => {
    expect(ownTimeOf(DATA, 'end-permian-extinction', 251.9)?.lingers).toEqual([
      -300 * KYR,
      0,
      2 * KYR,
      75 * KYR,
      5000 * KYR,
    ]);
    expect(ownTimeOf(DATA, 'end-triassic-extinction', 201.5)?.lingers).toHaveLength(4);
    expect(ownTimeOf(DATA, 'end-guadalupian-extinction', 259.8)?.lingers).toEqual([]);
  });

  it('key each clock’s marks and colours: no ice where there was none (#1268)', () => {
    const swatches = (id: string, ma: number) =>
      ownTimeOf(DATA, id, ma)?.legend?.map(([swatch]) => swatch);
    expect(swatches('end-permian-extinction', 251.9)).toEqual([
      'cause',
      'record',
      'smoke',
      'lava',
      'basalt',
    ]);
    expect(swatches('end-ordovician-extinction', 444)).toEqual([
      'cause',
      'record',
      'ice',
      'anoxia',
    ]);
    expect(swatches('late-devonian-extinction', 372)).toEqual(['cause', 'record', 'anoxia']);
  });

  it('draw a crisis of the seas with the clock, and take it away when closed', () => {
    const event = ownTimeOf(DATA, 'end-ordovician-extinction', 444);
    const update = vi.fn();
    const played = event?.play({
      strikes: { flyTo: vi.fn(), zoomTo: vi.fn() },
      layer: () => ({ update }),
    } as unknown as Parameters<NonNullable<typeof event>['play']>[0]);
    played?.at(0);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ spread: 22 }));
    played?.end();
    expect(update).toHaveBeenLastCalledWith(null);
  });

  it('draw the Deccan Traps fuming beside Chicxulub’s strike, outranking the strike alone (#1206)', () => {
    const event = ownTimeOf(DATA, 'k-pg-extinction', 66);
    expect(event?.rank).toBe(1);
    const strike = { at: vi.fn(), end: vi.fn(), moveTo: vi.fn(), held: () => false, hold: vi.fn() };
    const update = vi.fn();
    const played = event?.play({
      strikes: {
        flyTo: vi.fn(),
        zoomTo: vi.fn(),
        playImpact: () => strike,
        on: { dataset: {} },
      },
      layer: () => ({ update }),
    } as unknown as Parameters<NonNullable<typeof event>['play']>[0]);
    played?.at(5);
    expect(strike.at).toHaveBeenCalledWith(5);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ spread: 7 }));
    played?.end();
    expect(strike.end).toHaveBeenCalled();
    expect(update).toHaveBeenLastCalledWith(null);
    // Without the Deccan's place, the strike alone.
    const bare: ExtinctionSites = {
      ...DATA,
      sites: DATA.sites.filter((site) => site.id !== 'deccan-traps'),
    };
    expect(ownTimeOf(bare, 'k-pg-extinction', 66)?.rank).toBeUndefined();
  });
});
