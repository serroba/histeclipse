import { describe, expect, it, vi } from 'vitest';

import data from '../../../public/data/impacts.json';
import { loadImpacts, placeThen, type Impacts } from '../../data/impacts';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import {
  impactCard,
  impactPlay,
  impactsOn,
  impactsScale,
  pickedImpact,
  placeMaFor,
  sinceYear,
  strikesToPlay,
  struckList,
  STRIKES_AT_ONCE,
} from './view';

const base = defaultViewState(new Date(Date.UTC(2024, 3, 8)));
const on: ViewState = { ...base, layers: withLayer(base.layers, 'impacts', true) };
const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));
const impacts: Impacts = await loadImpacts('/i.json', serve(data));
const named = (name: string) => {
  const found = impacts.impacts.find((each) => each.name === name);
  if (found === undefined) throw new Error(name);
  return found;
};

describe('where the craters are drawn', () => {
  it('past the elevation maps on the whole span, on the eons; else on the span chosen', () => {
    expect(impactsScale({ ...on, ma: 1000, deepScale: 'all' }, 500)).toBe('eons');
    expect(impactsScale({ ...on, ma: 100, deepScale: 'all' }, 500)).toBe('all');
    expect(impactsScale({ ...on, ma: 1000, deepScale: 'ice' }, 500)).toBe('ice');
    expect(impactsScale(on, 500)).toBe(base.deepScale);
  });
  it('with the layer on, on the globe, in the years or below the eons', () => {
    expect(impactsOn(on, 'all')).toBe(true);
    expect(impactsOn(base, 'all')).toBe(false);
    expect(impactsOn({ ...on, mode: 'sky' }, 'all')).toBe(false);
    expect(impactsOn({ ...on, ma: 1000 }, 'eons')).toBe(false);
    expect(impactsOn({ ...on, ma: 100 }, 'all')).toBe(true);
  });
  it('in the years, as of the year shown before present; on the ice-age scale, today', () => {
    const year = (y: number): ViewState => ({
      ...on,
      time: { ...on.time, date: { ...on.time.date, year: astronomicalYear(y) } },
    });
    expect(sinceYear(year(2024))).toBe(0);
    expect(sinceYear(year(-50))).toBeCloseTo(0.002);
    expect(placeMaFor('ice', 20)).toBe(0);
    expect(placeMaFor('all', 20)).toBe(20);
  });
});

describe('strikes as deep time runs', () => {
  it('plays those passed on the side in view, the greatest few, the greatest last', () => {
    const chicxulub = named('Chicxulub');
    const facing = placeThen(impacts, chicxulub, 66);
    expect(facing).not.toBeNull();
    if (facing === null) return;
    const played = strikesToPlay(impacts, 66.2, 65.9, 66, facing);
    expect(played.map((each) => each.impact.name)).toContain('Chicxulub');
    expect(played.length).toBeLessThanOrEqual(STRIKES_AT_ONCE);
    const sizes = played.map((each) => each.impact.diameterKm ?? 0);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    const away = { latitude: -facing.latitude, longitude: facing.longitude + 180 };
    expect(strikesToPlay(impacts, 66.2, 65.9, 66, away).map((e) => e.impact.name)).not.toContain(
      'Chicxulub',
    );
  });
  it('keeps the latest twelve struck', () => {
    expect(struckList(undefined, 'A')).toBe('A');
    let list: string | undefined;
    for (let i = 0; i < 14; i++) list = struckList(list, String(i));
    expect(list?.split('|')).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
    ]);
  });
});

describe('a crater tapped', () => {
  it('is found by its key, once the craters have loaded', () => {
    const chicxulub = named('Chicxulub');
    expect(pickedImpact(impacts, `impact:${String(chicxulub.id)}`)).toBe(chicxulub);
    expect(pickedImpact(impacts, 'asteroid:26')).toBeUndefined();
    expect(pickedImpact(null, `impact:${String(chicxulub.id)}`)).toBeUndefined();
  });
  it('has a card with its impactor and a play of it, where its size is known', () => {
    const play = vi.fn();
    const card = impactCard(impacts, named('Chicxulub'), 0, play);
    expect(card.facts.map(([label]) => label)).toContain('Impactor');
    card.action?.run();
    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ craterKm: 180, place: placeThen(impacts, named('Chicxulub'), 0) }),
    );
  });
  it('has no impactor and no play without its size', () => {
    const card = impactCard(impacts, named('Barringer'), 0, vi.fn());
    expect(card.facts.map(([label]) => label)).not.toContain('Impactor');
    expect(card.action).toBeUndefined();
  });
  it('is played from its approach', () => {
    const spec = impactPlay('Chicxulub', { latitude: 21, longitude: -89 }, 180);
    expect(spec.craterKm).toBe(180);
    expect(Number.isFinite(spec.fromAzimuth)).toBe(true);
    expect(Number.isFinite(spec.angleDegrees)).toBe(true);
  });
});
