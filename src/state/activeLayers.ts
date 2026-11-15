/**
 * The layers on, as the chips beside Layers show them (#728): each by name, and whether it has
 * data at the moment shown (#751): available, drawn on another span, outside the times its data
 * covers, or a year it has none for; with what it reaches and where its data is. Available does
 * not claim data at every place. Turning a layer on or off never moves time or the camera;
 * going to where its data is, is a choice of its own.
 */

import { formatMa } from '../time/format';
import { astronomicalYear, formatYear } from '../time/year';
import { LAYER_GROUPS, type Coverage as Covers, type LayerChoice } from './layerCatalog';
import { LAYERS, SPAN_LABELS, type Layer, type Span, type ViewState } from './viewState';

/** Whether a layer on has data at the moment shown (#751). */
type Coverage = 'available' | 'other-span' | 'outside' | 'gap';

/** Where to go for a layer's data: a span (at a moment of its own there), or a year. */
export interface GoTo {
  readonly span: Span;
  readonly ma?: number;
  readonly year?: number;
  readonly label: string;
}

export interface ActiveLayer {
  readonly layer: Layer;
  readonly label: string;
  /** Whether it has data at the moment shown, and if not why. */
  readonly coverage: Coverage;
  /** Whether it draws here: its coverage is available. */
  readonly draws: boolean;
  /** Where it has none here, why, in a few words a phone shows: "none in 1995". */
  readonly why: string | null;
  /** How far its data reaches. */
  readonly reach: string;
  /** Where its data is, where it has none here. */
  readonly goTo: GoTo | null;
}

const CHOICES: ReadonlyMap<Layer, LayerChoice> = new Map(
  LAYER_GROUPS.flatMap((group) => group.layers.map((choice) => [choice.id, choice] as const)),
);

/** The span a view shows. */
export function spanShown(state: Pick<ViewState, 'ma' | 'deepScale'>): Span {
  return state.ma === null ? 'years' : state.deepScale;
}

type Moment = Pick<ViewState, 'layers' | 'ma' | 'deepScale' | 'time'>;

const yearWords = (year: number): string => formatYear(astronomicalYear(year));

type Within = Pick<ActiveLayer, 'coverage' | 'why' | 'goTo'>;

const AVAILABLE: Within = { coverage: 'available', why: null, goTo: null };

/** In the years: outside the years its data covers, or a year it has none for. */
function withinYears(covers: Covers, year: number): Within {
  if (covers.years === undefined) return AVAILABLE;
  const [from, to] = covers.years;
  if (year < from || year > to) {
    const nearest = year < from ? from : to;
    const why = year < from ? `none before ${yearWords(from)}` : `none after ${yearWords(to)}`;
    return {
      coverage: 'outside',
      why,
      goTo: { span: 'years', year: nearest, label: yearWords(nearest) },
    };
  }
  if (covers.gaps?.includes(year) !== true) return AVAILABLE;
  // A gap lies inside the record (the catalogue ends a record at its last year measured).
  const next = year + 1;
  return {
    coverage: 'gap',
    why: `none in ${yearWords(year)}`,
    goTo: { span: 'years', year: next, label: yearWords(next) },
  };
}

/** In deep time: older than its data reaches (every deep record reaches the present). */
function withinMa(covers: Covers, ma: number, span: Span): Within {
  const oldest = covers.oldestMa;
  if (oldest === undefined || ma <= oldest) return AVAILABLE;
  return {
    coverage: 'outside',
    why: `none before ${formatMa(oldest)}`,
    goTo: { span, ma: oldest, label: formatMa(oldest) },
  };
}

/** The layers on, in the catalogue's order, each with whether it has data here. */
export function activeLayers(state: Moment): ActiveLayer[] {
  const span = spanShown(state);
  return LAYERS.filter((layer) => state.layers.has(layer)).flatMap((layer) => {
    const choice = CHOICES.get(layer);
    if (choice === undefined) return [];
    const base = { layer, label: choice.label, reach: choice.reach };
    const to = choice.spans[0];
    if (!choice.spans.includes(span) && to !== undefined) {
      const goTo: GoTo = {
        span: to,
        ...(choice.arrive === undefined ? {} : { ma: choice.arrive.ma }),
        label: choice.arrive?.label ?? SPAN_LABELS[to],
      };
      const only = choice.spans.map((each) => SPAN_LABELS[each]).join(', ');
      return [{ ...base, coverage: 'other-span', draws: false, why: `on ${only}`, goTo }];
    }
    const covers = choice.covers;
    // On a span it draws on: the years when no deep time is shown, else deep time.
    const within =
      covers === undefined
        ? AVAILABLE
        : state.ma === null
          ? withinYears(covers, state.time.date.year)
          : withinMa(covers, state.ma, span);
    return [{ ...base, ...within, draws: within.coverage === 'available' }];
  });
}
