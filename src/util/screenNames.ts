/**
 * How many names the globe shows over its picture right now, of how many, and whether it is
 * being turned: what made frames slow in #631. The globe notes it where it places the names,
 * and telemetry reads it when a frame runs long (#636). Plain numbers: noting them costs
 * nothing, and nothing asks the page.
 */

export interface NamesShown {
  /** Names on Earth's surface shown now. */
  readonly shown: number;
  /** Names on Earth's surface the layers have, shown or not. */
  readonly total: number;
}

export interface ScreenNames extends NamesShown {
  /** Whether the camera moved since the frame before: then fewer names are shown. */
  readonly turning: boolean;
}

/** Written in place each frame, so noting makes nothing new; read as a copy, seldom. */
const current = { shown: 0, total: 0, turning: false };

/** Called where the names are placed, each time they are. */
export function noteScreenNames(names: NamesShown, turning: boolean): void {
  current.shown = names.shown;
  current.total = names.total;
  current.turning = turning;
}

/** The names as last placed. */
export function screenNames(): ScreenNames {
  return { ...current };
}
