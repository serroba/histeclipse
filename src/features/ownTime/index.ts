/**
 * Events watched in their own time (#1173, #1174, #1191): one clock over the page at a time,
 * shared by the layers that reach an event, so Chicxulub's opens from its crater (Impacts) and
 * from the end-Cretaceous (Extinctions) alike. Deep time is held at the event while its clock is
 * open, and resumes when it is closed. As deep time plays past an event it hands over to the
 * clock at Slow, and offers it faster, once however many layers reach it.
 *
 * What an event draws is its own (`OwnTimeEvent.play`): Chicxulub's strike and the ground round
 * it, or the Siberian Traps' fumes; the layers it draws on are added the first time it plays.
 */

import type { ClockScale } from '../../deepTime/clockScale';
import type { StoryDate } from '../../deepTime/storyDate';
import { formatMa } from '../../time/format';
import type { Pace } from '../../deepTime/playSpeed';
import type { GlobeLayer, LayerFactory } from '../../globe/layerHost';
import type { Capabilities, FeatureCore } from '../feature';
import type { EventPhase } from './phases';
import {
  createStrikeClock,
  createStrikeOffer,
  OFFER_MS,
  type DatedWindow,
  type StrikeClock,
} from './strikeClock';

/** What an event playing on its clock is given to draw with. */
interface OwnTimeTools {
  readonly strikes: Capabilities['strikes'];
  /** A layer on the globe, added the first time it is asked for and kept for the next. */
  layer<Input>(factory: LayerFactory<Input>): GlobeLayer<Input>;
}

/** An event drawing on its clock: shown at a moment, and taken away. */
interface OwnTimePlay {
  at(seconds: number): void;
  end(): void;
}

export { phase, phaseAt, type EventPhase } from './phases';
export type { DatedWindow } from './strikeClock';

export interface OwnTimeEvent {
  /** Which event: the same one reached by two layers is watched once. */
  readonly key: string;
  /** What its clock is called: "Chicxulub, in its own time". */
  readonly title: string;
  readonly phases: readonly EventPhase[];
  readonly scale: ClockScale;
  /** Its offer's words: "Watch Chicxulub in its own time". */
  readonly offer: string;
  /**
   * How much it draws (#1206): of two ways to draw one event, reached at once by two layers, the
   * one with more takes the clock over. Chicxulub with the Deccan Traps fuming outranks it alone.
   */
  readonly rank?: number;
  /** Its extinction's dated window, where one is dated (#1228). */
  readonly dated?: DatedWindow;
  /**
   * When its clock's zero is, Ma, where dated more closely than the moment it is watched from
   * (#1222): the end-Permian's start at Meishan, 251.941 Ma, not the 251.9 its card is at.
   */
  readonly ma?: number;
  /** Start drawing it, to be moved by its clock. */
  play(tools: OwnTimeTools): OwnTimePlay;
}

export interface OwnTime {
  /** Watch `event` now, deep time held at `ma` (if it is in deep time) until its clock closes. */
  watch(event: OwnTimeEvent, ma: number | null): void;
  /**
   * Deep time has played past `event` at `ma`: at Slow its clock opens; faster, it is offered
   * for a while. An event already open or offered is left as it is, unless this draws more of it
   * (`rank`). Says which it did.
   */
  arrive(event: OwnTimeEvent, ma: number): 'clock' | 'offer' | 'already';
  /**
   * The moment the open clock is at, lent deep time's header and bar (#1222), so they say the
   * age and period it shows, not the one deep time is held at; null with none open.
   */
  lent(): StoryDate | null;
}

/** Seconds in a million years. */
const MYR = 1e6 * 365.25 * 86_400;
/** How often the header may be written again as a clock plays, ms: four times a second. */
const LEND_MS = 250;

/**
 * How deep time hands an event over to its clock (#1174): at Slow, on its own; faster, a reader
 * skimming the ages is not stopped, and is offered the clock instead.
 */
