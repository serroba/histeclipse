/**
 * Playing deep time towards the present: at a pace (#1076), or a story's own speed, easing near
 * milestones and finds so they can be read as they pass (#1077), and stopping at the bar's young
 * end. From there, play starts again at the bar's oldest.
 */

import { anchorMa, MILESTONES } from '../../deepTime/milestones';
import { easeAt } from '../../deepTime/playEase';
import { playhead } from '../../deepTime/playhead';
import { DEFAULT_PACE, paceSpeed, type Pace } from '../../deepTime/playSpeed';
import type { Store } from '../../state/store';
import type { DeepBarWindow } from '../../state/timeZoom';
import type { ViewState } from '../../state/viewState';

export interface PlayingParts {
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  /** The part of the span the bar shows. */
  shown(state: ViewState): DeepBarWindow;
  /** What play eases near besides the milestones, Ma: the finds of the layers on. */
  finds(state: ViewState): readonly number[];
  /** A loop calling `tick` each frame with the seconds since the last, started and stopped. */
  loop(tick: (seconds: number) => void): { start(): void; stop(): void };
  /** Playing started or stopped, or how it plays changed: the bar shows it. */
  changed(): void;
  /** Whether the reader asks for less motion: easing starts off. */
  readonly lessMotion: boolean;
}

export interface Playing {
  readonly playing: () => boolean;
  readonly start: () => void;
  readonly stop: () => void;
  /** How fast it plays, Ma a second, before easing: a story's speed, or the pace's. */
  readonly speed: () => number;
  readonly pace: () => Pace;
  readonly setPace: (pace: Pace) => void;
  /** A story plays at its own speed (#177), not eased, until it stops. */
  readonly story: (maPerSecond: number) => void;
  /** Whether play eases near milestones and finds (#1077). */
  readonly easing: () => boolean;
  readonly setEasing: (on: boolean) => void;
}

/** Where each milestone sits on the time line. */
const MILESTONE_MARKS = MILESTONES.map(anchorMa);

export function deepPlaying(parts: PlayingParts): Playing {
  const { store } = parts;
  let playing = false;
  let pace: Pace = DEFAULT_PACE;
  let storySpeed: number | null = null;
  let easing = !parts.lessMotion;
  let head = playhead();
  const speed = (): number => {
    const { oldest, youngest } = parts.shown(store.get());
    return storySpeed ?? paceSpeed(oldest - youngest, pace);
  };
  function stop(): void {
    if (!playing) return;
    playing = false;
    storySpeed = null;
    frames.stop();
    parts.changed();
  }
  function tick(seconds: number): void {
    const state = store.get();
    const { ma } = state;
    if (ma === null) {
      stop();
      return;
    }
    const { youngest } = parts.shown(state);
    const full = speed();
    const share =
      easing && storySpeed === null
        ? easeAt(ma, full, [...MILESTONE_MARKS, ...parts.finds(state)])
        : 1;
    const next = Math.max(youngest, head.step(ma, full * share, seconds));
    store.set((now) => ({ ...now, ma: next }));
    if (next <= youngest) stop();
  }
  const frames = parts.loop(tick);
  return {
    playing: () => playing,
    start() {
      if (playing) return;
      playing = true;
      const { oldest, youngest } = parts.shown(store.get());
      if ((store.get().ma ?? 0) <= youngest) store.set((state) => ({ ...state, ma: oldest }));
      head = playhead();
      frames.start();
      parts.changed();
    },
    stop,
    speed,
    pace: () => pace,
    setPace(picked) {
      pace = picked;
      storySpeed = null;
      parts.changed();
    },
    story(maPerSecond) {
      storySpeed = maPerSecond;
    },
    easing: () => easing,
    setEasing(on) {
      easing = on;
      parts.changed();
    },
  };
}

/** What deep time plays with, as `heldPlay` needs it. */
type DeepPlay = Pick<Playing, 'playing' | 'start' | 'stop' | 'pace'>;

/** Deep time held for a while and resumed, as features are lent it. */
export interface HeldPlay {
  hold(): boolean;
  resume(): void;
  pace(): Pace;
}

/**
 * Deep time held for a while and resumed (#1174), as a feature is lent it: holding says whether
 * it was playing, so it is resumed only if it was.
 */
export function heldPlay(deep: DeepPlay): HeldPlay {
  return {
    hold() {
      const was = deep.playing();
      deep.stop();
      return was;
    },
    resume() {
      deep.start();
    },
    pace: () => deep.pace(),
  };
}
