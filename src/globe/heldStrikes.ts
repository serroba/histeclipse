/**
 * Strikes played as deep time runs past them (the craters', the Hadean's icy impactors), held
 * still while the reader has deep time paused and let go on as it plays again (#807).
 */

import type { GeoPoint } from '../state/viewState';

/** An impact playing, as whoever played it holds it: to carry it where its crater goes. */
export interface PlayingImpact {
  /** Carry it, crater and all, to `place`: where the plates have the crater as time runs on. */
  moveTo(place: GeoPoint): void;
  /** Whether it is held still (#807): frames pass and it does not move on. */
  readonly held: () => boolean;
  readonly hold: (held: boolean) => void;
  /** Move it on by `ms`, or back if negative, as a step of the arrow keys. */
  step(ms: number): void;
  /** Driven by the strike clock (#1173): show it `seconds` after the strike. */
  at(seconds: number): void;
  /** Take it away, played out or not. */
  end(): void;
}

/** An impact played on the globe, to whoever played it: whether it is still playing, too. */
export interface PlayedImpact extends PlayingImpact {
  playing(): boolean;
}

/** What the globe hands whoever plays `impact`: each change, while it plays, drawn at once. */
export function playedImpact(
  impact: PlayingImpact,
  playing: () => boolean,
  redraw: () => void,
): PlayedImpact {
  function drawn(change: () => void): void {
    if (!playing()) return;
    change();
    redraw();
  }
  return {
    moveTo: (place) => {
      drawn(() => {
        impact.moveTo(place);
      });
    },
    held: impact.held,
    hold: (held) => {
      drawn(() => {
        impact.hold(held);
      });
    },
    step: (ms) => {
      drawn(() => {
        impact.step(ms);
      });
    },
    at: (seconds) => {
      drawn(() => {
        impact.at(seconds);
      });
    },
    end: () => {
      drawn(() => {
        impact.end();
      });
    },
    playing,
  };
}

export interface HeldStrikes {
  /** Keep `played` with the others, and hand it back. */
  add(played: PlayedImpact): PlayedImpact;
  /** Hold each still while `paused`, or let it play on; those played out are let go. */
  sync(paused: boolean): void;
}

export function heldStrikes(): HeldStrikes {
  const playing = new Set<PlayedImpact>();
  return {
    add(played) {
      playing.add(played);
      return played;
    },
    sync(paused) {
      for (const played of playing) {
        if (!played.playing()) playing.delete(played);
        else if (played.held() !== paused) played.hold(paused);
      }
    },
  };
}
