import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { calendarDateOf, daysInMonth, type Calendar } from '../time/julianDay';
import { SKY_CULTURES } from '../data/skyCultures';
import { SUN_LAYERS } from '../data/sunImages';
import { YEAR_CALENDARS } from '../time/calendars';
import { astronomicalYear } from '../time/year';
import { parseViewState, serializeViewState } from './url';
import {
  DEFAULT_CAMERA,
  DEFAULT_LAYERS,
  DEFAULT_LOOK,
  BORDER_SOURCES,
  FIGURES,
  BODIES,
  LAYERS,
  VIEWPOINTS,
  defaultCalendarFor,
  defaultViewState,
  momentFromDate,
  momentJulianDay,
  type Layer,
  type ViewState,
} from './viewState';

const NOW = new Date(Date.UTC(2026, 9, 31, 18, 45, 30));

const BABYLON_ECLIPSE =
  'v=1&mode=globe&t=-0620-04-22T07:20Z&cal=julian&loc=32.5422,44.4209' +
  '&cam=30.0000,40.0000,3.00&view=moon-from-earth&layers=lunar,terminator&sel=lunar:-0620-04-22';

const date = (year: number, month: number, day: number, calendar: Calendar) =>
  calendarDateOf(astronomicalYear(year), month, day, calendar);

