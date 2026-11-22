import { describe, expect, it } from 'vitest';

import { parseViewState } from '../state/url';
import { fitQuery, frameSpan, frameWindow, frameWords, showsFrame, type TimeFrame } from './frame';

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
    expect(showsFrame(at('t=1969-07-20T20:17Z&yw=1966,1976'), MISSIONS)).toBe(true);
    expect(showsFrame(at('t=1972-12-11T00:00Z&yw=1966,1976'), MISSIONS)).toBe(true);
    expect(showsFrame(at('t=1973-01-01T00:00Z&yw=1966,1976'), MISSIONS)).toBe(false);
    // The same years seen from deep time are not the years.
    expect(showsFrame(at('t=1969-07-20T20:17Z&ma=0.1&scale=ice'), MISSIONS)).toBe(false);
    expect(showsFrame(at('ma=0.315&scale=ice&dw=0.348,0.012'), FINDS)).toBe(true);
    expect(showsFrame(at('ma=0.315&scale=all'), FINDS)).toBe(false);
    expect(showsFrame(at('ma=0.5&scale=ice'), FINDS)).toBe(false);
    expect(showsFrame(at('ma=0.021&scale=ice&dw=0.348,0.012'), FINDS)).toBe(false);
    expect(showsFrame(at(''), FINDS)).toBe(false);
    expect(showsFrame(at('ma=100&dw=124,76'), AGE)).toBe(true);
  });

  it('Given the moment inside a frame but the bar not fitted to it (#749), Then Fit is offered', () => {
    // The whole 540 million years: Ancient Australia's 40 sit in a sliver of it.
    expect(showsFrame(at('ma=100'), AGE)).toBe(false);
    // Zoomed out to more than twice the fit, or slid so the frame's end is off the bar.
    expect(showsFrame(at('ma=100&dw=160,40'), AGE)).toBe(false);
    expect(showsFrame(at('ma=100&dw=110,62'), AGE)).toBe(false);
    // Zoomed in a little, or out a little, it still frames it.
    expect(showsFrame(at('ma=100&dw=130,70'), AGE)).toBe(true);
    expect(showsFrame(at('t=1969-07-20T20:17Z'), MISSIONS)).toBe(false);
    expect(showsFrame(at('t=1969-07-20T20:17Z&yw=1960,1980'), MISSIONS)).toBe(true);
    // A frame that is a whole span is shown by the whole span.
    const all: TimeFrame = { kind: 'ma', from: 4568, to: 0 };
    expect(showsFrame(at('ma=3000&scale=eons'), all)).toBe(true);
    const years: TimeFrame = { kind: 'years', from: -9699, to: 2026 };
    expect(showsFrame(at('t=1500-06-01T12:00Z'), years)).toBe(true);
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

  it('Given Ancient Australia, When fitted, Then the bar shows 120 to 80 Ma and a tenth more each side (#749, #1078)', () => {
    const reader = 'cam=1,2,3&yw=1854,2026';
    expect(
      fitQuery('ma=100&scale=all&layers=plates', reader, { kind: 'ma', from: 120, to: 80 }, 2026),
    ).toBe('cam=1,2,3&ma=100&scale=all&dw=124,76');
  });

  it('Given other frames, Then their windows: the finds’ on the ice ages, the missions a decade, a single eclipse a decade about it', () => {
    expect(frameWindow({ kind: 'ma', from: 0.32, to: 0.04 }, 2026)).toEqual({
      scale: 'ice',
      dw: '0.348,0.012',
    });
    expect(frameWindow(MISSIONS, 2026)).toEqual({ yw: '1966,1976' });
    expect(frameWindow({ kind: 'years', from: -584, to: -584 }, 2026)).toEqual({ yw: '-589,-579' });
    expect(frameWindow({ kind: 'years', from: -9699, to: 2026 }, 2026)).toEqual({});
    expect(frameWindow({ kind: 'ma', from: 4568, to: 0 }, 2026)).toEqual({ scale: 'eons' });
  });
});
