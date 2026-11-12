/**
 * The Holocene chapter borrows the globe (#475): as its chart draws, the globe goes to the year
 * the line has reached, on the ice-age scale, with the ice sheets, the sea level and the
 * temperature as the change from today. On leaving the chapter the reader's view comes back:
 * the story only borrows what it changes.
 */

import { maOfYear } from '../../data/iceSheets';
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
 * temperature colours are off, rather than showing a warming they do not have.
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
  return {
    ...state,
    mode: 'globe',
    view: 'free',
    focus: 'earth',
    selection: null,
    ma: roundMa(maOfYear(year)),
    deepScale: 'ice',
    layers,
    temperatureModel: 'krapp',
    temperatureShow: 'change',
  };
}
