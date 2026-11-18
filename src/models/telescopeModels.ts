/**
 * The telescopes' models for their cards (#859, epic #865), by the record's ids: each built from
 * its operator's published sizes (`radioModels.ts`), its caption saying which parts are placed by
 * eye. The same object each time, so a card shown again keeps its view.
 */

import { Vector3 } from 'three';

import { lazyModel, type LazyModel, type ModelLoad } from './lazyModel';

/** The radio models' builders, by name (`radioModels.ts`). */
type RadioName =
  | 'buildLovell'
  | 'buildParkes'
  | 'buildArecibo'
  | 'buildFast'
  | 'buildVla'
  | 'buildAlma'
  | 'buildSkaMid'
  | 'buildSkaLow';

/** A radio telescope's model, its builder fetched with the view the first time it is shown. */
function radio(name: RadioName): ModelLoad {
  return () =>
    Promise.all([import('./modelView'), import('./radioModels')]).then(([view, models]) => ({
      mountModelView: view.mountModelView,
      build: models[name],
    }));
}

/** The Sun high in the south-west, as for a model standing on the ground (+Y up, +Z north). */
const DAY = new Vector3(-0.5, 1, -0.6);

function standing(name: string, caption: string, build: RadioName): LazyModel {
  return lazyModel(
    `${name} in 3D: drag to turn it, pinch or scroll to zoom`,
    `An approximation built here at true scale: ${caption}`,
    DAY,
    radio(build),
  );
}

const MODELS: Readonly<Record<string, LazyModel>> = {
  lovell: standing(
    'The Lovell Telescope',
    'its 76.2 m dish (focal ratio 0.3) on its elevation axis 50.5 m up, turning on its 107.5 m rail, from Jodrell Bank’s facts and figures. Its towers’ shape is placed by eye.',
    'buildLovell',
  ),
  parkes: standing(
    'Murriyang, the Parkes radio telescope',
    'its 64 m dish (focal ratio 0.41) with its centre 27.4 m up, on its 10.7 m concrete tower, from CSIRO’s users’ guide. The tower’s girth is by eye.',
    'buildParkes',
  ),
  arecibo: standing(
    'The Arecibo telescope',
    'its 305 m bowl, 51 m deep, set into the ground, and its platform 137 m above it under the Gregorian dome, from Cornell’s figures. Its three towers, their ring and the platform’s size are by eye.',
    'buildArecibo',
  ),
  fast: standing(
    'FAST',
    'its 500 m bowl, curved to a 315 m radius, and its feed cabin hung on six cables some 140 m above the bowl’s lowest point, from NAOC’s papers. The six towers’ height and place are by eye.',
    'buildFast',
  ),
  vla: standing(
    'The Very Large Array',
    'its 27 dishes of 25 m, each some 28.7 m tall, on a Y in its most compact configuration, about 1 km across, from NRAO. The dishes’ focal ratio and the pads’ spacing are by eye.',
    'buildVla',
  ),
  alma: standing(
    'ALMA',
    'its 66 antennas, 54 of 12 m (14.7 m tall) and 12 of 7 m, in a compact configuration some 300 m across, from ESO and NRAO. Where each antenna stands and the 7 m antennas’ height are by eye.',
    'buildAlma',
  ),
  'ska-mid': standing(
    'SKA-Mid',
    'seven of its 133 offset dishes of 15 m, each over 22 m tall, from SKAO; with MeerKAT’s 64 they spread over 150 km. Their spacing and focal ratio are by eye.',
    'buildSkaMid',
  ),
  'ska-low': standing(
    'SKA-Low',
    'one of its 512 stations, 256 antennas each 2 m tall, from SKAO; the whole array spreads over 74 km. The station’s width and the antennas’ shape are by eye.',
    'buildSkaLow',
  ),
};

/** A telescope's model, by its id in the record, if it has one yet. */
export function telescopeModel(id: string): LazyModel | undefined {
  return MODELS[id];
}
