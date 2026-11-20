/**
 * The gravitational waves the story can tell (#990, epic #994), each as a profile: what its title
 * and card say, which chapters its story has and what each says, what made it (two black holes,
 * or two neutron stars) and at what sizes they are drawn, how its sound is changed to be heard,
 * and where its wave comes from (LIGO's measured waveform, or a model). The views take the
 * profile; nothing else in them is particular to one event.
 *
 * GW150914 (#834) was two black holes, which leave nothing behind but a bigger black hole.
 * GW170817 was two neutron stars, and lit up the sky: its kilonova follows in #992.
 *
 * Pure: no DOM, no three.js.
 */

import type { Wave, WaveChapter } from '../../state/slices/display';
import type { WhyId } from '../../sources/registry';
import type { MarkerCardContent } from '../../ui/markerCard';
import { GW150914_CARD, GW170817_CARD, HEAVY_ELEMENTS_CARD } from './eventCard';
import { GW170817_MODEL, type ChirpOptions } from './strain';

/** What made the wave: what is drawn orbiting in the source chapter. */
type BodyKind = 'black holes' | 'neutron stars';

/** Masses in Suns; sizes as a share of how far apart the two are when the wave is first played. */
export interface Bodies {
  readonly kind: BodyKind;
  readonly masses: { readonly first: number; readonly second: number; readonly final: number };
  readonly sizes: { readonly first: number; readonly second: number; readonly final: number };
}

/** Where the wave played comes from: LIGO's measured waveform, fetched, or a model chirp. */
type WaveOrigin =
  | { readonly kind: 'measured'; readonly file: string }
  | {
      readonly kind: 'model';
      readonly chirp: ChirpOptions;
      /** When the merger's wave reached Livingston, s after the minute of `utc`. */
      readonly atLivingston: number;
    };

export interface WaveEvent {
  readonly id: Wave;
  /** The stage's heading. */
  readonly title: string;
  /** What its card's button and the card are called. */
  readonly name: string;
  readonly card: MarkerCardContent;
  readonly why: WhyId;
  /** Its story's chapters, in order. */
  readonly chapters: readonly WaveChapter[];
  /** What each chapter shows, in words. */
  readonly about: Readonly<Partial<Record<WaveChapter, string>>>;
  /** How far the drawing is from the truth: always shown. */
  readonly scaleNote: string;
  readonly sound: {
    /** How many times higher the tone is than the wave. */
    readonly raised: number;
    /** How it was changed to be heard. */
    readonly note: string;
  };
  readonly bodies: Bodies;
  readonly origin: WaveOrigin;
  /** A second card, offered in one chapter: GW170817's heavy elements in its kilonova (#992). */
  readonly more?: {
    readonly chapter: WaveChapter;
    readonly label: string;
    readonly card: MarkerCardContent;
  };
}

/** G·M☉, m³/s². */
const SUN_GM = 1.327_124_4e20;

/**
 * How far apart two bodies of `suns` together are, km, while their wave is at `hertz`: by
 * Kepler's third law, a³ = GM/ω², the orbit's ω being half the wave's 2πf.
 */
export function separationKm(suns: number, hertz: number): number {
  const omega = Math.PI * hertz;
  return Math.cbrt((SUN_GM * suns) / (omega * omega)) / 1000;
}

/** A neutron star's radius, km: 11.9 ± 1.4 for both of GW170817's (Abbott et al. 2018). */
export const NEUTRON_STAR_KM = 11.9;

/** GW150914's black holes, as drawn since #832: horizons as their masses, 0.0028 sheet units per
 * Sun's mass, where the two start 0.6 apart; not to that scale (their horizons would be smaller). */
const BLACK_HOLE_SHARE = 0.0028 / 0.6;

const GW170817_APART = separationKm(1.46 + 1.27, GW170817_MODEL.from);

