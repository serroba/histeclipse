/**
 * What the formation clock says happened, and when (#1218): from the Solar System's first solids,
 * through Earth growing and Theia's strike, to the first ocean and the Moon's crust. Where the
 * studies disagree (how fast Earth grew, how the impact went, how fast the Moon gathered, how long
 * its magma ocean lasted), it says so and cites each side.
 *
 * The phases before the impact are timed from the first solids, so their place on the clock
 * depends on when the impact struck: the reader's choice.
 *
 * Pure.
 */

import { FIRST_SOLIDS_MA } from '../../deepTime/formationClock';
import { phase, type EventPhase } from '../ownTime';

const HOUR = 3600;
const DAY = 86_400;
const YEAR = 365.25 * DAY;
const MYR = 1e6 * YEAR;

/** The phases before the impact, `fromSolids` turning millions of years since the first solids
 * into seconds since the impact. */
function beforeImpact(fromSolids: (myr: number) => number): readonly EventPhase[] {
  return [
    phase(
      'first-solids',
      fromSolids(0),
      'The first solids',
      'Round the young Sun, a disc of gas and dust. The first solids to condense, grains now found in meteorites, are 4,567.3 million years old: the Solar System’s time zero.',
      ['connelly2012'],
    ),
    phase(
      'planetesimals',
      fromSolids(0.1),
      'Dust to planetesimals',
      'Dust sticks into pebbles, and pebbles gather into planetesimals, kilometres to hundreds of kilometres across. Within about a million years Jupiter’s core has grown, and keeps the disc’s inner part, where Earth forms, apart from its outer part.',
      ['kruijer2017'],
    ),
    phase(
      'embryos',
      fromSolids(1),
      'Embryos',
      'Planetesimals merge into embryos the size of the Moon or Mars. Mars itself reaches half its size within about two million years: an embryo that never grew into a full planet.',
      ['dauphas2011'],
    ),
    phase(
      'earth-grows',
      fromSolids(2),
      'Earth grows: how fast is argued',
      'Fast: Earth sweeps up pebbles drifting through the gas, and has most of its mass within a few million years (Johansen et al.; Schiller et al., from calcium isotopes). Slow: embryos collide in giant impacts over tens of millions of years (Chambers & Wetherill), as the tungsten isotopes of Earth’s core suggest (Kleine et al.).',
      ['johansen2021', 'schiller2018', 'chambersWetherill1998', 'kleine2009'],
    ),
    phase(
      'gas-gone',
      fromSolids(4),
      'The gas is gone',
      'The magnetism the disc’s gas left in meteorites says the gas had gone within about four million years. Whatever Earth had not gathered by then, it gathers by collisions.',
      ['wang2017'],
    ),
  ];
}

/** Theia coming in, the impact, and after: timed from the impact. */
const FROM_IMPACT: readonly EventPhase[] = [
  phase(
    'theia',
    -6 * HOUR,
    'Theia comes in',
    'A body about the size of Mars, Theia, comes in on a grazing path. When is argued: 4,510 million years ago, from the Moon’s oldest zircons (Barboni et al.), or nearer 4,350 million, from many lunar rocks (Borg & Carlson). The clock follows the date chosen on the rail.',
    ['canup2001', 'barboni2017', 'borg2023'],
  ),
  phase(
    'impact',
    0,
    'The giant impact: how it went is argued',
    'In the canonical case, Theia strikes a glancing blow; its core sinks into Earth’s, and molten and vaporised rock is thrown into orbit (Canup & Asphaug). The Moon’s isotopes match Earth’s too closely for that, so others are argued: a fast-spinning Earth (Ćuk & Stewart), two half-Earths (Canup), a vaporised, doughnut-shaped synestia (Lock et al.), or many smaller hits (Rufu et al.).',
    ['canup2001', 'zhang2012', 'cuk2012', 'canup2012', 'lock2018', 'rufu2017'],
  ),
  phase(
    'disc',
    2 * HOUR,
    'A disc of debris',
    'What stays in orbit settles into a disc of molten and vaporised rock within a few Earth radii, inside the distance where Earth’s tides would pull a moon apart. Earth spins in about five hours. Some of Theia may still lie at the base of Earth’s mantle, as its two large low-velocity provinces (Yuan et al.).',
    ['canup2004', 'yuan2023'],
  ),
  phase(
    'moon-gathers',
    DAY,
    'The Moon gathers: how fast is argued',
    'Within hours, thrown straight into orbit (Kegerreis et al.); over a month to a year, from the disc (Ida, Canup & Stewart); or over about a century, as the disc inside the tidal limit spreads out (Salmon & Canup). It forms close, a few Earth radii away, so it fills many times as much of the sky as today, and moves outward as its tides slow Earth’s spin.',
    ['kegerreis2022', 'ida1997', 'salmon2012', 'canup2004'],
  ),
  phase(
    'magma-ocean',
    1000 * YEAR,
    'Earth’s magma ocean, under steam',
    'Earth is molten to a great depth, wrapped in an atmosphere of steam and carbon dioxide that holds the heat in.',
    ['zahnle2007', 'lebrun2013'],
  ),
  phase(
    'first-ocean',
    1.5 * MYR,
    'The first ocean',
    'As the surface cools and solidifies, the steam rains out into an ocean, about a million and a half years after the impact in one model; a hot ocean under thick carbon dioxide.',
    ['lebrun2013', 'zahnle2007'],
  ),
  phase(
    'moon-crust',
    3 * MYR,
    'The Moon’s crust: how long it took is argued',
    'The Moon is molten too. As its magma ocean cools, light rock floats up into the pale crust of its highlands. Mostly solid within about ten million years (Elkins-Tanton et al.), or, under an insulating crust, about two hundred million (Maurice et al.).',
    ['elkinsTanton2011', 'maurice2020'],
  ),
];

/** The phases for an impact at `impactMa`; those before it are timed from the first solids. */
export function formationPhases(impactMa: number): readonly EventPhase[] {
  const before = FIRST_SOLIDS_MA - impactMa;
  return [...beforeImpact((myr) => (myr - before) * MYR), ...FROM_IMPACT];
}