export function handover(pace: Pace): 'clock' | 'offer' {
  return pace === 'slow' ? 'clock' : 'offer';
}

type Lent = Pick<Capabilities, 'strikes' | 'deepTime' | 'overPage'>;

/**
 * The moment lent deep time's header (#1222): the header is written again only when its words
 * change, and at most every `LEND_MS` as a clock plays; at once when the clock closes.
 */
function createLender(core: Pick<FeatureCore, 'refresh'>): {
  lend(next: StoryDate | null): void;
  readonly lent: () => StoryDate | null;
} {
  let lending: StoryDate | null = null;
  let writing: ReturnType<typeof setTimeout> | null = null;
  return {
    lend(next) {
      if (next?.when === lending?.when) return;
      lending = next;
      if (next === null) {
        if (writing !== null) clearTimeout(writing);
        writing = null;
        core.refresh();
        return;
      }
      writing ??= setTimeout(() => {
        writing = null;
        core.refresh();
      }, LEND_MS);
    },
    lent: () => lending,
  };
}

export function createOwnTime(
  core: Pick<FeatureCore, 'globe' | 'change' | 'refresh'>,
  lent: Lent,
): OwnTime {
  const layers = new Map<LayerFactory<never>, GlobeLayer<never>>();
  const tools: OwnTimeTools = {
    strikes: lent.strikes,
    layer<Input>(factory: LayerFactory<Input>): GlobeLayer<Input> {
      const made = layers.get(factory) ?? core.globe.addLayer(factory);
      layers.set(factory, made);
      return made;
    },
  };
  const offer = createStrikeOffer((element) => {
    lent.overPage.add(element);
  });
  let clock: StrikeClock | null = null;
  // The event open, and the event offered last and until when (ms): it goes after a while.
  let open: { readonly key: string; readonly rank: number } | null = null;
  let offered: { readonly key: string; readonly rank: number; readonly until: number } | null =
    null;
  const lender = createLender(core);

  function watch(event: OwnTimeEvent, ma: number | null): void {
    offer.hide();
    offered = null;
    // One at a time: closing the last ends what it drew.
    clock?.close();
    clock?.root.remove();
    const held = ma !== null && lent.deepTime.hold();
    if (ma !== null) core.change((state) => (state.ma === null ? state : { ...state, ma }));
    const playing = event.play(tools);
    open = { key: event.key, rank: event.rank ?? 0 };
    const zero = event.ma ?? ma;
    document.documentElement.toggleAttribute('data-own-time', true);
    clock = createStrikeClock({
      title: event.title,
      phases: event.phases,
      scale: event.scale,
      ...(event.dated === undefined ? {} : { dated: event.dated }),
      onMoment: (seconds) => {
        playing.at(seconds);
        if (zero === null) return;
        const at = zero - seconds / MYR;
        lender.lend({ when: formatMa(at), what: null, ma: at });
      },
      onClose: () => {
        playing.end();
        open = null;
        document.documentElement.toggleAttribute('data-own-time', false);
        lender.lend(null);
        if (held) lent.deepTime.resume();
      },
    });
    lent.overPage.add(clock.root);
    clock.open();
  }

  return {
    watch,
    arrive(event, ma) {
      const now = performance.now();
      const rank = event.rank ?? 0;
      const live = offered !== null && now < offered.until ? offered : null;
      // Open or offered already, as fully drawn: left as it is.
      if ([open, live].some((each) => each?.key === event.key && each.rank >= rank))
        return 'already';
      const handing = handover(lent.deepTime.pace());
      if (handing === 'clock') {
        watch(event, ma);
        return 'clock';
      }
      offered = { key: event.key, rank, until: now + OFFER_MS };
      offer.show(event.offer, () => {
        watch(event, ma);
      });
      return 'offer';
    },
    lent: lender.lent,
  };
}
