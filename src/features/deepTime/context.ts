/** What deep time asks of the rest of the page, and what it gives it (#445). */

import type { Globe } from '../../globe/globe';
import type { PartContext } from '../part';
import type { DeepMoment } from '../feature';
import type { DeepChip } from '../../ui/deepChips';
import type { DeepScale, ViewState } from '../../state/viewState';
import type { DeepTimeView } from '../../ui/deepTimeBar';
import type { Span } from '../../ui/spanSwitch';
import type { StoryDate } from '../../deepTime/storyDate';
import type { ZoomTarget } from '../../state/timeZoom';

/** What deep time's own fields of the bar leave to the layers and surfaces. */
type Gathered = Omit<
  DeepTimeView,
  | 'ma'
  | 'story'
  | 'oldest'
  | 'youngest'
  | 'mapsReach'
  | 'period'
  | 'polarity'
  | 'playing'
  | 'speed'
  | 'zoom'
  | 'scale'
  | 'sketch'
> & {
  /** Whether the globe is coloured by temperature at the moment, for the glance. */
  readonly temperatureDrawn: boolean;
};

/** What deep time asks of the rest of the page. */
export interface DeepTimeContext extends PartContext {
  readonly globe: Pick<
    Globe,
    | 'addLayer'
    | 'setUncharted'
    | 'setSketch'
    | 'setDeepTime'
    | 'setTemperature'
    | 'prefetch'
    | 'flyTo'
    | 'zoomTo'
  >;
  /** The chips in the bar (#380, #605), in their order. */
  readonly chips: readonly DeepChip[];
  /** A jump in time: the link's history takes a step. */
  step(): void;
  /** The page is in deep time, or not. */
  marked(on: boolean): void;
  /** The header says the moment: how long ago, and the period; or the date a story lends. */
  header(ma: number, story: StoryDate | null): void;
  /** The date a story lends deep time while it has the globe (#492), if any. */
  storyDate(): StoryDate | null;
  /** The layers' and surfaces' part of the bar for the moment, drawing them. */
  bar(state: ViewState, moment: DeepMoment): Gathered;
  /** Out of deep time: what its layers and surfaces drew goes. */
  off(state: ViewState): void;
  /** How far back the plates reach, Ma, once known. */
  platesReach(): number | undefined;
  loadArchive(): void;
}

export interface DeepTimePart {
  readonly bar: HTMLElement;
  /** The layers whose buttons the bar's dock shows now (#1072); none outside deep time. */
  readonly docked: () => ReadonlySet<string>;
  readonly glance: HTMLElement;
  /** How far back time reaches: the years, or one of deep time's spans. */
  readonly spanSwitch: HTMLElement;
  /** Deep time as the view has it, or the years. */
  readonly show: (state: ViewState) => void;
  /** Go into deep time at `ma`, on the span that reaches it. */
  readonly enterDeepTime: (ma: number, deepScale?: DeepScale) => void;
  /** Go to a span, a fresh start. */
  readonly goToSpan: (span: Span) => void;
  /** Show where a zoom of the years landed (#1074), in deep time or still in the years. */
  readonly land: (target: ZoomTarget) => void;
  readonly setScale: (deepScale: DeepScale) => void;
  readonly stopPlay: () => void;
  /** Play from `ma` on the span `deepScale`, at `maPerSecond` (one of its speeds), towards today. */
  readonly playFrom: (ma: number, deepScale: DeepScale, maPerSecond: number) => void;
  readonly playing: () => boolean;
  /** How fast deep time plays now, millions of years a second. */
  readonly playSpeed: () => number;
  /** How far back the elevation maps reach, Ma. */
  readonly oldest: () => number;
}
