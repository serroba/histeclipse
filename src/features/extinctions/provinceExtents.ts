/**
 * How far each volcanic province's lava is drawn (#1230): over the area its studies estimate it
 * once covered, said with whose estimate it is, what else is estimated, and what crops out today.
 *
 * The drawing scatters vents over a disc `spread` degrees round the province's middle and runs
 * lava from each over the land of the time (`fumesLayer.ts`, `lavaFlowsPart.ts`); `spread` is
 * set so the lava's drawn extent at its fullest comes to the estimate, as the tests work out. It
 * is a ragged disc on the land of the time, not the province's mapped outline.
 *
 * Pure.
 */

/** A province's drawn extent: its vents' spread, degrees; the area it comes to, km²; and whose. */
export interface Extent {
  readonly spread: number;
  /** The area its lava is drawn over at its fullest, km². */
  readonly area: number;
  readonly says: string;
}

export const EXTENTS = {
  siberian: {
    spread: 8.5,
    area: 5e6,
    says: 'Its lava is drawn over some 5 million km² at its fullest, the original extent Reichow et al. (2009) and Augland et al. (2019) estimate; some 2.5 million km² crop out today (Reichow et al.). The shape is drawn, not mapped.',
  },
  camp: {
    spread: 12.1,
    area: 1e7,
    says: 'Its lava is drawn over some 10 million km² at its fullest, its extent as known now (Lindström et al. 2021); as first mapped, over 7 million (Marzoli et al. 1999). The shape is drawn, not mapped.',
  },
  emeishan: {
    spread: 2.7,
    area: 5e5,
    says: 'Its lava is drawn over some 500,000 km², one estimate of its first extent (as Kravchinsky 2012 lists it); its main outcrops cover some 250,000 to 300,000 km² today (Zi et al. 2010; Shellnutt 2015). The shape is drawn, not mapped.',
  },
  deccan: {
    spread: 4.7,
    area: 1.5e6,
    says: 'Its lava, all flowed, would be drawn over some 1.5 million km², half of it here: its first extent is estimated at 1 to 2.6 million, estimates called highly speculative; some 500,000 km² remain today (as Verma & Khosla 2019 review). The shape is drawn, not mapped.',
  },
  viluy: {
    spread: 3.8,
    area: 1e6,
    says: 'Its lava is drawn over some 1 million km², the “more than 1 million” Kravchinsky (2012) lists for its area; the Viluy rift is some 800 km long and 450 km wide (Kiselev et al. 2006, as Kravchinsky gives it), and much of the province is eroded or lies under the Siberian Traps (Courtillot et al. 2010). The shape is drawn, not mapped.',
  },
} as const satisfies Readonly<Record<string, Extent>>;
