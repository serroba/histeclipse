/**
 * The telescopes' list (#850): the most significant, in the record's order (its ranking, space
 * first), filtered to space or the ground and to a band of light; each row in a line; and where a
 * tap on one goes: the Telescopes layer on, a moment it worked, the camera at its site or orbit.
 *
 * Pure: no DOM.
 */

import { BANDS, stateIn, yearOf, type Telescope, type Telescopes } from '../../data/telescopes';
import { withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import { SPACE_SCENES } from '../../models/spaceScenes';
import { BAND_WORDS } from './telescopeMarks';

export type Kind = 'all' | Telescope['kind'];
export type Band = (typeof BANDS)[number];

export interface ListFilter {
  readonly kind: Kind;
  readonly band: Band | null;
}

/** The telescopes the filter keeps, in the record's order. */
export function listed(record: Telescopes, filter: ListFilter): Telescope[] {
  return record.telescopes.filter(
    (telescope) =>
      (filter.kind === 'all' || telescope.kind === filter.kind) &&
      (filter.band === null || telescope.bands.includes(filter.band)),
  );
}

/** The bands any telescope in the record sees, in the spectrum's order. */
export function bandsIn(record: Telescopes): Band[] {
  return BANDS.filter((band) => record.telescopes.some((t) => t.bands.includes(band)));
}

/** Its years in a few words: "1963–2020", "1990–", "being built". */
function yearsText(telescope: Telescope): string {
  const from = String(yearOf(telescope.from));
  const { until } = telescope;
  if (typeof until === 'object') return 'being built';
  if (until === 'operating') return `${from}–`;
  return `${from}–${String(yearOf(until))}`;
}

/** A row: its name, and its size, what it sees and its years in a line under it. */
export function rowText(telescope: Telescope): { readonly title: string; readonly meta: string } {
  const size = telescope.size.metres === null ? null : sizeText(telescope.size.metres);
  const sees = telescope.bands.map((band) => BAND_WORDS[band]).join(', ');
  const where = telescope.kind === 'space' ? 'in space' : telescope.site.name.split(',')[0];
  return {
    title: telescope.name,
    meta: [size, sees, yearsText(telescope), where].filter((part) => part !== null).join(' · '),
  };
}

function sizeText(metres: number): string {
  return metres >= 1000 ? `${String(Math.round(metres / 1000))} km across` : `${String(metres)} m`;
}

/** A year it worked, for going to it: the one shown if it worked then, else its first. */
export function yearToShow(telescope: Telescope, shown: number): number {
  if (stateIn(telescope, shown) !== null) return shown;
  return yearOf(telescope.from);
}

/** Where the camera goes for a space telescope: Earth close up, further out, or the Sun. */
const SPACE_VIEWS: Readonly<
  Record<Extract<Telescope, { kind: 'space' }>['orbit'], Pick<ViewState, 'focus' | 'camera'>>
> = {
  'low Earth': { focus: 'earth', camera: { target: { latitude: 20, longitude: 0 }, distance: 8 } },
  'high Earth': {
    focus: 'earth',
    camera: { target: { latitude: 20, longitude: 0 }, distance: 45 },
  },
  L2: { focus: 'earth', camera: { target: { latitude: 20, longitude: 0 }, distance: 600 } },
  'around the Sun': {
    focus: 'sun',
    camera: { target: { latitude: 60, longitude: -90 }, distance: 300 },
  },
};

/** The view going to a telescope: its layer on, a year it worked, the camera on it, the list shut. */
export function goTo(state: ViewState, telescope: Telescope): ViewState {
  const year = yearToShow(telescope, state.time.date.year);
  const view =
    telescope.kind === 'ground'
      ? {
          focus: 'earth' as const,
          camera: {
            target: { latitude: telescope.site.latitude, longitude: telescope.site.longitude },
            distance: 2.4,
          },
        }
      : SPACE_VIEWS[telescope.orbit];
  return {
    ...state,
    ...view,
    mode: 'globe',
    view: 'free',
    ma: null,
    on: null,
    list: null,
    layers: withLayer(state.layers, 'telescopes', true),
    time:
      year === state.time.date.year ? state.time : moveToYear(state.time, astronomicalYear(year)),
  };
}

/**
 * The camera going to a space telescope's model where it flies (#863), from a view already in a
 * year it worked (`goTo`): null for one on the ground, or one without a model.
 */
export function goToCraft(state: ViewState, telescope: Telescope): ViewState | null {
  if (telescope.kind === 'ground' || telescope.craft === null) return null;
  const scene = SPACE_SCENES.get(telescope.craft.toUpperCase());
  return scene === undefined
    ? null
    : { ...state, on: { kind: 'craft', id: telescope.craft }, focus: scene.about, view: 'free' };
}