describe('parseViewState', () => {
  it('uses defaults for an empty query', () => {
    const { state, warnings } = parseViewState('', NOW);
    expect(state).toEqual(defaultViewState(NOW));
    expect(state.time).toEqual({
      date: date(2026, 10, 31, 'gregorian'),
      minuteOfDay: 18 * 60 + 45,
    });
    expect(warnings).toEqual([]);
  });

  it('reads a full link', () => {
    const { state, warnings } = parseViewState(`?${BABYLON_ECLIPSE}`, NOW);
    expect(warnings).toEqual([]);
    expect(state).toEqual({
      mode: 'globe',
      time: { date: date(-620, 4, 22, 'julian'), minuteOfDay: 7 * 60 + 20 },
      location: { latitude: 32.5422, longitude: 44.4209 },
      camera: { target: { latitude: 30, longitude: 40 }, distance: 3 },
      view: 'moon-from-earth',
      focus: 'earth',
      layers: new Set(['lunar', 'terminator']),
      selection: { kind: 'lunar', date: date(-620, 4, 22, 'julian') },
      look: DEFAULT_LOOK,
      figures: 'famous',
      years: 'western',
      sunLayer: 'visible',
      culture: 'modern',
      borders: 'cliopatria',
      seenIn: null,
      ma: null,
    } satisfies ViewState);
  });

  it('writes links back in canonical form', () => {
    const { state } = parseViewState(BABYLON_ECLIPSE, NOW);
    expect(serializeViewState(state)).toBe(BABYLON_ECLIPSE);
  });

  it.each([
    ['-0620-04-22', 'julian'],
    ['1582-10-04', 'julian'],
    ['1582-10-15', 'gregorian'],
    ['2025-03-14', 'gregorian'],
  ])('reads t=%s in the %s calendar when cal is missing', (day, calendar) => {
    expect(parseViewState(`t=${day}`, NOW).state.time.date.calendar).toBe(calendar);
  });

  it('honours an explicit calendar', () => {
    const { state } = parseViewState('t=1000-01-01T12:00Z&cal=gregorian', NOW);
    expect(state.time.date).toEqual(date(1000, 1, 1, 'gregorian'));
  });

  it('accepts a date without a time as midnight, and short years', () => {
    const { state } = parseViewState('t=-620-04-22', NOW);
    expect(state.time).toEqual({ date: date(-620, 4, 22, 'julian'), minuteOfDay: 0 });
  });

  it('wraps longitudes into -180..180', () => {
    expect(parseViewState('loc=10,190', NOW).state.location).toEqual({
      latitude: 10,
      longitude: -170,
    });
    expect(parseViewState('loc=10,-180', NOW).state.location?.longitude).toBe(180);
  });

  it('leaves the free view out of links, so older links read the same', () => {
    const { state } = parseViewState('', NOW);
    expect(state.view).toBe('free');
    expect(serializeViewState(state)).not.toContain('view=');
  });

  it('reads a camera centred on the Moon, and leaves Earth focus out of links', () => {
    const { state } = parseViewState('focus=moon&cam=10,-20,4', NOW);
    expect(state.focus).toBe('moon');
    expect(serializeViewState(state)).toContain('&focus=moon');
    expect(serializeViewState(parseViewState('', NOW).state)).not.toContain('focus=');
  });

  it('reads deep time in millions of years, to a thousand years, writing it only when set', () => {
    expect(serializeViewState(parseViewState('ma=0.0214', NOW).state)).toContain('&ma=0.021');
    const { state } = parseViewState('ma=252.4567', NOW);
    expect(state.ma).toBe(252.457);
    expect(serializeViewState(state)).toContain('&ma=252.457');
    expect(serializeViewState(parseViewState('ma=0', NOW).state)).toContain('&ma=0');
    expect(serializeViewState(parseViewState('', NOW).state)).not.toContain('ma=');
  });

  it('reads which state’s eclipses to pick out, writing it only when there is one', () => {
    const { state } = parseViewState('seen=Neo-Babylonian+Empire', NOW);
    expect(state.seenIn).toBe('Neo-Babylonian Empire');
    expect(serializeViewState(state)).toContain('&seen=Neo-Babylonian+Empire');
    expect(serializeViewState(parseViewState('', NOW).state)).not.toContain('seen=');
  });

  it('reads whose borders the empires layer draws, writing it only when not Cliopatria', () => {
    const { state } = parseViewState('borders=both', NOW);
    expect(state.borders).toBe('both');
    expect(serializeViewState(state)).toContain('&borders=both');
    expect(serializeViewState(parseViewState('', NOW).state)).not.toContain('borders=');
  });

  it('reads whose constellations the sky draws, writing it only when not modern', () => {
    const { state } = parseViewState('culture=babylonian_mulapin', NOW);
    expect(state.culture).toBe('babylonian_mulapin');
    expect(serializeViewState(state)).toContain('&culture=babylonian_mulapin');
    expect(serializeViewState(parseViewState('', NOW).state)).not.toContain('culture=');
  });

  it('reads the channel the Sun is shown in, writing it only when not visible light', () => {
    const { state } = parseViewState('sun=171', NOW);
    expect(state.sunLayer).toBe('171');
    expect(serializeViewState(state)).toContain('&sun=171');
    expect(serializeViewState(parseViewState('', NOW).state)).not.toContain('sun=');
  });

  it('reads the calendar the years are counted in, writing it only when not western', () => {
    const { state } = parseViewState('years=hebrew', NOW);
    expect(state.years).toBe('hebrew');
    expect(serializeViewState(state)).toContain('&years=hebrew');
    expect(serializeViewState(parseViewState('', NOW).state)).not.toContain('years=');
  });

  it('reads where the sky view looks, and writes it whenever the sky is shown', () => {
    const { state } = parseViewState('mode=sky&look=370,-12.5,45&figures=all', NOW);
    expect(state.look).toEqual({ azimuth: 10, altitude: -12.5, fov: 45 });
    expect(state.figures).toBe('all');
    const link = serializeViewState(state);
    expect(link).toContain('&look=10.0,-12.5,45.0');
    expect(link).toContain('&figures=all');
    // The globe with the default look and figures leaves both out.
    const globe = serializeViewState(parseViewState('', NOW).state);
    expect(globe).not.toContain('look=');
    expect(globe).not.toContain('figures=');
    expect(serializeViewState({ ...parseViewState('', NOW).state, mode: 'sky' })).toContain(
      '&look=180.0,30.0,90.0',
    );
  });

  it('reads an empty layer list as no layers', () => {
    expect(parseViewState('layers=', NOW).state.layers).toEqual(new Set());
  });

  it.each([
    ['mode=map', 'mode', 'unknown mode'],
    ['t=yesterday', 't', 'expected a time'],
    ['t=2025-02-30', 't', 'Day must be in'],
    ['t=2025-01-01T24:00Z', 't', 'time of day'],
    ['t=-5000-01-01', 't', 'year must be between'],
    ['t=2025-01-01&cal=hebrew', 'cal', 'unknown calendar'],
    ['loc=95,0', 'loc', 'latitude must be between'],
    ['loc=1,2,3', 'loc', 'expected 2'],
    ['loc=1,', 'loc', 'is not a number'],
    ['cam=0,0,0.5', 'cam', 'distance must be between'],
    ['cam=0,0,400000', 'cam', 'distance must be between'],
    ['layers=lunar,clouds', 'layers', 'unknown layer'],
    ['view=sideways', 'view', 'unknown view'],
    ['focus=pluto', 'focus', 'unknown focus'],
    ['look=0,95,60', 'look', 'altitude must be between'],
    ['look=0,10,200', 'look', 'field of view must be between'],
    ['look=0,10', 'look', 'expected 3'],
    ['figures=some', 'figures', 'unknown figures'],
    ['years=mayan', 'years', 'unknown years'],
    ['sun=xray', 'sun', 'unknown sun'],
    ['culture=martian', 'culture', 'unknown culture'],
    ['borders=guesswork', 'borders', 'unknown borders'],
    ['seen=%20', 'seen', 'name of a past state'],
    ['ma=600', 'ma', 'between 0 and 540'],
    ['ma=old', 'ma', 'not a number'],
    ['sel=lunar', 'sel', 'expected kind:date'],
    ['sel=lunar:yesterday', 'sel', 'expected a date'],
    ['sel=annular:2025-01-01', 'sel', 'unknown eclipse kind'],
    ['sel=solar:2025-13-01', 'sel', 'Month must be in'],
  ])('falls back on bad input %s', (query, name, reason) => {
    const { state, warnings } = parseViewState(query, NOW);
    const defaults = defaultViewState(NOW);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`Ignored ${name}=`);
    expect(warnings[0]).toContain(reason);
    expect(state.mode).toBe(defaults.mode);
    expect(state.camera).toEqual(DEFAULT_CAMERA);
  });

  it('keeps the rest of a link when one parameter is bad', () => {
    const { state, warnings } = parseViewState(BABYLON_ECLIPSE.replace('globe', 'map'), NOW);
    expect(warnings).toHaveLength(1);
    expect(state.time.date).toEqual(date(-620, 4, 22, 'julian'));
  });

  it('uses the last value when a parameter repeats, and says so', () => {
    const { state, warnings } = parseViewState(`${BABYLON_ECLIPSE}&mode=sky`, NOW);
    expect(state.mode).toBe('sky');
    expect(warnings).toEqual(['mode appears 2 times; using the last one']);
  });

  it('warns about links from a newer format version', () => {
    const { warnings } = parseViewState('v=2&mode=sky', NOW);
    expect(warnings[0]).toMatch(/format v=2/);
  });

  it('warns when cal is given without t', () => {
    expect(parseViewState('cal=julian', NOW).warnings).toEqual([
      'Ignored cal: it only applies together with t',
    ]);
  });

  it('ignores parameters it does not know, such as tracking tags', () => {
    expect(parseViewState('utm_source=chat&mode=sky', NOW)).toEqual({
      state: { ...defaultViewState(NOW), mode: 'sky' },
      warnings: [],
    });
  });

  it('never throws, whatever the query', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom(
            'v',
            'mode',
            't',
            'cal',
            'loc',
            'cam',
            'layers',
            'sel',
            'look',
            'figures',
            'years',
            'sun',
            'culture',
            'borders',
            'seen',
            'ma',
            'x',
          ),
          fc.string(),
        ),
        (entries) => {
          expect(() => parseViewState(new URLSearchParams(entries), NOW)).not.toThrow();
        },
      ),
    );
  });
});

