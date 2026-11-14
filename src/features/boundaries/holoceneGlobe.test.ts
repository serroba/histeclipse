import { describe, expect, it } from 'vitest';

import { astronomicalYear } from '../../time/year';
import { defaultViewState, type ViewState } from '../../state/viewState';
import warmingJson from '../../../public/data/warming/index.json';
import type { MeasuredWarming } from '../../data/measuredWarming';
import {
  borrowedOf,
  givenBack,
  globeAt,
  MAPS_END_YEAR,
  measuredAt,
  storyDateAt,
} from './holoceneGlobe';

const reader: ViewState = {
  ...defaultViewState(new Date(Date.UTC(2026, 10, 12))),
  mode: 'sky',
  focus: 'moon',
  view: 'moon-from-earth',
  layers: new Set(['eclipses', 'empires']),
  temperatureModel: 'scotese',
  temperatureShow: 'actual',
  selection: {
    kind: 'solar',
    date: { year: astronomicalYear(-584), month: 5, day: 28, calendar: 'julian' },
  },
};

describe('the Holocene chapter’s globe', () => {
  it('goes to the year the chart has reached, on the ice-age scale', () => {
    const borrowed = borrowedOf(reader);
    const lgm = globeAt(reader, borrowed, -18_050);
    expect(lgm.ma).toBe(0.02);
    expect(lgm.deepScale).toBe('ice');
    expect(lgm.mode).toBe('globe');
    expect(lgm.focus).toBe('earth');
    expect(lgm.view).toBe('free');
    expect(lgm.selection).toBeNull();
    expect(globeAt(reader, borrowed, -798_050).ma).toBe(0.8);
    expect(globeAt(reader, borrowed, 2025).ma).toBe(0);
  });

  it('shows the sea level and Krapp’s temperature as the change from today', () => {
    const at = globeAt(reader, borrowedOf(reader), -18_050);
    expect([...at.layers].sort()).toEqual(['eclipses', 'empires', 'sealevel', 'temperature']);
    expect(at.temperatureModel).toBe('krapp');
    expect(at.temperatureShow).toBe('change');
  });

  it('turns the temperature off where the maps end, before industry', () => {
    const borrowed = borrowedOf({ ...reader, layers: new Set(['temperature']) });
    expect(globeAt(reader, borrowed, MAPS_END_YEAR - 1).layers.has('temperature')).toBe(true);
    expect(globeAt(reader, borrowed, MAPS_END_YEAR).layers.has('temperature')).toBe(false);
  });

  it('gives the reader’s view back, keeping what the story did not borrow', () => {
    const borrowed = borrowedOf(reader);
    const during = {
      ...globeAt(reader, borrowed, -18_050),
      boundaries: null,
      figures: 'all' as const,
    };
    const after = givenBack(during, borrowed);
    expect(after).toEqual({ ...reader, boundaries: null, figures: 'all' });
  });

  it('shows the measured warming from 1850, blended between its 5-year maps', () => {
    const warming = warmingJson as MeasuredWarming;
    const url = (file: string) => `/data/warming/${file}`;
    expect(measuredAt(warming, MAPS_END_YEAR - 1, url)).toBeNull();
    expect(measuredAt(warming, 2002, url)).toMatchObject({
      younger: '/data/warming/2005.png',
      older: '/data/warming/2000.png',
      mix: 0.6,
      change: true,
      coldest: warming.coldest,
    });
  });

  it('lends the chart cursor’s date, and from 1850 says the warming is measured', () => {
    expect(storyDateAt(-18_050)).toEqual({ when: '20,000 years ago', what: null });
    expect(storyDateAt(1975)).toEqual({
      when: '1975',
      what: 'Industrial era · measured warming, 5-year mean',
    });
  });
});
