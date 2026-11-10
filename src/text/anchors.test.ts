import { describe, expect, it } from 'vitest';

import { parseViewState } from '../state/url';
import { anchorLabel, anchorQuery } from './anchors';

const NOW = new Date('2026-11-11T00:00:00Z');

describe('anchors in words', () => {
  it('Given an anchor with a place and a year, Then it reads body, place and year', () => {
    expect(
      anchorLabel({ body: 'earth', at: [35.6017, 35.7822], when: [-1222, -1222], view: '' }),
    ).toBe('Earth · 35.6°N 35.8°E · 1223 BCE');
    expect(anchorLabel({ body: 'moon', at: [-8.97, -15.5], when: [1969, 1972], view: '' })).toBe(
      'The Moon · 9.0°S 15.5°W · 1969 CE – 1972 CE',
    );
    expect(anchorLabel({ body: 'io', view: '' })).toBe('Io');
  });
});

describe('anchors as links', () => {
  const reader =
    'v=1&mode=globe&t=2026-11-11T00:00Z&cal=gregorian&cam=0.0000,0.0000,3.00&focus=mars&layers=lunar,solar&why=all&ma=66.000';

  it('Given a reader on Mars in deep time, When an eclipse’s anchor opens, Then it shows that eclipse on Earth, their layers kept', () => {
    const query = anchorQuery(
      { body: 'earth', view: 't=-1222-03-05&sel=solar:-1222-03-05&layers=lunar,solar,empires' },
      reader,
    );
    const { state, warnings } = parseViewState(query, NOW);
    expect(warnings).toEqual([]);
    expect(state.focus).toBe('earth');
    expect(state.ma).toBeNull();
    expect(state.why).toBeNull();
    expect(state.time.date.year).toBe(-1222);
    expect([...state.layers].sort()).toEqual(['empires', 'lunar', 'solar']);
  });

  it('Given an anchor with no moment of its own, Then the reader’s moment stays', () => {
    const { state } = parseViewState(anchorQuery({ body: 'io', view: 'focus=io' }, reader), NOW);
    expect(state.focus).toBe('io');
    expect(state.time.date.year).toBe(2026);
    expect(state.ma).toBeNull();
  });

  it('Given a deep-time anchor, Then the reader’s moment gives way to it', () => {
    const query = anchorQuery(
      { body: 'earth', view: 'ma=540&scale=all&layers=' },
      'v=1&t=2000-01-01T00:00Z',
    );
    expect(query).not.toContain('t=');
    expect(parseViewState(query, NOW).state.ma).toBe(540);
  });
});
