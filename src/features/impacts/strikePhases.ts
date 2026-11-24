/**
 * What the strike clock says happened, and when (#1173): Chicxulub's phases from the impactor
 * coming in to the recovery a million years on, each from the time its studies place it, with
 * those studies. Where they disagree, it says so and cites both.
 *
 * Pure.
 */

import { SOURCES, type SourceId } from '../../sources/registry';

export interface StrikePhase {
  readonly id: string;
  /** Seconds after the strike it begins (negative: before). */
  readonly from: number;
  readonly title: string;
  readonly text: string;
  readonly sources: readonly { readonly name: string; readonly url: string }[];
}

/** The phase showing at `seconds` since the strike: the last to have begun by then. */
export function phaseAt(phases: readonly StrikePhase[], seconds: number): StrikePhase | undefined {
  let found: StrikePhase | undefined;
  for (const phase of phases) if (phase.from <= seconds) found = phase;
  return found;
}

/** A phase, its sources looked up in the registry. */
function phase(
  id: string,
  from: number,
  title: string,
  text: string,
  sources: readonly SourceId[],
): StrikePhase {
  return {
    id,
    from,
    title,
    text,
    sources: sources.map((source) => ({ name: SOURCES[source].name, url: SOURCES[source].url })),
  };
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const YEAR = 365.25 * DAY;

/**
 * Chicxulub, 66 million years ago (#1173): what its studies say happened, from the impactor
 * coming in to life's recovery a million years on. The disputed say so, with each side.
 */
const CHICXULUB: readonly StrikePhase[] = [
  phase(
    'approach',
    -10,
    'Coming in',
    'An asteroid over ten kilometres across comes in from the north-east, steeply, at tens of kilometres a second, over a shallow sea on the edge of what is now Yucatán.',
    ['collins2020', 'collins2005'],
  ),
  phase(
    'fireball',
    0,
    'A fireball, and a hole in the crust',
    'Within tens of seconds the impact opens a cavity about 100 km wide and some 30 km deep, and throws out a fireball and a plume of vaporised rock.',
    ['gulick2019', 'collins2005'],
  ),
  phase(
    'collapse',
    MINUTE,
    'The crater collapses',
    'Within minutes the rock thrown up at the centre collapses outward into a ring of peaks, and the crater settles about 200 km across.',
    ['morgan2016', 'gulick2019'],
  ),
  phase(
    'sea',
    15 * MINUTE,
    'The sea returns, and a tsunami',
    'The sea rushes back over the peak ring within the hour. A tsunami runs across the Gulf and out into the oceans, scouring sea floors more than 10,000 km away.',
    ['gulick2019', 'range2022'],
  ),
  phase(
    'ejecta',
    HOUR,
    'Ejecta fall round the world',
    'Molten droplets thrown out of the crater fall back all round the Earth, a quarter within two hours, over half within eight, most within three days, heating the upper air as they come in. They leave the boundary layer found on every continent.',
    ['kringDurda2002', 'schulte2010'],
  ),
  phase(
    'fires',
    8 * HOUR,
    'Fires: how far they spread is disputed',
    'Charcoal in the crater shows fires the impact set. Whether the heat lit fires worldwide is argued: yes, it was enough (Robertson et al.); no, the falling droplets shielded the ground (Goldin & Melosh), and live plants mostly would not ignite (Belcher et al.); in between, enough several thousand kilometres downrange (Morgan et al.).',
    ['gulick2019', 'robertson2013', 'goldinMelosh2009', 'belcher2015', 'morgan2013'],
  ),
  phase(
    'acid',
    DAY,
    'Acid rain',
    'Sulfur from the vaporised anhydrite rock of the target turns to sulfuric acid, falling as acid rain within days.',
    ['ohno2014'],
  ),
  phase(
    'darkness',
    2 * 7 * DAY,
    'Darkness',
    'Soot, dust and sulfate spread round the globe and block the sunlight: little or none reaches the surface for over a year, and photosynthesis all but stops for one to two. Which of them mattered most is disputed: soot (Bardeen et al.; Tabor et al.), fine silicate dust (Senel et al.), or sulfate (Brugger et al.).',
    ['bardeen2017', 'tabor2020', 'senel2023', 'brugger2017'],
  ),
  phase(
    'winter',
    YEAR,
    'Impact winter',
    'The continents cool by up to 28 °C and the oceans by up to 11 °C; middle latitudes stay below freezing for years: three to four with soot alone, three to sixteen in a model of the sulfate.',
    ['bardeen2017', 'brugger2017', 'tabor2020'],
  ),
  phase(
    'clearing',
    5 * YEAR,
    'The sky clears',
    'The soot is gone after about five years; the climate takes decades to recover, more than thirty years in the sulfate model.',
    ['bardeen2017', 'brugger2017'],
  ),
  phase(
    'extinction',
    100 * YEAR,
    'A mass extinction',
    'The non-avian dinosaurs, the ammonites and most species of the time are gone. The impact is widely held the main cause (Schulte et al.; Hull et al.). The Deccan Traps were erupting in India too: whether mostly before the impact (Schoene et al.) or after it (Sprain et al.), and how much that added, is argued.',
    ['schulte2010', 'hull2020', 'schoene2019', 'sprain2019'],
  ),
  phase(
    'ocean',
    1000 * YEAR,
    'The oceans',
    'The surface ocean acidified rapidly after the impact, then rebounded sharply. Plankton productivity came back within a few tens of thousands of years; the carrying of carbon to the deep sea took much longer.',
    ['henehan2019'],
  ),
  phase(
    'crater-life',
    10_000 * YEAR,
    'Life at ground zero',
    'In the crater itself, life came back within years, and a thriving ecosystem within 30,000 years: faster than at many places far from it.',
    ['lowery2018'],
  ),
  phase(
    'land',
    100_000 * YEAR,
    'Mammals and plants',
    'On land, the number of mammal species doubles within about 100,000 years; by about 700,000 years larger mammals and the first legumes appear.',
    ['lyson2019'],
  ),
];

/** The craters watched in their own time, by name: their phases. */
const PHASES: Readonly<Record<string, readonly StrikePhase[]>> = { Chicxulub: CHICXULUB };

/** The phases of the crater named `name`, if it is watched in its own time. */
export function strikePhasesOf(name: string): readonly StrikePhase[] | null {
  return PHASES[name] ?? null;
}
