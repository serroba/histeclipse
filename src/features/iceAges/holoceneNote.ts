/**
 * What the years' track says of the Holocene's Earth while travelling through it (#444): kept
 * by the ice ages' layer, read by the track.
 */

export interface HoloceneNote {
  /** What the track says of the Earth shown, or null while it shows none. */
  said(): string | null;
  /** Keep what to say, without telling the track. */
  keep(said: string | null): void;
  /** The Holocene's Earth was drawn: the track says what it shows. */
  shown(): void;
}

/** The note, telling `noted` each time the Holocene's Earth is drawn. */
export function createHoloceneNote(noted: () => void): HoloceneNote {
  let last: string | null = null;
  return {
    said: () => last,
    keep(said) {
      last = said;
    },
    shown: noted,
  };
}
