/**
 * The telescopes' models for their cards (#859, #860, #861, epic #865), by the record's ids: each
 * built from its operator's published sizes (`radioModels.ts`, `opticalModels.ts`,
 * `historicalModels.ts`; those in space, `spaceTelescopeModels.ts`), its caption saying which
 * parts are placed by eye. The same object each time, so a card shown again keeps its view.
 */

import { Vector3 } from 'three';

import { from, lazyModel, type LazyModel, type ModelLoad } from './lazyModel';
import { SPACE_MODELS } from './spaceTelescopeModels';

const radio = () => import('./radioModels');
const optical = () => import('./opticalModels');
const historical = () => import('./historicalModels');

/** The Sun high and to one side, for a model standing on the ground (+Y up, -Z north). */
const DAY = new Vector3(-0.5, 1, -0.6);

function standing(name: string, caption: string, load: ModelLoad): LazyModel {
  return lazyModel(
    `${name} in 3D: drag to turn it, pinch or scroll to zoom`,
    `An approximation built here at true scale: ${caption}`,
    DAY,
    load,
  );
}

const MODELS: Readonly<Record<string, LazyModel>> = {
  ...SPACE_MODELS,
  lovell: standing(
    'The Lovell Telescope',
    'its 76.2 m dish (focal ratio 0.3) on its elevation axis 50.5 m up, turning on its 107.5 m rail, from Jodrell Bank’s facts and figures. Its towers’ shape is placed by eye.',
    from(radio, (m) => m.buildLovell),
  ),
  parkes: standing(
    'Murriyang, the Parkes radio telescope',
    'its 64 m dish (focal ratio 0.41) with its centre 27.4 m up, on its 10.7 m concrete tower, from CSIRO’s users’ guide. The tower’s girth is by eye.',
    from(radio, (m) => m.buildParkes),
  ),
  arecibo: standing(
    'The Arecibo telescope',
    'its 305 m bowl, 51 m deep, set into the ground, and its platform 137 m above it under the Gregorian dome, from Cornell’s figures. Its three towers, their ring and the platform’s size are by eye.',
    from(radio, (m) => m.buildArecibo),
  ),
  fast: standing(
    'FAST',
    'its 500 m bowl, curved to a 315 m radius, and its feed cabin hung on six cables some 140 m above the bowl’s lowest point, from NAOC’s papers. The six towers’ height and place are by eye.',
    from(radio, (m) => m.buildFast),
  ),
  vla: standing(
    'The Very Large Array',
    'its 27 dishes of 25 m, each some 28.7 m tall, on a Y in its most compact configuration, about 1 km across, from NRAO. The dishes’ focal ratio and the pads’ spacing are by eye.',
    from(radio, (m) => m.buildVla),
  ),
  alma: standing(
    'ALMA',
    'its 66 antennas, 54 of 12 m (14.7 m tall) and 12 of 7 m, in a compact configuration some 300 m across, from ESO and NRAO. Where each antenna stands and the 7 m antennas’ height are by eye.',
    from(radio, (m) => m.buildAlma),
  ),
  'ska-mid': standing(
    'SKA-Mid',
    'seven of its 133 offset dishes of 15 m, each over 22 m tall, from SKAO; with MeerKAT’s 64 they spread over 150 km. Their spacing and focal ratio are by eye.',
    from(radio, (m) => m.buildSkaMid),
  ),
  'ska-low': standing(
    'SKA-Low',
    'one of its 512 stations, 256 antennas each 2 m tall, from SKAO; the whole array spreads over 74 km. The station’s width and the antennas’ shape are by eye.',
    from(radio, (m) => m.buildSkaLow),
  ),
  hale: standing(
    'The Hale Telescope',
    'its 5.1 m mirror at prime focus 16.76 m in its open truss, on its yoke with the horseshoe bearing at its north end, tilted to Palomar’s latitude, in its dome 42 m across and 41 m tall, from Caltech’s Palomar pages, cut away to show it. The yoke’s and the horseshoe’s size are by eye.',
    from(historical, (m) => m.buildHale),
  ),
  hooker: standing(
    'The Hooker Telescope',
    'its 2.57 m mirror 12.8 m from its plate in its 3.35 m tube, on its closed yoke tilted to Mount Wilson’s latitude, on its 10 m pier on a base 13.7 m by 6.1 m, in its 30.5 m dome, from Mount Wilson Observatory, cut away to show it. The yoke’s size and the dome’s height are by eye.',
    from(historical, (m) => m.buildHooker),
  ),
  yerkes: standing(
    'The Yerkes refractor',
    'its 40-inch lens on a tube 18.3 m long, wider in the middle than at its ends, on its German mount: a column 13.1 m tall, the polar axis 4.1 m and the declination axis 3.5 m, in its dome 27.4 m across, from George Ellery Hale’s description of 1897, cut away to show it. The walls under the dome are by eye.',
    from(historical, (m) => m.buildYerkes),
  ),
  'herschel-forty-foot': standing(
    'Herschel’s 40-foot telescope',
    'its 1.22 m mirror at the foot of its iron tube 12.2 m long and some 1.47 m across, from Royal Museums Greenwich and the Science Museum Group. No size of its timber frame, its ropes or its turning base survives in their records: those are by eye.',
    from(historical, (m) => m.buildHerschel),
  ),
  leviathan: standing(
    'The Leviathan of Parsonstown',
    'its 1.83 m mirror in a tube 1.8 m across and some 16 m long (Birr Castle gives 15 m, 16.5 m and, overall, 22 m), slung between masonry walls 21.4 m long and 15.2 m tall, pointing south, from Birr Castle and C. G. Lyons of Trinity College Dublin. The walls’ thickness and the gap between them are by eye.',
    from(historical, (m) => m.buildLeviathan),
  ),
  keck: standing(
    'The Keck telescopes',
    'the twins 85 m apart, Keck II to the north-east, each mirror 36 hexagons 1.8 m across, 10.95 m at most, focal length 17.5 m, from the W. M. Keck Observatory, the domes cut away to show them. The domes, the mounts and the tubes are by eye.',
    from(optical, (m) => m.buildKeck),
  ),
  subaru: standing(
    'The Subaru Telescope',
    'its 8.2 m mirror of focal length 15 m, in its structure 22.2 m tall and 27.2 m wide, in its cylindrical enclosure 43 m tall and 40 m across, from NAOJ, cut away to show it. The mount’s parts are by eye.',
    from(optical, (m) => m.buildSubaru),
  ),
  vlt: standing(
    'The Very Large Telescope',
    'its four 8.2 m Unit Telescopes in their enclosures 29 m across and 28.5 m tall, where ESO’s station table puts them, and four of its 1.82 m Auxiliary Telescopes in their 3.9 m shells, from ESO. The Unit Telescopes’ structure and where the Auxiliary Telescopes stand are by eye.',
    from(optical, (m) => m.buildVlt),
  ),
  gtc: standing(
    'The Gran Telescopio Canarias',
    'its 36 hexagons 1.9 m across, 10.4 m as one mirror, in its dome 35 m across and 24 m tall on a building 41 m tall in all, from the IAC, cut away to show it. The mount, the tube and the building’s width are by eye.',
    from(optical, (m) => m.buildGtc),
  ),
  rubin: standing(
    'The Vera C. Rubin Observatory',
    'its 8.4 m mirror with its 5 m hole, the tertiary in its middle, on a 15 m pier in a 30 m dome, from the Rubin Observatory and Ivezić et al. (2019), cut away to show it. The mount, the building round the pier and the dome’s height are by eye.',
    from(optical, (m) => m.buildRubin),
  ),
  elt: standing(
    'The Extremely Large Telescope',
    'its 39 m mirror of 798 hexagons 1.45 m across, its secondary 60 m up when it looks straight up, its two 30 m by 15 m platforms, in its dome 93 m across and 80 m tall, from ESO, cut away to show it. The truss and the arms’ shape are by eye.',
    from(optical, (m) => m.buildElt),
  ),
};

/** A telescope's model, by its id in the record, if it has one yet. */
export function telescopeModel(id: string): LazyModel | undefined {
  return MODELS[id];
}
