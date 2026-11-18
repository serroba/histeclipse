/**
 * The ground telescopes' entries in the catalogue (#859, #860, #873): each standing on the
 * ground, +Y up, +X east and −Z north, built in its family's chunk (`radioModels.ts`,
 * `opticalModels.ts`, `historicalModels.ts`).
 */

import { from, type GroundEntry } from './catalogueEntry';

const radio = () => import('./radioModels');
const optical = () => import('./opticalModels');
const historical = () => import('./historicalModels');

export const GROUND_CATALOGUE: readonly GroundEntry[] = [
  {
    kind: 'ground',
    id: 'lovell',
    name: 'The Lovell Telescope',
    caption:
      'its 76.2 m dish (focal ratio 0.3) on its elevation axis 50.5 m up, turning on its 107.5 m rail, from Jodrell Bank’s facts and figures. Its towers’ shape is placed by eye.',
    build: from(radio, (m) => m.buildLovell),
  },
  {
    kind: 'ground',
    id: 'parkes',
    name: 'Murriyang, the Parkes radio telescope',
    caption:
      'its 64 m dish (focal ratio 0.41) with its centre 27.4 m up, on its 10.7 m concrete tower, from CSIRO’s users’ guide. The tower’s girth is by eye.',
    build: from(radio, (m) => m.buildParkes),
  },
  {
    kind: 'ground',
    id: 'arecibo',
    name: 'The Arecibo telescope',
    caption:
      'its 305 m bowl, 51 m deep, set into the ground, and its platform 137 m above it under the Gregorian dome, from Cornell’s figures. Its three towers, their ring and the platform’s size are by eye.',
    build: from(radio, (m) => m.buildArecibo),
  },
  {
    kind: 'ground',
    id: 'fast',
    name: 'FAST',
    caption:
      'its 500 m bowl, curved to a 315 m radius, and its feed cabin hung on six cables some 140 m above the bowl’s lowest point, from NAOC’s papers. The six towers’ height and place are by eye.',
    build: from(radio, (m) => m.buildFast),
  },
  {
    kind: 'ground',
    id: 'vla',
    name: 'The Very Large Array',
    caption:
      'its 27 dishes of 25 m, each some 28.7 m tall, on a Y in its most compact configuration, about 1 km across, from NRAO. The dishes’ focal ratio and the pads’ spacing are by eye.',
    build: from(radio, (m) => m.buildVla),
  },
  {
    kind: 'ground',
    id: 'alma',
    name: 'ALMA',
    caption:
      'its 66 antennas, 54 of 12 m (14.7 m tall) and 12 of 7 m, in a compact configuration some 300 m across, from ESO and NRAO. Where each antenna stands and the 7 m antennas’ height are by eye.',
    build: from(radio, (m) => m.buildAlma),
  },
  {
    kind: 'ground',
    id: 'ska-mid',
    name: 'SKA-Mid',
    caption:
      'seven of its 133 offset dishes of 15 m, each over 22 m tall, from SKAO; with MeerKAT’s 64 they spread over 150 km. Their spacing and focal ratio are by eye.',
    build: from(radio, (m) => m.buildSkaMid),
  },
  {
    kind: 'ground',
    id: 'ska-low',
    name: 'SKA-Low',
    caption:
      'one of its 512 stations, 256 antennas each 2 m tall, from SKAO; the whole array spreads over 74 km. The station’s width and the antennas’ shape are by eye.',
    build: from(radio, (m) => m.buildSkaLow),
  },
  {
    kind: 'ground',
    id: 'hale',
    name: 'The Hale Telescope',
    caption:
      'its 5.1 m mirror at prime focus 16.76 m in its open truss, on its yoke with the horseshoe bearing at its north end, tilted to Palomar’s latitude, in its dome 42 m across and 41 m tall, from Caltech’s Palomar pages, cut away to show it. The yoke’s and the horseshoe’s size are by eye.',
    build: from(historical, (m) => m.buildHale),
  },
  {
    kind: 'ground',
    id: 'hooker',
    name: 'The Hooker Telescope',
    caption:
      'its 2.57 m mirror 12.8 m from its plate in its 3.35 m tube, on its closed yoke tilted to Mount Wilson’s latitude, on its 10 m pier on a base 13.7 m by 6.1 m, in its 30.5 m dome, from Mount Wilson Observatory, cut away to show it. The yoke’s size and the dome’s height are by eye.',
    build: from(historical, (m) => m.buildHooker),
  },
  {
    kind: 'ground',
    id: 'yerkes',
    name: 'The Yerkes refractor',
    caption:
      'its 40-inch lens on a tube 18.3 m long, wider in the middle than at its ends, on its German mount: a column 13.1 m tall, the polar axis 4.1 m and the declination axis 3.5 m, in its dome 27.4 m across, from George Ellery Hale’s description of 1897, cut away to show it. The walls under the dome are by eye.',
    build: from(historical, (m) => m.buildYerkes),
  },
  {
    kind: 'ground',
    id: 'herschel-forty-foot',
    name: 'Herschel’s 40-foot telescope',
    caption:
      'its 1.22 m mirror at the foot of its iron tube 12.2 m long and some 1.47 m across, from Royal Museums Greenwich and the Science Museum Group. No size of its timber frame, its ropes or its turning base survives in their records: those are by eye.',
    build: from(historical, (m) => m.buildHerschel),
  },
  {
    kind: 'ground',
    id: 'leviathan',
    name: 'The Leviathan of Parsonstown',
    caption:
      'its 1.83 m mirror in a tube 1.8 m across and some 16 m long (Birr Castle gives 15 m, 16.5 m and, overall, 22 m), slung between masonry walls 21.4 m long and 15.2 m tall, pointing south, from Birr Castle and C. G. Lyons of Trinity College Dublin. The walls’ thickness and the gap between them are by eye.',
    build: from(historical, (m) => m.buildLeviathan),
  },
  {
    kind: 'ground',
    id: 'keck',
    name: 'The Keck telescopes',
    caption:
      'the twins 85 m apart, Keck II to the north-east, each mirror 36 hexagons 1.8 m across, 10.95 m at most, focal length 17.5 m, from the W. M. Keck Observatory, the domes cut away to show them. The domes, the mounts and the tubes are by eye.',
    build: from(optical, (m) => m.buildKeck),
  },
  {
    kind: 'ground',
    id: 'subaru',
    name: 'The Subaru Telescope',
    caption:
      'its 8.2 m mirror of focal length 15 m, in its structure 22.2 m tall and 27.2 m wide, in its cylindrical enclosure 43 m tall and 40 m across, from NAOJ, cut away to show it. The mount’s parts are by eye.',
    build: from(optical, (m) => m.buildSubaru),
  },
  {
    kind: 'ground',
    id: 'vlt',
    name: 'The Very Large Telescope',
    caption:
      'its four 8.2 m Unit Telescopes in their enclosures 29 m across and 28.5 m tall, where ESO’s station table puts them, and four of its 1.82 m Auxiliary Telescopes in their 3.9 m shells, from ESO. The Unit Telescopes’ structure and where the Auxiliary Telescopes stand are by eye.',
    build: from(optical, (m) => m.buildVlt),
  },
  {
    kind: 'ground',
    id: 'gtc',
    name: 'The Gran Telescopio Canarias',
    caption:
      'its 36 hexagons 1.9 m across, 10.4 m as one mirror, in its dome 35 m across and 24 m tall on a building 41 m tall in all, from the IAC, cut away to show it. The mount, the tube and the building’s width are by eye.',
    build: from(optical, (m) => m.buildGtc),
  },
  {
    kind: 'ground',
    id: 'rubin',
    name: 'The Vera C. Rubin Observatory',
    caption:
      'its 8.4 m mirror with its 5 m hole, the tertiary in its middle, on a 15 m pier in a 30 m dome, from the Rubin Observatory and Ivezić et al. (2019), cut away to show it. The mount, the building round the pier and the dome’s height are by eye.',
    build: from(optical, (m) => m.buildRubin),
  },
  {
    kind: 'ground',
    id: 'elt',
    name: 'The Extremely Large Telescope',
    caption:
      'its 39 m mirror of 798 hexagons 1.45 m across, its secondary 60 m up when it looks straight up, its two 30 m by 15 m platforms, in its dome 93 m across and 80 m tall, from ESO, cut away to show it. The truss and the arms’ shape are by eye.',
    build: from(optical, (m) => m.buildElt),
  },
];
