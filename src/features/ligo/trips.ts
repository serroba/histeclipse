/**
 * Each wave's journey to Earth, as data (#833, #993): how far it came, which way (the source's
 * place in the sky, if it is known), which detectors heard it and in what order, the stretch of
 * the wave played as it sweeps Earth, and what to say once it has passed. `journey.ts` works the
 * rest out from it.
 *
 * GW150914 was heard by two detectors, which fix only a cone of directions: it is drawn from the
 * cone's most southern way, a stand-in. GW170817's host galaxy, NGC 4993, was found, so its way
 * is known: from the kilonova's place, AT 2017gfo, at 13h09m48.085s, −23°22′53.35″ (J2000;
 * Abbott et al. 2017, ApJL 848, L12).
 *
 * Pure: no DOM, no three.js, no imports.
 */

/** The detectors a journey can mark. */
export type DetectorId = 'L1' | 'H1' | 'V1';

/** Where each stands (LALSuite's detector constants), and what the journey calls it. */
export const SITES: Readonly<
  Record<
    DetectorId,
    { readonly name: string; readonly latitude: number; readonly longitude: number }
  >
> = {
  L1: { name: 'Livingston', latitude: 30.5629, longitude: -90.7742 },
  H1: { name: 'Hanford', latitude: 46.4551, longitude: -119.4077 },
  V1: { name: 'Virgo', latitude: 43.6314, longitude: 10.5045 },
};

export interface Trip {
  /** How far the wave came, light-years. */
  readonly lightYears: number;
  /** Where its source is in the sky, and when the merger's wave reached Earth's middle; null
   * when only the delay between two detectors is known. */
  readonly source: {
    readonly rightAscension: number;
    readonly declination: number;
    readonly utc: string;
  } | null;
  /** How much later Hanford heard it than Livingston, s, when the source is not known. */
  readonly delay: number;
  /** The detectors that heard it, in the order they did. */
  readonly heard: readonly DetectorId[];
  /** The hour and minute of the merger, UTC, and the second its times are counted from. */
  readonly clock: { readonly hour: number; readonly minute: number; readonly second: number };
  /** The wave played as it sweeps Earth, s from when the merger's wave reached Livingston; and
   * how far back it starts while it crosses space, so Earth is still at first. */
  readonly window: { readonly from: number; readonly to: number; readonly approach: number };
  /** What to say once it has passed, if anything. */
  readonly after?: string;
}

export const GW150914_TRIP: Trip = {
  lightYears: 1.3e9,
  source: null,
  delay: 0.0069,
  heard: ['L1', 'H1'],
  clock: { hour: 9, minute: 50, second: 45 },
  window: { from: -0.11, to: 0.035, approach: 0.13 },
};

export const GW170817_TRIP: Trip = {
  lightYears: 1.3e8,
  source: {
    rightAscension: (13 + 9 / 60 + 48.085 / 3600) * 15,
    declination: -(23 + 22 / 60 + 53.35 / 3600),
    utc: '2017-08-17T12:41:04.4Z',
  },
  delay: 0,
  heard: ['V1', 'L1', 'H1'],
  clock: { hour: 12, minute: 41, second: 0 },
  window: { from: -0.06, to: 0.01, approach: 0.13 },
  after:
    'and 1.7 s behind the wave, after 130 million years, the gamma rays of GRB 170817A: gravity travels at the speed of light',
};
