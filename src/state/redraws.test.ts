import { describe, expect, it } from 'vitest';

import {
  DEEP_TIME,
  EARTH_LAYERS,
  HISTORY,
  ORBITS,
  redraws,
  SELECTION,
  SKY,
  SUN,
  type Watch,
} from './redraws';
import { astronomicalYear } from '../time/year';
import { defaultViewState, type ViewState } from './viewState';

const base = defaultViewState(new Date(Date.UTC(2024, 3, 8)));

/** The state with one field changed to a fresh value of its own kind. */
function moved(field: keyof ViewState): ViewState {
  const value = base[field];
  const fresh =
    typeof value === 'number'
      ? value + 1
      : typeof value === 'string'
        ? `${value}-other`
        : value === null
          ? 1
          : value instanceof Set
            ? new Set(value)
            : Array.isArray(value)
              ? [...(value as unknown[])]
              : { ...(value as object) };
  return { ...base, [field]: fresh };
}

const WATCHES: Record<string, { watch: Watch; fields: readonly (keyof ViewState)[] }> = {
  'deep time': {
    watch: DEEP_TIME,
    fields: [
      'ma',
      'time',
      'years',
      'layers',
      'deepScale',
      'coast',
      'seaIce',
      'temperatureModel',
      'dispersal',
      'impact',
      'land',
      'snowball',
    ],
  },
  sky: {
    watch: SKY,
    fields: ['mode', 'time', 'location', 'look', 'figures', 'culture', 'focus', 'camera'],
  },
  orbits: { watch: ORBITS, fields: ['layers', 'camera', 'focus', 'mode', 'ma'] },
  'the Sun': { watch: SUN, fields: ['focus', 'mode', 'sunLayer'] },
  'Earth’s layers': {
    watch: EARTH_LAYERS,
    fields: ['layers', 'mode', 'borders', 'ma', 'deepScale', 'location'],
  },
  history: { watch: HISTORY, fields: ['layers', 'location'] },
  'the eclipse picked': { watch: SELECTION, fields: ['selection', 'layers', 'location', 'seenIn'] },
};

describe('what each part of the page redraws on', () => {
  for (const [part, { watch, fields }] of Object.entries(WATCHES)) {
    it(`Given ${part}, Then it redraws when a field it reads changes, and only then`, () => {
      for (const field of Object.keys(base) as (keyof ViewState)[]) {
        expect(redraws(watch, moved(field), base), `${part}: ${field}`).toBe(
          fields.includes(field),
        );
      }
    });
  }

  it('Given no state before, Then every part draws', () => {
    for (const { watch } of Object.values(WATCHES)) expect(redraws(watch, base, null)).toBe(true);
  });

  it('Given the same state, Then nothing redraws', () => {
    for (const { watch } of Object.values(WATCHES)) {
      expect(redraws(watch, { ...base }, base)).toBe(false);
    }
  });

  it('Given a new year, Then Earth’s layers and the history track redraw; a new hour does not', () => {
    const year = {
      ...base.time,
      date: { ...base.time.date, year: astronomicalYear(base.time.date.year + 1) },
    };
    const hour = { ...base.time, minuteOfDay: (base.time.minuteOfDay + 60) % 1440 };
    expect(redraws(EARTH_LAYERS, { ...base, time: year }, base)).toBe(true);
    expect(redraws(HISTORY, { ...base, time: year }, base)).toBe(true);
    expect(redraws(EARTH_LAYERS, { ...base, time: hour }, base)).toBe(false);
    expect(redraws(HISTORY, { ...base, time: hour }, base)).toBe(false);
  });
});
