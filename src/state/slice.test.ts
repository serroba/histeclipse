import { describe, expect, it } from 'vitest';

import { choice, oneOf, readSlice, writeSlice, type Params, type Reader } from './slice';
import { DEEP_DEFAULTS, DEEP_PARAMS, type DeepState } from './slices/deep';
import { DISPLAY_PARAMS } from './slices/display';
import { HISTORY_PARAMS } from './slices/history';
import { SHEETS_DEFAULTS, SHEETS_PARAMS } from './slices/sheets';

interface Toy {
  readonly colour: 'red' | 'blue';
  readonly size: number | null;
}
const TOY_PARAMS: Params<Toy> = {
  colour: choice('colour', ['red', 'blue'], 'red'),
  size: {
    key: 'size',
    parse: Number,
    format: (size) => (size === null ? null : String(size)),
  },
};
const TOY_DEFAULTS: Toy = { colour: 'red', size: null };

/** A reader over a query string, as `url.ts` has one: the fallback when absent or unreadable. */
function readerOf(query: string, warnings: string[] = []): Reader {
  const params = new URLSearchParams(query);
  return (key, parse, fallback) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    try {
      return parse(raw);
    } catch (error) {
      warnings.push(`${key}: ${(error as Error).message}`);
      return fallback;
    }
  };
}

function written<S extends object>(params: Params<S>, state: S): string {
  const out = new URLSearchParams();
  writeSlice(params, state, (key, value) => {
    out.set(key, value);
  });
  return out.toString();
}

describe('a slice of the view state', () => {
  it('reads each field, and falls back to its default when absent', () => {
    expect(readSlice(TOY_PARAMS, TOY_DEFAULTS, readerOf('colour=blue'))).toEqual({
      colour: 'blue',
      size: null,
    });
    expect(readSlice(TOY_PARAMS, TOY_DEFAULTS, readerOf(''))).toEqual(TOY_DEFAULTS);
  });

  it('falls back, with a warning, when a value cannot be read', () => {
    const warnings: string[] = [];
    const toy = readSlice(TOY_PARAMS, TOY_DEFAULTS, readerOf('colour=green', warnings));
    expect(toy.colour).toBe('red');
    expect(warnings).toEqual(['colour: unknown colour; expected one of red, blue']);
  });

  it('writes its fields in order, leaving out what reads back as the default', () => {
    expect(written(TOY_PARAMS, TOY_DEFAULTS)).toBe('');
    expect(written(TOY_PARAMS, { colour: 'blue', size: 3 })).toBe('colour=blue&size=3');
  });

  it('says which values it expected', () => {
    expect(oneOf('b', ['a', 'b'], 'letter')).toBe('b');
    expect(() => oneOf('c', ['a', 'b'], 'letter')).toThrow('unknown letter; expected one of a, b');
  });
});

describe("deep time's slice", () => {
  const away: DeepState = {
    ma: 66.04,
    deepScale: 'eons',
    coast: DEEP_DEFAULTS.coast,
    dispersal: 'b',
    seaIce: DEEP_DEFAULTS.seaIce,
    temperatureModel: DEEP_DEFAULTS.temperatureModel,
    temperatureShow: DEEP_DEFAULTS.temperatureShow,
    impact: DEEP_DEFAULTS.impact,
    land: DEEP_DEFAULTS.land,
    snowball: DEEP_DEFAULTS.snowball,
  };

  it('reads back what it writes', () => {
    const query = written(DEEP_PARAMS, away);
    expect(query).toBe('ma=66.04&scale=eons&dispersal=b');
    expect(readSlice(DEEP_PARAMS, DEEP_DEFAULTS, readerOf(query))).toEqual(away);
  });

  it('writes nothing for the years, with every default', () => {
    expect(written(DEEP_PARAMS, DEEP_DEFAULTS)).toBe('');
  });

  it('keeps ma within Earth’s age, to a thousandth', () => {
    const warnings: string[] = [];
    expect(readSlice(DEEP_PARAMS, DEEP_DEFAULTS, readerOf('ma=0.0214')).ma).toBe(0.021);
    expect(readSlice(DEEP_PARAMS, DEEP_DEFAULTS, readerOf('ma=9999', warnings)).ma).toBeNull();
    expect(readSlice(DEEP_PARAMS, DEEP_DEFAULTS, readerOf('ma=x', warnings)).ma).toBeNull();
    expect(warnings).toHaveLength(2);
  });
});

describe('the slices together', () => {
  // The parameters url.ts writes itself, around the slices.
  const CORE = ['v', 'mode', 't', 'cal', 'loc', 'cam', 'view', 'focus', 'layers', 'sel', 'look'];

  it('give every parameter its own key, apart from the core ones', () => {
    const keys = [DISPLAY_PARAMS, HISTORY_PARAMS, DEEP_PARAMS, SHEETS_PARAMS].flatMap((params) =>
      Object.values<{ key: string }>(params).map((param) => param.key),
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => CORE.includes(key))).toEqual([]);
  });

  it("write a sheet's view so that it reads back", () => {
    const open = {
      ...SHEETS_DEFAULTS,
      why: 'all' as const,
      tree: { ott: 770315 },
      craters: { id: 12 },
      cratersIn: 'box' as const,
      lineages: { group: 'dinosaurs' as const, pick: 38613 },
      boundaries: 'safe' as const,
    };
    const query = written(SHEETS_PARAMS, open);
    expect(query).toBe(
      'why=all&tree=ott770315&craters=12&cratersin=box&lineages=dinosaurs%3A38613&boundaries=safe',
    );
    expect(readSlice(SHEETS_PARAMS, SHEETS_DEFAULTS, readerOf(query))).toEqual(open);
    expect(written(SHEETS_PARAMS, SHEETS_DEFAULTS)).toBe('');
  });
});