export const WAVE_EVENTS: Readonly<Record<Wave, WaveEvent>> = {
  gw150914: {
    id: 'gw150914',
    title: 'GW150914: space stretched by a passing wave',
    name: 'GW150914',
    card: GW150914_CARD,
    why: 'gravitationalWaves',
    chapters: ['source', 'journey', 'space', 'detector'],
    about: {
      source:
        'Where it came from: two black holes, 36 and 29 times the Sun’s mass, orbiting ever faster until they merge into one of 62. The sheet is the plane of their orbit; the wave they send out spirals through it, two-armed, tighter as they speed up, weaker farther out. Heights show the strain the wave carries, not a dent in space. Near the black holes the wave cannot be worked out this way, and the sheet fades out: that part is not to scale.',
      journey:
        'The wave crossed 1.3 billion light-years at the speed of light, set out when life on Earth was still almost all single cells. Told here in seconds, then 100 times slower as it sweeps over Earth on 14 September 2015: so far from its source it is a plane wave, flat wavefronts a wavelength apart (about 3,000 km at 100 Hz), so several crests cross Earth at once. Space, the points about Earth, and Earth itself are stretched across its path and squeezed the other way, 4 × 10²⁰ times more than they were: Earth’s width truly changed by about 10⁻¹⁴ m, some eight protons across, and being solid it gave even less. Livingston (blue) heard it first, Hanford (red) 6.9 ms later. Two detectors cannot say where in the sky it came from, only a wide band of the southern sky; the way drawn is one that fits.',
      space:
        'A ring of free masses, as a gravitational wave from two black holes merging 1.3 billion light-years away comes through it toward you. Space itself stretches one way and squeezes the other, then the other way round, faster and harder as the black holes spiral together, and rings as the one they make settles. Behind the ring, the space the wave has already crossed.',
      detector:
        'LIGO Livingston, Louisiana (30.56° N, 90.77° W), seen from above, north at the top: two arms 4 km long at right angles, laser light running along each to a mirror and back. The wave stretched one arm as it shrank the other, by the strain the detector measured; where the two beams meet again, the light, held dark while the arms are equal, brightens as they differ. LIGO Hanford, Washington (46.46° N, 119.41° W), heard it 6.9 ms later.',
    },
    scaleNote:
      'Stretched 4 × 10²⁰ times and slowed 100 times, to be seen. Over LIGO’s 4 km arms the real change was 4 × 10⁻¹⁸ m, a four-hundredth of a proton’s width.',
    sound: { raised: 4, note: 'Slowed 10 times and raised two octaves, to be heard.' },
    bodies: {
      kind: 'black holes',
      masses: { first: 36, second: 29, final: 62 },
      sizes: {
        first: 36 * BLACK_HOLE_SHARE,
        second: 29 * BLACK_HOLE_SHARE,
        final: 62 * BLACK_HOLE_SHARE,
      },
    },
    origin: { kind: 'measured', file: 'gw150914.json' },
  },
  gw170817: {
    id: 'gw170817',
    title: 'GW170817: two neutron stars merge',
    name: 'GW170817',
    card: GW170817_CARD,
    why: 'neutronStarMerger',
    chapters: ['source', 'space', 'detector', 'kilonova'],
    about: {
      source:
        'Where it came from: two neutron stars, about 1.5 and 1.3 times the Sun’s mass, each only some 24 km across: the collapsed cores of massive stars, as dense as an atom’s nucleus. Shown here are their last fifth of a second, of some 100 s the detectors heard: they go round each other hundreds of times a second, ever faster and closer, each pulled out of round by the other, until they touch and merge. The sheet is the plane of their orbit; the wave they send out spirals through it. Heights show the strain the wave carries, not a dent in space. The stars are drawn at their true size against their distance apart, not to the sheet’s scale, and near them the wave cannot be worked out this way: the sheet fades out there.',
      space:
        'A ring of free masses, as the gravitational wave from two neutron stars merging 130 million light-years away comes through it toward you: space stretches one way and squeezes the other, faster and harder as the stars spiral in, then stops, for what came after the merger was not heard. It is drawn at the same stretch as GW150914, and sways about half as much: ten times nearer, but from stars some twenty-five times lighter.',
      detector:
        'LIGO Livingston, Louisiana (30.56° N, 90.77° W), seen from above, north at the top: two arms 4 km long at right angles. The wave stretched one arm as it shrank the other. Quieter than GW150914, it stayed in the detectors’ band far longer, about 100 s and 3,000 cycles from 24 Hz, so it was heard more clearly: Livingston’s signal-to-noise ratio was 26.4, Hanford’s 18.8, and Virgo’s, in Italy, 2.0. At Livingston a brief burst of noise struck 1.1 s before the merger; it was modelled and taken out. The arms here are moved by a model of the wave, not by the measured strain.',
      kilonova:
        'The kilonova, AT 2017gfo: what the merger flung out, glowing as the newly made radioactive nuclei in it decay. As its light is read (Kasen et al. 2017): about 0.025 Suns thrown out toward the poles (blue) at a third of light’s speed, lighter elements whose glow peaked within a day and faded within two; and about 0.04 Suns, slower, about the orbit’s plane (red), rich in lanthanides, heavy elements so opaque that their light came out late, red and infrared, over weeks. Gold and platinum would be made with them, but were not seen; strontium is the one element named in its spectrum. Each point is placed by its speed, so the cloud keeps its shape and is drawn at one size: the clock says how far out it truly is. Each glow is a simple model, drawn against its own peak; the clock runs from an hour to four weeks, faster as it goes.',
    },
    scaleNote:
      'Stretched 4 × 10²⁰ times and slowed 100 times, to be seen, as GW150914. Over LIGO’s 4 km arms the real change, at its largest, was about 2 × 10⁻¹⁸ m, under a thousandth of a proton’s width.',
    sound: {
      raised: 1,
      note: 'Slowed 10 times, at its own pitch: unlike GW150914’s, this chirp was in the range we hear.',
    },
    bodies: {
      kind: 'neutron stars',
      // GWTC-1's medians (Abbott et al. 2019); what they made, less what was given off and flung out.
      masses: { first: 1.46, second: 1.27, final: 2.8 },
      sizes: {
        first: NEUTRON_STAR_KM / GW170817_APART,
        second: NEUTRON_STAR_KM / GW170817_APART,
        // A hot, swollen remnant: not measured, drawn half again as wide.
        final: (1.5 * NEUTRON_STAR_KM) / GW170817_APART,
      },
    },
    // The inspiral ended at 12:41:04.4 UTC (Abbott et al. 2017).
    origin: { kind: 'model', chirp: GW170817_MODEL, atLivingston: 4.4 },
    more: { chapter: 'kilonova', label: 'Gold and platinum', card: HEAVY_ELEMENTS_CARD },
  },
};

/** The chapter a story opens at: the one asked for if it has it, else its source. */
export function openingChapter(event: WaveEvent, asked: WaveChapter): WaveChapter {
  return event.chapters.includes(asked) ? asked : 'source';
}
