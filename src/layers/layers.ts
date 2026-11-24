/**
 * Every layer the reader can lay over the globe (#380), each described in a file of its own
 * here. Adding one: its file, then a line in `ALL` and a line in its group below; how it is
 * drawn is a feature in `src/features`.
 */

import { air } from './air';
import { amoc } from './amoc';
import { asteroids } from './asteroids';
import { carbonMade } from './carbonMade';
import { dates } from './dates';
import { eclipses } from './eclipses';
import { extinctions } from './extinctions';
import { empires } from './empires';
import { enso } from './enso';
import { fossils } from './fossils';
import { genomes } from './genomes';
import { humans } from './humans';
import { impacts } from './impacts';
import { oceanCurrents } from './oceanCurrents';
import { oceanHeat } from './oceanHeat';
import { oceanTemp } from './oceanTemp';
import { orbits } from './orbits';
import { ozone } from './ozone';
import { periods } from './periods';
import { plates } from './plates';
import { radiocarbon } from './radiocarbon';
import { rocks } from './rocks';
import { sealevel } from './sealevel';
import { spacecraft } from './spacecraft';
import { telescopes } from './telescopes';
import { temperature } from './temperature';
import { volcanoes } from './volcanoes';
import { warming } from './warming';
import { ways } from './ways';
import type { LayerEntry } from './layer';

export { CARBON_LIMIT } from './carbonMade';
export type { Coverage } from './layer';

/** Every layer, in the order a link and the chips beside Layers list them. */
const ALL = [
  eclipses,
  orbits,
  spacecraft,
  asteroids,
  telescopes,
  empires,
  genomes,
  ways,
  rocks,
  periods,
  dates,
  impacts,
  extinctions,
  volcanoes,
  ozone,
  warming,
  oceanHeat,
  oceanTemp,
  enso,
  amoc,
  oceanCurrents,
  temperature,
  sealevel,
  plates,
  humans,
  air,
  radiocarbon,
  carbonMade,
  fossils,
] as const;

export type Layer = (typeof ALL)[number]['id'];

/** A layer as the Layers panel offers it. */
export type LayerChoice = LayerEntry<Layer>;

export const LAYERS: readonly Layer[] = ALL.map((entry) => entry.id);

const ENTRIES: ReadonlyMap<Layer, LayerChoice> = new Map(ALL.map((entry) => [entry.id, entry]));

/** A layer's description. */
export function layerEntry(id: Layer): LayerChoice {
  const entry = ENTRIES.get(id);
  if (entry === undefined) throw new Error(`no layer ${id}`);
  return entry;
}

export interface LayerGroup {
  readonly name: string;
  readonly layers: readonly LayerChoice[];
}

/**
 * The Layers panel: one set for all of time, grouped by what they show, in Explore's order of
 * topics (space, earth, life, people, climate): eclipses, the site's own subject, first (#949).
 */
export const LAYER_GROUPS: readonly LayerGroup[] = [
  { name: 'Space', layers: [eclipses, orbits, spacecraft, asteroids, telescopes] },
  { name: 'Earth', layers: [rocks, plates, impacts, volcanoes] },
  { name: 'Life', layers: [fossils, extinctions] },
  { name: 'People', layers: [empires, ways, periods, dates, genomes, humans] },
  {
    name: 'Climate',
    layers: [
      ozone,
      warming,
      oceanHeat,
      oceanTemp,
      enso,
      amoc,
      oceanCurrents,
      temperature,
      sealevel,
      air,
      radiocarbon,
      carbonMade,
    ],
  },
];
