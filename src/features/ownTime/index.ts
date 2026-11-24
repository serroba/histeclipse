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
  /** Start drawing it, to be moved by its clock. */
  play(tools: OwnTimeTools): OwnTimePlay;
}

export interface OwnTime {
  /** Watch `event` now, deep time held at `ma` (if it is in deep time) until its clock closes. */
  watch(event: OwnTimeEvent, ma: number | null): void;
  /**
   * Deep time has played past `event` at `ma`: at Slow its clock opens; faster, it is offered
   * for a while. An event already open or offered is left as it is. Says which it did.
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
  let open: string | null = null;
  // The event offered last, and until when (ms): the offer goes by itself after a while.
  let offered: { readonly key: string; readonly until: number } | null = null;

  function watch(event: OwnTimeEvent, ma: number | null): void {
    offer.hide();
    offered = null;
    // One at a time: closing the last ends what it drew.
    clock?.close();
    clock?.root.remove();
    const held = ma !== null && lent.deepTime.hold();
    if (ma !== null) core.change((state) => (state.ma === null ? state : { ...state, ma }));
    const playing = event.play(tools);
    open = event.key;
    clock = createStrikeClock({
      title: event.title,
      phases: event.phases,
      scale: event.scale,
      onMoment: (seconds) => {
        playing.at(seconds);
      },
      onClose: () => {
        playing.end();
        open = null;
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
      if (open === event.key || (offered?.key === event.key && now < offered.until))
        return 'already';
      const handing = handover(lent.deepTime.pace());
      if (handing === 'clock') {
        watch(event, ma);
        return 'clock';
      }
      offered = { key: event.key, until: now + OFFER_MS };
      offer.show(event.offer, () => {
        watch(event, ma);
      });
      return 'offer';
    },
  };
}
