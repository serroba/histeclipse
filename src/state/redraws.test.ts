import { describe, expect, it } from 'vitest';

import {
  DEEP_TIME,
  drawAll,
  EARTH_LAYERS,
  FOCUS,
  FOUND_THE_WAY_IN,
  HISTORY,
  LAYERS_PANEL,
  LOCATION,
  momentChanged,
  on,
  onChange,
  ORBITS,
  redraws,
  SELECTION,
  SKY,
  SKY_SHOWN,
  SUN,
  VIEW_SWITCH,
  VIEWPOINT,
  type Drawn,
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
      'temperatureShow',
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
  'the view switch': { watch: VIEW_SWITCH, fields: ['view', 'mode', 'focus'] },
  'the Layers panel': {
    watch: LAYERS_PANEL,
    fields: ['layers', 'mode', 'borders', 'ma', 'deepScale', 'location', 'focus'],
  },
  'the body in focus': { watch: FOCUS, fields: ['focus'] },
  'the viewpoint': { watch: VIEWPOINT, fields: ['view'] },
  'the place': { watch: LOCATION, fields: ['location'] },
  'the welcome': {
    watch: FOUND_THE_WAY_IN,
    fields: ['selection', 'location', 'mode', 'view', 'ma'],
  },
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

describe('the sky as shown', () => {
  const sky: ViewState = { ...base, mode: 'sky' };
  it('Given the globe before and after, Then the sky rests, whatever moved', () => {
    expect(redraws(SKY_SHOWN, { ...base, camera: { ...base.camera } }, base)).toBe(false);
  });
  it('Given the sky entered or left, Then it draws', () => {
    expect(redraws(SKY_SHOWN, sky, base)).toBe(true);
    expect(redraws(SKY_SHOWN, base, sky)).toBe(true);
  });
  it('Given the sky before and after, Then it draws on what the sky reads', () => {
    expect(redraws(SKY_SHOWN, { ...sky, look: { ...sky.look } }, sky)).toBe(true);
    expect(redraws(SKY_SHOWN, { ...sky, why: 'ways' }, sky)).toBe(false);
  });
});

describe('the moment shown', () => {
  it('Given its time, its calendar, or deep time left, Then it is worked out again', () => {
    expect(momentChanged(base, null)).toBe(true);
    expect(momentChanged(moved('time'), base)).toBe(true);
    expect(momentChanged(moved('years'), base)).toBe(true);
    expect(momentChanged(base, { ...base, ma: 66 })).toBe(true);
  });
  it('Given deep time entered, or anything else, Then it is not', () => {
    expect(momentChanged({ ...base, ma: 66 }, base)).toBe(false);
    expect(momentChanged(moved('layers'), base)).toBe(false);
  });
});

describe('drawing in order', () => {
  it('Given a list, Then each draws in turn when its when says so', () => {
    const order: string[] = [];
    const drawn: Drawn[] = [
      { draw: () => order.push('always') },
      { when: on(FOCUS), draw: () => order.push('focus') },
      { when: onChange(FOCUS), draw: () => order.push('focus changed') },
    ];
    drawAll(drawn, base, null);
    expect(order).toEqual(['always', 'focus']);
    order.length = 0;
    drawAll(drawn, base, base);
    expect(order).toEqual(['always']);
    order.length = 0;
    drawAll(drawn, { ...base, focus: 'moon' }, base);
    expect(order).toEqual(['always', 'focus', 'focus changed']);
  });
});
