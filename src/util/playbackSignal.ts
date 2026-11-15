/**
 * Play starting and stopping, said to whoever listens (#764): the telemetry, when it runs,
 * times the frames between and sends how smooth play was. The app does not know whether anyone
 * listens: telemetry is a chunk of its own, loaded only with a key.
 */

export const PLAYBACK_EVENT = 'histeclipse:playback';

export type PlaybackValue = string | number | boolean;

export interface PlaybackSignal {
  readonly phase: 'start' | 'stop';
  /** Which player: `launches`. */
  readonly kind: string;
  /** What it says of itself: its pace, how far it went, why it stopped. */
  readonly detail: Readonly<Record<string, PlaybackValue>>;
}

/** Say that play started or stopped. */
export function signalPlayback(signal: PlaybackSignal, target: EventTarget = globalThis): void {
  target.dispatchEvent(new CustomEvent<PlaybackSignal>(PLAYBACK_EVENT, { detail: signal }));
}
