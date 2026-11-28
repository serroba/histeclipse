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
    // No oxygen-poor seas drawn, and why (#1230).
    expect(ownTimeOf(DATA, 'k-pg-extinction', 66)?.drawn).toMatch(
      /No oxygen-poor seas.*Alegret et al\. 2021/,
    );
    // With the temperature after it, measured (#1229).
    expect(ownTimeOf(DATA, 'k-pg-extinction', 66)?.proxies?.map((each) => each.name)).toEqual([
      'Temperature',
    ]);
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
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ spread: 2.7 }));
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

  it('pin the end-Permian’s key facts at their places as its clock reaches them (#1268)', () => {
    const event = ownTimeOf(DATA, 'end-permian-extinction', 251.9);
    const update = vi.fn();
    const played = event?.play({
      strikes: { flyTo: vi.fn(), zoomTo: vi.fn() },
      layer: () => ({ update }),
    } as unknown as Parameters<NonNullable<typeof event>['play']>[0]);
    const pinned = () =>
      update.mock.calls.map(([input]: unknown[]) => input).findLast(Array.isArray) as
        readonly { text: string; source: string }[] | undefined;
    played?.at(-500 * KYR);
    expect(pinned()).toEqual([]);
    played?.at(10 * KYR);
    expect(pinned()?.map((each) => each.source)).toEqual(['Burgess & Bowring 2015; Stanley 2016']);
    played?.at(100 * KYR);
    expect(pinned()?.[0]?.text).toContain('sixfold');
    played?.end();
    expect(update).toHaveBeenLastCalledWith(null);
  });

  it('chart the end-Ordovician’s measured sea beside its clock (#1229)', () => {
    const names = (id: string, ma: number) =>
      ownTimeOf(DATA, id, ma)?.proxies?.map((each) => each.name);
    expect(names('end-ordovician-extinction', 444)).toEqual(['Temperature', 'Carbon isotopes']);
    expect(names('late-devonian-extinction', 372)).toEqual(['Oxygen isotopes']);
  });

  it('key each clock’s marks and colours: no ice where there was none (#1268)', () => {
    const swatches = (id: string, ma: number) =>
      ownTimeOf(DATA, id, ma)?.legend?.map(([swatch]) => swatch);
    // The end-Permian's and end-Triassic's oxygen-poor seas keyed too (#1230); the Guadalupian's none.
    for (const [id, ma] of [
      ['end-permian-extinction', 251.9],
      ['end-triassic-extinction', 201.5],
    ] as const) {
      expect(swatches(id, ma), id).toEqual([
        'cause',
        'record',
        'smoke',
        'lava',
        'basalt',
        'anoxia',
      ]);
    }
    expect(swatches('end-guadalupian-extinction', 259.8)).not.toContain('anoxia');
    expect(swatches('end-ordovician-extinction', 444)).toEqual([
      'cause',
      'record',
      'ice',
      'anoxia',
    ]);
    // The Late Devonian's with the Viluy Traps' lava too (#1230).
    expect(swatches('late-devonian-extinction', 372)).toEqual([
      'cause',
      'record',
      'anoxia',
      'lava',
      'basalt',
    ]);
  });

  it('say the end-Triassic’s oxygen-poor seas with both sides (#1230)', () => {
    const event = ownTimeOf(DATA, 'end-triassic-extinction', 201.5);
    expect(event?.drawn).toMatch(/Somlyay et al\. \(2023\).*Bond et al\. \(2023\)/);
  });

  it('draw the end-Permian’s oxygen-poor seas with its fumes, as they spread and ebb (#1230)', () => {
    const event = ownTimeOf(DATA, 'end-permian-extinction', 251.9);
    expect(event?.drawn).toMatch(/Pimentel-Galvan et al\. \(2022\).*Zhang et al\. \(2018\)/);
    const updates: unknown[] = [];
    const played = event?.play({
      strikes: { flyTo: vi.fn(), zoomTo: vi.fn() },
      layer: () => ({ update: (moment: unknown) => updates.push(moment) }),
    } as unknown as Parameters<NonNullable<typeof event>['play']>[0]);
    const seasAt = (seconds: number) => {
      updates.length = 0;
      played?.at(seconds);
      return updates.find(
        (moment): moment is { patches: readonly { reach: number }[] } =>
          typeof moment === 'object' && moment !== null && 'patches' in moment,
      );
    };
    const KYR = 1000 * 365.25 * 86_400;
    expect(seasAt(-100 * KYR)?.patches).toEqual([]);
    const height = seasAt(100 * KYR)?.patches[0]?.reach ?? 0;
    const aftermath = seasAt(1500 * KYR)?.patches[0]?.reach ?? 0;
    expect(height).toBeGreaterThan(aftermath);
    expect(aftermath).toBeGreaterThan(0);
    expect(seasAt(3000 * KYR)?.patches).toEqual([]);
    updates.length = 0;
    played?.end();
    expect(updates).toContain(null);
  });

  it('draw the Viluy Traps’ lava beside the Late Devonian’s seas, at Kravchinsky’s area (#1230)', () => {
    const event = ownTimeOf(DATA, 'late-devonian-extinction', 372);
    expect(event?.drawn).toMatch(/Kravchinsky \(2012\)/);
    const updates: unknown[] = [];
    const played = event?.play({
      strikes: { flyTo: vi.fn(), zoomTo: vi.fn() },
      layer: () => ({ update: (moment: unknown) => updates.push(moment) }),
    } as unknown as Parameters<NonNullable<typeof event>['play']>[0]);
    played?.at(0);
    const fumes = updates.find(
      (moment): moment is { spread: number; cover: number } =>
        typeof moment === 'object' && moment !== null && 'spread' in moment,
    );
    expect(fumes?.spread).toBe(3.8);
    expect(fumes?.cover).toBe(1);
    updates.length = 0;
    played?.end();
    expect(updates.filter((moment) => moment === null)).toHaveLength(2);
    // The camera over the traps first, the dated sea at the first pulse, then both (#1266).
    expect(event?.views?.map((view) => view.from)).toEqual([
      -Infinity,
      0,
      700 * 1000 * 365.25 * 86_400,
    ]);
    // Without the Viluy Traps in the data, the seas alone.
    const bare = { ...DATA, sites: DATA.sites.filter((site) => site.id !== 'viluy-traps') };
    expect(ownTimeOf(bare, 'late-devonian-extinction', 372)?.legend?.length).toBe(3);
  });

  it('draw a crisis of the seas with the clock, and take it away when closed', () => {
    const event = ownTimeOf(DATA, 'end-ordovician-extinction', 444);
    const update = vi.fn();
    const played = event?.play({
      strikes: { flyTo: vi.fn(), zoomTo: vi.fn() },
      layer: () => ({ update }),
    } as unknown as Parameters<NonNullable<typeof event>['play']>[0]);
    played?.at(0);
    const drawn = update.mock.lastCall?.[0] as { patches: readonly unknown[] } | undefined;
    expect(drawn?.patches).toHaveLength(9);
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
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ spread: 4.7 }));
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
