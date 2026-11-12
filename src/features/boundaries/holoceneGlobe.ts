/**
 * The Holocene chapter borrows the globe (#475): as its chart draws, the globe goes to the year
 * the line has reached, on the ice-age scale, with the ice sheets, the sea level and the
 * temperature as the change from today. On leaving the chapter the reader's view comes back:
 * the story only borrows what it changes.
 */

import { chartDateText } from '../../data/holoceneTemperature';
import { maOfYear } from '../../data/iceSheets';
import type { StoryDate } from '../../deepTime/storyDate';
import { warmingAt, type MeasuredWarming } from '../../data/measuredWarming';
import type { TemperatureSurface } from '../../globe/scene';
import type { GeoPoint } from '../../core/geo';
import { roundMa, withLayer, type ViewState } from '../../state/viewState';

/** What the story changes, and gives back. */
export type Borrowed = Pick<
  ViewState,
  | 'mode'
  | 'view'
  | 'focus'
  | 'selection'
  | 'ma'
  | 'deepScale'
  | 'layers'
  | 'temperatureModel'
  | 'temperatureShow'
>;

export function borrowedOf(state: ViewState): Borrowed {
  const { mode, view, focus, selection, ma, deepScale, layers } = state;
  const { temperatureModel, temperatureShow } = state;
  return { mode, view, focus, selection, ma, deepScale, layers, temperatureModel, temperatureShow };
}

/** The reader's view, given back. */
export function givenBack(state: ViewState, borrowed: Borrowed): ViewState {
  return { ...state, ...borrowed };
}

/**
 * Krapp et al.'s maps end before industry (their present is pre-industrial): from here on the
 * globe shows the measured warming instead (#485), Berkeley Earth's against 1850–1900.
 */
export const MAPS_END_YEAR = 1850;

/**
 * Between the two great northern ice sheets, the Laurentide and the Fennoscandian, a little to
 * the south so both are clear of the header; far enough out that the globe fits beside the
 * sheet, above deep time's bar.
 */
export const FACING: GeoPoint = { latitude: 40, longitude: -35 };
export const FACING_DISTANCE = 6;

/** The globe at `year` (astronomical), as the chart shows it: the reader's layers, and these. */
export function globeAt(state: ViewState, borrowed: Borrowed, year: number): ViewState {
  const layers = withLayer(
    withLayer(borrowed.layers, 'sealevel', true),
    'temperature',
    year < MAPS_END_YEAR,
  );
  const ma = roundMa(maOfYear(year));
  return {
    ...state,
    mode: 'globe',
    view: 'free',
    focus: 'earth',
    selection: null,
    ma,
    deepScale: 'ice',
    layers,
    temperatureModel: 'krapp',
    temperatureShow: 'change',
  };
}

/**
 * From 1850, the measured warming at `year` as the globe's Temperature surface: the maps either
 * side, blended, shown as the change from 1850–1900. Before, none: Krapp et al.'s maps show.
 */
export function measuredAt(
  warming: MeasuredWarming,
  year: number,
  url: (file: string) => string,
): TemperatureSurface | null {
  if (year < MAPS_END_YEAR) return null;
  const { younger, older, mix } = warmingAt(warming, year);
  return {
    younger: url(younger.file),
    older: url(older.file),
    mix,
    columns: warming.columns,
    rows: warming.rows,
    coldest: warming.coldest,
    warmest: warming.warmest,
    change: true,
  };
}

/**
 * The date the story lends deep time's header and bar at `year` (#492): the chart cursor's own
 * words, and from 1850 what the globe shows then; before, the period's name stays.
 */
export function storyDateAt(year: number): StoryDate {
  return {
    when: chartDateText(year),
    what: year < MAPS_END_YEAR ? null : 'Industrial era · measured warming, 5-year mean',
  };
}
