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
import type { StoryDate } from '../../deepTime/storyDate';
import { formatMa } from '../../time/format';
import type { Pace } from '../../deepTime/playSpeed';
import type { LayerCapability } from '../../globe/layerCapabilities';
import type { GlobeLayer, LayerFactory } from '../../globe/layerHost';
import type { Capabilities, FeatureCore } from '../feature';
import type { LossGauge } from './lossGauge';
import { createGuide, type GuideView } from './guide';
import type { ProxyChart } from './proxyChart';
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
  layer<Input, Needs extends LayerCapability = never>(
    factory: LayerFactory<Input, Needs>,
  ): GlobeLayer<Input>;
}

/** An event drawing on its clock: shown at a moment, and taken away. */
interface OwnTimePlay {
  at(seconds: number): void;
  end(): void;
}

export { phase, phaseAt, type EventPhase } from './phases';
export type { DatedWindow } from './strikeClock';
export type { LossGauge } from './lossGauge';
export type { GuideView } from './guide';
export type { ProxyChart, ProxyReading } from './proxyChart';

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
  /** Its extinction's dated window, where one is dated (#1228). */
  readonly dated?: DatedWindow;
  /** What it draws to illustrate, not measure, said under its clock (#1226). */
  readonly drawn?: string;
  /** What its extinction took, as a gauge of the life left on its clock (#1223). */
  readonly loss?: LossGauge;
  /** Measured records, drawn above its clock's slider (#1229). */
  readonly proxies?: readonly ProxyChart[];
  /** Its key moments, seconds since it: its clock's play lingers there to be read (#1267). */
  readonly lingers?: readonly number[];
  /** Where the camera looks as its clock plays, turned back there when left alone (#1266). */
  readonly views?: readonly GuideView[];
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

/** A clock starting further right than this share of the page sits beside the globe (#1266). */
const BESIDE = 0.35;

/**
 * Keep the globe centred in the space left of `root` while it sits beside it, as the boundaries'
 * sheet does, so what the camera turns to is not behind it (#1266). Returns how to stop.
 */
function keepClear(
  root: HTMLElement,
  globe: Pick<Capabilities['strikes'], 'setInsets'>,
): () => void {
  const inset = (): void => {
    const box = root.getBoundingClientRect();
    const beside = box.width > 0 && box.left > window.innerWidth * BESIDE;
    globe.setInsets({ right: beside ? window.innerWidth - box.left : 0 });
  };
  const observer = new ResizeObserver(inset);
  observer.observe(root);
  window.addEventListener('resize', inset);
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', inset);
    globe.setInsets({ right: 0 });
  };
}

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

/**
 * Deep time carried along by the clock of its own story (#1218): moved to the clock's moment, and
 * handed back at its end. For any other event, nothing.
 */
function carried(
  core: Pick<FeatureCore, 'change'>,
  event: OwnTimeEvent,
): { at(seconds: number): void; handBack(): void; from(ma: number | null): number | undefined } {
  const { deep } = event;
  const move = (ma: number): void => {
    const to = roundMa(ma);
    core.change((state) => (state.ma === null || state.ma === to ? state : { ...state, ma: to }));
  };
  return {
    at(seconds) {
      if (deep !== undefined) move(deep.maAt(seconds));
    },
    // Whether played to its end or skipped, from its end.
    handBack() {
      if (deep !== undefined) move(deep.maAt(event.scale.secondsAt(event.scale.end)));
    },
    from: (ma) => (deep === undefined || ma === null ? undefined : deep.secondsAt(ma)),
  };
}

/**
 * An event's dated window, what it draws to illustrate and what it took, for its clock, where it
 * has them.
 */
function marked(event: OwnTimeEvent): {
  dated?: DatedWindow;
  drawn?: string;
  loss?: LossGauge;
  proxies?: readonly ProxyChart[];
  lingers?: readonly number[];
} {
  return {
    ...(event.proxies === undefined ? {} : { proxies: event.proxies }),
    ...(event.lingers === undefined ? {} : { lingers: event.lingers }),
    ...(event.dated === undefined ? {} : { dated: event.dated }),
    ...(event.drawn === undefined ? {} : { drawn: event.drawn }),
    ...(event.loss === undefined ? {} : { loss: event.loss }),
  };
}

/** What an event's drawing is lent: the strikes, and its layers, each added once and kept. */
function drawingTools(core: Pick<FeatureCore, 'globe'>, lent: Lent): OwnTimeTools {
  const layers = new Map<object, GlobeLayer<never>>();
  return {
    strikes: lent.strikes,
    layer<Input, Needs extends LayerCapability = never>(
      factory: LayerFactory<Input, Needs>,
    ): GlobeLayer<Input> {
      const made =
        (layers.get(factory) as GlobeLayer<Input> | undefined) ?? core.globe.addLayer(factory);
      layers.set(factory, made);
      return made;
    },
  };
}

export function createOwnTime(
  core: Pick<FeatureCore, 'globe' | 'change' | 'refresh'>,
  lent: Lent,
): OwnTime {
  const tools = drawingTools(core, lent);
  const offer = createStrikeOffer((element) => {
    lent.overPage.add(element);
  });
  let clock: StrikeClock | null = null;
  // The event open, and the event offered last and until when (ms): it goes after a while.
  let open: { readonly key: string; readonly rank: number } | null = null;
  let offered: { readonly key: string; readonly rank: number; readonly until: number } | null =
    null;
  const lender = createLender(core);
  let stopClear = (): void => undefined;

  function watch(event: OwnTimeEvent, ma: number | null): void {
    offer.hide();
    offered = null;
    // One at a time: closing the last ends what it drew.
    clock?.close();
    clock?.root.remove();
    const held = ma !== null && lent.deepTime.hold();
    if (ma !== null) core.change((state) => (state.ma === null ? state : { ...state, ma }));
    const playing = event.play(tools);
    const guide = createGuide(event.views ?? [], { camera: lent.strikes, input: lent.strikes.on });
    const deep = carried(core, event);
    open = { key: event.key, rank: event.rank ?? 0 };
    const zero = event.ma ?? ma;
    document.documentElement.toggleAttribute('data-own-time', true);
    clock = createStrikeClock({
      title: event.title,
      phases: event.phases,
      scale: event.scale,
      ...marked(event),
      onMoment: (seconds) => {
        playing.at(seconds);
        guide.at(seconds);
        deep.at(seconds);
        if (zero === null) return;
        const at = zero - seconds / MYR;
        lender.lend({ when: formatMa(at), what: null, ma: at });
      },
      onClose: () => {
        playing.end();
        guide.end();
        stopClear();
        open = null;
        document.documentElement.toggleAttribute('data-own-time', false);
        lender.lend(null);
        deep.handBack();
        if (held) lent.deepTime.resume();
      },
      closeAtEnd: event.deep !== undefined,
    });
    lent.overPage.add(clock.root);
    stopClear = keepClear(clock.root, lent.strikes);
    clock.open(deep.from(ma));
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
