/**
 * Who has the moment shown while the Holocene chapter has the globe (#845): the chart, as it
 * plays, or the reader, who has moved deep time's bar. One at a time, or each undoes the other.
 *
 * The story gives the globe the chart's year (`gave`). A moment in the view the story did not
 * give is the reader's: the chart is then held at it, paused, and its year, heard back, is
 * only the echo of that hold (`follows` says no). Once the chart moves of itself, by Play or
 * its own cursor, it has the moment again.
 *
 * Pure: no DOM.
 */

export interface TimeOwner {
  /** The story gave the globe `ma`; null as it lets the globe go. */
  gave(ma: number | null): void;
  /** Whether `ma`, in the view while the story has the globe, is the reader's own move. */
  movedByReader(ma: number | null): boolean;
  /** The chart is held for the reader at `year` (null: no chart to hold). */
  held(year: number | null): void;
  /** Whether the globe should follow the chart's `year`: not while it only echoes a hold. */
  follows(year: number): boolean;
}

export function createTimeOwner(): TimeOwner {
  let given: number | null = null;
  let heldAt: number | null = null;
  return {
    gave(ma) {
      given = ma;
      if (ma === null) heldAt = null;
    },
    movedByReader(ma) {
      if (ma === null || ma === given) return false;
      given = ma;
      return true;
    },
    held(year) {
      heldAt = year;
    },
    follows(year) {
      if (heldAt !== null && year === heldAt) return false;
      heldAt = null;
      return true;
    },
  };
}
