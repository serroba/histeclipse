import { describe, expect, it } from 'vitest';

import { parseViewState } from '../state/url';
import { fitQuery, frameSpan, frameWords, showsFrame, type TimeFrame } from './frame';

const NOW = new Date('2026-11-15T00:00:00Z');
const at = (query: string) => parseViewState(query, NOW).state;

const FINDS: TimeFrame = { kind: 'ma', from: 0.32, to: 0.04 };
const AGE: TimeFrame = { kind: 'ma', from: 120, to: 80 };
const MISSIONS: TimeFrame = { kind: 'years', from: 1969, to: 1972 };

describe('a subject’s time', () => {
  it('Given frames of each depth, Then each is drawn on the narrowest span holding its oldest moment', () => {
    expect(frameSpan(MISSIONS)).toBe('years');
    expect(frameSpan(FINDS)).toBe('ice');
    expect(frameSpan({ kind: 'ma', from: 2.6, to: 1 })).toBe('ice');
    expect(frameSpan(AGE)).toBe('all');
    expect(frameSpan({ kind: 'ma', from: 540, to: 500 })).toBe('all');
    expect(frameSpan({ kind: 'ma', from: 3500, to: 3000 })).toBe('eons');
  });

  it('Given views in and out of a frame, Then only those inside it, on its span, show it', () => {
    expect(showsFrame(at('t=1969-07-20T20:17Z'), MISSIONS)).toBe(true);
    expect(showsFrame(at('t=1972-12-11T00:00Z'), MISSIONS)).toBe(true);
    expect(showsFrame(at('t=1973-01-01T00:00Z'), MISSIONS)).toBe(false);
    // The same years seen from deep time are not the years.
    expect(showsFrame(at('t=1969-07-20T20:17Z&ma=0.1&scale=ice'), MISSIONS)).toBe(false);
    expect(showsFrame(at('ma=0.315&scale=ice'), FINDS)).toBe(true);
    expect(showsFrame(at('ma=0.315&scale=all'), FINDS)).toBe(false);
    expect(showsFrame(at('ma=0.5&scale=ice'), FINDS)).toBe(false);
    expect(showsFrame(at('ma=0.021&scale=ice'), FINDS)).toBe(false);
    expect(showsFrame(at(''), FINDS)).toBe(false);
    expect(showsFrame(at('ma=100'), AGE)).toBe(true);
  });

  it('Given frames, Then they read in words, a single moment once', () => {
    expect(frameWords(MISSIONS)).toBe('1969 CE – 1972 CE');
    expect(frameWords(FINDS)).toBe('320,000 years ago – 40,000 years ago');
    expect(frameWords(AGE)).toBe('120 million years ago – 80 million years ago');
    expect(frameWords({ kind: 'years', from: -584, to: -584 })).toBe('585 BCE');
  });

  it('Given a reader elsewhere, When the time is fitted, Then the moment and span are the subject’s and the rest is theirs', () => {
    const reader = 't=2026-01-01T12:00Z&cal=gregorian&cam=1,2,3&layers=empires&focus=moon&ma=300';
    expect(fitQuery('focus=moon&cam=0,0,2&t=1969-07-20T20:17Z&mission=d00273', reader)).toBe(
      'cam=1,2,3&layers=empires&focus=moon&t=1969-07-20T20:17Z&mission=d00273',
    );
    expect(fitQuery('ma=0.315&scale=ice&cam=10,5,3', reader)).toBe(
      'cam=1,2,3&layers=empires&focus=moon&ma=0.315&scale=ice',
    );
  });
});
