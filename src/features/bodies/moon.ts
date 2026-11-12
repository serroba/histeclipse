/**
 * The Moon's theory (#474): a separate chunk, loaded once the page is up. Until it arrives the
 * space view shows only the Sun, and the sky no Moon.
 */

import { loadMoonEphemeris, type MoonEphemeris } from '../../astro/moon';
import { errorMessage } from '../../util/errors';

export interface MoonContext {
  notify(message: string): void;
  /** The theory has arrived: show what needs it again. */
  moonArrived(): void;
}

export interface Moon {
  /** The Moon's ephemeris, once loaded. */
  readonly ephemeris: () => MoonEphemeris | null;
  readonly load: () => void;
}

export function createMoon(
  context: MoonContext,
  loader: () => Promise<MoonEphemeris> = loadMoonEphemeris,
): Moon {
  let ephemeris: MoonEphemeris | null = null;
  return {
    ephemeris: () => ephemeris,
    load: () => {
      loader().then(
        (loaded) => {
          ephemeris = loaded;
          context.moonArrived();
        },
        (error: unknown) => {
          context.notify(`Could not load the Moon's orbit: ${errorMessage(error)}`);
        },
      );
    },
  };
}
