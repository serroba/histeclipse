/**
 * Events watched in their own time (#1173, #1174, #1191): one clock over the page at a time,
 * shared by the layers that reach an event, so Chicxulub's opens from its crater (Impacts) and
 * from the end-Cretaceous (Extinctions) alike. Deep time is held at the event while its clock is
 * open, and resumes when it is closed. As deep time plays past an event it hands over to the
 * clock at Slow, and offers it faster, once however many layers reach it.
 *
 * An event that is deep time's own story, Earth and the Moon forming as the aeons begin (#1218),
 * carries deep time's moment along with its clock, opens at the moment deep time was at, and
 * when it ends or is closed hands back to deep time from the clock's end, playing on.
 *
 * What an event draws is its own (`OwnTimeEvent.play`): Chicxulub's strike and the ground round
 * it, or the Siberian Traps' fumes; the layers it draws on are added the first time it plays.
 */

import type { ClockScale } from '../../deepTime/clockScale';
import { roundMa } from '../../deepTime/scale';
import type { Pace } from '../../deepTime/playSpeed';
import type { GlobeLayer, LayerFactory } from '../../globe/layerHost';
import type { Capabilities, FeatureCore } from '../feature';
import type { EventPhase } from './phases';
import { createStrikeClock, createStrikeOffer, OFFER_MS, type StrikeClock } from './strikeClock';

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
  /**
   * Deep time's moment, Ma, at `seconds` since the event, and the seconds at a moment: given, its
   * clock carries deep time along and hands back to it at its end (#1218).
   */
  readonly deep?: {
    maAt(seconds: number): number;
    secondsAt(ma: number): number;
  };
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
}

/**
 * How deep time hands an event over to its clock (#1174): at Slow, on its own; faster, a reader
 * skimming the ages is not stopped, and is offered the clock instead.
 */
export function handover(pace: Pace): 'clock' | 'offer' {
  return pace === 'slow' ? 'clock' : 'offer';
}

type Lent = Pick<Capabilities, 'strikes' | 'deepTime' | 'overPage'>;

export function createOwnTime(core: Pick<FeatureCore, 'globe' | 'change'>, lent: Lent): OwnTime {
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

  /** Deep time's moment set to `ma`, if it is in deep time. */
  function moveDeep(ma: number): void {
    const to = roundMa(ma);
    core.change((state) => (state.ma === null || state.ma === to ? state : { ...state, ma: to }));
  }

  function watch(event: OwnTimeEvent, ma: number | null): void {
    offer.hide();
    offered = null;
    // One at a time: closing the last ends what it drew.
    clock?.close();
    clock?.root.remove();
    const held = ma !== null && lent.deepTime.hold();
    if (ma !== null) core.change((state) => (state.ma === null ? state : { ...state, ma }));
    const playing = event.play(tools);
    const { deep } = event;
    open = { key: event.key, rank: event.rank ?? 0 };
    const made = createStrikeClock({
      title: event.title,
      phases: event.phases,
      scale: event.scale,
      onMoment: (seconds) => {
        playing.at(seconds);
        if (deep !== undefined) moveDeep(deep.maAt(seconds));
      },
      onClose: () => {
        playing.end();
        open = null;
        // Deep time's own story hands back from its end, whether played there or skipped.
        if (deep !== undefined) moveDeep(deep.maAt(event.scale.secondsAt(event.scale.end)));
        if (held) lent.deepTime.resume();
      },
      ...(deep === undefined
        ? {}
        : {
            onEnd: () => {
              made.close();
            },
          }),
    });
    clock = made;
    lent.overPage.add(made.root);
    made.open(deep === undefined || ma === null ? undefined : deep.secondsAt(ma));
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
  };
}
