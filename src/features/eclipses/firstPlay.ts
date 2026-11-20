/**
 * Where ▶ plays an eclipse from (#986). An eclipse often opens at the moment that matters to the
 * reader's place, as the eclipse of Thales does at Anatolia's deepest, 95 minutes after the
 * greatest: played from there, only its last hour and a half went by, the shadow sliding off
 * the globe. So the first ▶ on an eclipse just opened plays it from its start, the shadow's
 * approach and its reach; a ▶ after that, or after the reader has moved the time themselves,
 * goes on from where it is. At the end, ▶ starts again from the start, as it always did.
 */

export interface FirstPlay {
  /** The eclipse shown, by a key of its own: a new one plays from its start. */
  show(key: string): void;
  /** The reader moved the time themselves: ▶ goes on from there. */
  moved(): void;
  /** ▶ at `offset` minutes from greatest, of a range ±`range`: go to its start, if it should. */
  play(offset: number, range: number, goTo: (offset: number) => void): void;
}

export function firstPlay(): FirstPlay {
  let shown: string | null = null;
  let fresh = false;
  return {
    show(key) {
      if (key === shown) return;
      shown = key;
      fresh = true;
    },
    moved() {
      fresh = false;
    },
    play(offset, range, goTo) {
      if (fresh || offset >= range) goTo(-range);
      fresh = false;
    },
  };
}
