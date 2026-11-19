import { describe, expect, it } from 'vitest';

import {
  NARROWEST,
  clampWindow,
  fitFor,
  layerSpan,
  panned,
  windowChoices,
  windowOf,
  windowText,
  windowValue,
  zoomed,
} from './yearsWindow';

const WHOLE = { first: -9699, last: 2026 };

describe('the years the bar shows (#749)', () => {
  it('Given a layer with its years, Then its span; none for one without', () => {
    expect(layerSpan('enso')).toEqual({ first: 1854, last: 2026 });
    expect(layerSpan('warming')).toEqual({ first: 1850, last: 2025 });
    expect(layerSpan('rocks')).toBeNull();
  });

  it('Given layers turned on, Then the years they cover between them; none without spans', () => {
    expect(fitFor(['enso', 'warming'])).toEqual({ first: 1850, last: 2026 });
    expect(fitFor(['rocks'])).toBeNull();
    expect(fitFor([])).toBeNull();
  });

  it('Given a window, Then held to the track and the narrowest; the whole track is none', () => {
    expect(clampWindow({ first: 1854.4, last: 2026 }, WHOLE)).toEqual({ first: 1854, last: 2026 });
    expect(clampWindow({ first: -53049, last: 1950 }, WHOLE)).toEqual({ first: -9699, last: 1950 });
    expect(clampWindow({ first: -20000, last: 3000 }, WHOLE)).toBeNull();
    expect(clampWindow({ first: 2000, last: 2002 }, WHOLE)).toEqual({ first: 1996, last: 2006 });
    expect(clampWindow({ first: 2025, last: 2026 }, WHOLE)).toEqual({
      first: 2026 - NARROWEST,
      last: 2026,
    });
  });

  it('Given windows, Then their words and values, and values back', () => {
    expect(windowText({ first: 1854, last: 2026 })).toBe('1854–2026');
    expect(windowText(WHOLE)).toBe('9700 BCE–2026');
    expect(windowValue(null)).toBe('all');
    expect(windowValue({ first: 1854, last: 2026 })).toBe('1854,2026');
    expect(windowOf('1854,2026')).toEqual({ first: 1854, last: 2026 });
    expect(['all', '2026,1854', 'a,b', '1854', '1854.5,2026'].map(windowOf)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('Given the layers on, Then the presets, each layer’s years, and the window shown, none twice', () => {
    const choices = windowChoices(['enso', 'rocks'], { first: 1900, last: 1950 }, WHOLE, (id) =>
      id === 'enso' ? 'El Niño and La Niña' : id,
    );
    expect(choices).toEqual([
      { value: 'all', label: 'The Holocene, 9700 BCE–2026' },
      { value: '1850,2026', label: 'Since 1850' },
      { value: '1926,2026', label: 'The last 100 years' },
      { value: '1854,2026', label: 'El Niño and La Niña, 1854–2026' },
      { value: '1900,1950', label: 'These years, 1900–1950' },
    ]);
    const again = windowChoices([], { first: 1850, last: 2026 }, WHOLE, String);
    expect(again.map(({ value }) => value)).toEqual(['all', '1850,2026', '1926,2026']);
  });

  it('Given a window, Then zoomed about a year and panned, held to the track', () => {
    const window = { first: 1900, last: 2000 };
    expect(zoomed(window, 1950, 0.5, WHOLE)).toEqual({ first: 1925, last: 1975 });
    expect(zoomed(window, 1950, 1000, WHOLE)).toBeNull();
    expect(panned(window, 10, WHOLE)).toEqual({ first: 1910, last: 2010 });
    expect(panned(window, 100, WHOLE)).toEqual({ first: 1926, last: 2026 });
    expect(panned({ first: -9699, last: -9000 }, -500, WHOLE)).toEqual({
      first: -9699,
      last: -9000,
    });
  });
});