describe('serializeViewState', () => {
  it('writes selection dates in the calendar in use at the time', () => {
    const state: ViewState = {
      ...defaultViewState(NOW),
      selection: { kind: 'lunar', date: date(-620, 4, 15, 'gregorian') },
    };
    expect(serializeViewState(state)).toContain('sel=lunar:-0620-04-22');
  });

  it('writes no minus sign on coordinates that round to zero', () => {
    const state: ViewState = {
      ...defaultViewState(NOW),
      location: { latitude: -0.00001, longitude: -0.00004 },
    };
    expect(serializeViewState(state)).toContain('loc=0.0000,0.0000');
  });

  const rounded = (min: number, max: number, digits: number) =>
    fc
      .integer({ min: Math.round(min * 10 ** digits), max: Math.round(max * 10 ** digits) })
      .map((n) => n / 10 ** digits);

  const calendarDay = fc
    .record({
      year: fc.integer({ min: -4700, max: 9999 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 31 }),
    })
    .map(({ year, month, day }) => {
      const calendar = defaultCalendarFor(year, month, day);
      const last = daysInMonth(astronomicalYear(year), month, calendar);
      return date(year, month, Math.min(day, last), calendar);
    });

  const viewStates: fc.Arbitrary<ViewState> = fc.record({
    mode: fc.constantFrom('globe' as const, 'sky' as const),
    time: fc.record({ date: calendarDay, minuteOfDay: fc.integer({ min: 0, max: 1439 }) }),
    location: fc.option(
      fc.record({ latitude: rounded(-90, 90, 4), longitude: rounded(-179.9999, 180, 4) }),
      { nil: null },
    ),
    camera: fc.record({
      target: fc.record({ latitude: rounded(-90, 90, 4), longitude: rounded(-179.9999, 180, 4) }),
      distance: rounded(1.1, 300_000, 2),
    }),
    view: fc.constantFrom(...VIEWPOINTS),
    focus: fc.constantFrom(...BODIES),
    layers: fc.subarray([...LAYERS]).map((layers) => new Set<Layer>(layers)),
    selection: fc.option(
      fc.record({ kind: fc.constantFrom('lunar' as const, 'solar' as const), date: calendarDay }),
      { nil: null },
    ),
    look: fc.record({
      azimuth: rounded(0, 359.9, 1),
      altitude: rounded(-90, 90, 1),
      fov: rounded(5, 120, 1),
    }),
    figures: fc.constantFrom(...FIGURES),
    years: fc.constantFrom(...YEAR_CALENDARS),
    sunLayer: fc.constantFrom(...SUN_LAYERS),
    culture: fc.constantFrom(...SKY_CULTURES),
    borders: fc.constantFrom(...BORDER_SOURCES),
    seenIn: fc.option(
      fc.string({ minLength: 1, maxLength: 120 }).filter((name) => name.trim() === name),
      { nil: null },
    ),
    ma: fc.option(
      fc.integer({ min: 0, max: 5400 }).map((tenths) => tenths / 10),
      { nil: null },
    ),
  });

  it('round-trips every view state through a link', () => {
    fc.assert(
      fc.property(viewStates, (state) => {
        const { state: parsed, warnings } = parseViewState(serializeViewState(state), NOW);
        expect(warnings).toEqual([]);
        expect(parsed).toEqual(state);
      }),
    );
  });
});

describe('view state helpers', () => {
  it('converts moments to Julian Days in UT', () => {
    const moment = momentFromDate(new Date(Date.UTC(2000, 0, 1, 12, 0)));
    expect(momentJulianDay(moment)).toBe(2_451_545);
  });

  it('defaults to both eclipse layers and the day/night line', () => {
    expect([...DEFAULT_LAYERS]).toEqual(['lunar', 'solar', 'terminator']);
  });
});
