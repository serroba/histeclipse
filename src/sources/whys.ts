/**
 * Every why (#906): what a thing on screen shows, which sources it rests on, and how this site
 * used them. Each is content in a file of its own in `whys/`, so changing one edits that file
 * alone; adding one is its file, and a line here.
 *
 * Their order is kept: the passages the search reads (`public/data/passages.json`) are built in
 * it, and the search's vectors are pinned to that file. Add a new why at the end.
 */

import air from './whys/air.json' with { type: 'json' };
import asteroids from './whys/asteroids.json' with { type: 'json' };
import bodies from './whys/bodies.json' with { type: 'json' };
import boundaries from './whys/boundaries.json' with { type: 'json' };
import carbonMade from './whys/carbonMade.json' with { type: 'json' };
import closeUp from './whys/close-up.json' with { type: 'json' };
import dates from './whys/dates.json' with { type: 'json' };
import deepEvidence from './whys/deep-evidence.json' with { type: 'json' };
import deepSurface from './whys/deep-surface.json' with { type: 'json' };
import deltaT from './whys/delta-t.json' with { type: 'json' };
import earth from './whys/earth.json' with { type: 'json' };
import earthFacts from './whys/earth-facts.json' with { type: 'json' };
import eclipses from './whys/eclipses.json' with { type: 'json' };
import empiresCliopatria from './whys/empires-cliopatria.json' with { type: 'json' };
import empiresOhm from './whys/empires-ohm.json' with { type: 'json' };
import amoc from './whys/amoc.json' with { type: 'json' };
import enso from './whys/enso.json' with { type: 'json' };
import fossils from './whys/fossils.json' with { type: 'json' };
import genomes from './whys/genomes.json' with { type: 'json' };
import gravitationalWaves from './whys/gravitationalWaves.json' with { type: 'json' };
import humans from './whys/humans.json' with { type: 'json' };
import iceSurface from './whys/ice-surface.json' with { type: 'json' };
import impacts from './whys/impacts.json' with { type: 'json' };
import lineages from './whys/lineages.json' with { type: 'json' };
import moons from './whys/moons.json' with { type: 'json' };
import oceanHeat from './whys/oceanHeat.json' with { type: 'json' };
import oceanTemp from './whys/oceanTemp.json' with { type: 'json' };
import orbits from './whys/orbits.json' with { type: 'json' };
import ozone from './whys/ozone.json' with { type: 'json' };
import periods from './whys/periods.json' with { type: 'json' };
import plates from './whys/plates.json' with { type: 'json' };
import radiocarbon from './whys/radiocarbon.json' with { type: 'json' };
import rocks from './whys/rocks.json' with { type: 'json' };
import sealevel from './whys/sealevel.json' with { type: 'json' };
import search from './whys/search.json' with { type: 'json' };
import sky from './whys/sky.json' with { type: 'json' };
import spacecraft from './whys/spacecraft.json' with { type: 'json' };
import sun from './whys/sun.json' with { type: 'json' };
import telescopes from './whys/telescopes.json' with { type: 'json' };
import temperature from './whys/temperature.json' with { type: 'json' };
import tree from './whys/tree.json' with { type: 'json' };
import volcanoes from './whys/volcanoes.json' with { type: 'json' };
import warming from './whys/warming.json' with { type: 'json' };
import ways from './whys/ways.json' with { type: 'json' };

export const WHYS_CONTENT = {
  earth,
  moons,
  bodies,
  eclipses,
  sun,
  radiocarbon,
  dates,
  carbonMade,
  'close-up': closeUp,
  sky,
  'empires-cliopatria': empiresCliopatria,
  'empires-ohm': empiresOhm,
  'delta-t': deltaT,
  'earth-facts': earthFacts,
  ways,
  periods,
  genomes,
  rocks,
  impacts,
  volcanoes,
  spacecraft,
  asteroids,
  orbits,
  'deep-surface': deepSurface,
  'deep-evidence': deepEvidence,
  'ice-surface': iceSurface,
  temperature,
  sealevel,
  plates,
  humans,
  air,
  tree,
  fossils,
  lineages,
  search,
  boundaries,
  ozone,
  warming,
  oceanHeat,
  oceanTemp,
  enso,
  amoc,
  gravitationalWaves,
  telescopes,
};
