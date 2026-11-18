/**
 * The space telescopes' entries in the catalogue (#861-#863, #873): each in its own axes, the Sun
 * where the craft keeps it, built in its family's chunk (`lightModels.ts`, `xrayModels.ts`; Webb
 * and Hubble have their own).
 */

import { Vector3 } from 'three';

import { from, type SpaceEntry } from './catalogueEntry';

/** The Sun straight below: as the scene draws every craft. */
const DOWN = new Vector3(0, -1, 0);
/** The Sun below, where a spinning craft keeps its solar disc to it. */
const BELOW = DOWN;
/** The Sun to one side, where a craft keeps its solar array or its shade. */
const SIDE = new Vector3(1, -0.1, 0.2);
/** The Sun square to its solar wings, which turn to follow it. */
const WINGS = new Vector3(0.2, 0.3, 1);

const light = () => import('./lightModels');
const xray = () => import('./xrayModels');

export const SPACE_CATALOGUE: readonly SpaceEntry[] = [
  {
    kind: 'space',
    id: 'webb',
    name: 'The James Webb Space Telescope',
    opening: 'An approximation built here from NASA’s published sizes, at true scale:',
    caption:
      'the 6.5 m mirror of 18 gold segments and its secondary on three struts, above the 21 m by 14 m sunshield of five layers. The Sun is below, where the sunshield always faces it; in space the mirror is always in shade, so a light from your side shows it.',
    sun: new Vector3(0.25, -1, 0.15),
    // Built about its middle with the Sun below already, as the scene has drawn it (#796); the
    // card lights it a little aside, to show its shape.
    sceneSun: DOWN,
    centred: true,
    build: from(
      () => import('./webbModel'),
      (m) => m.buildWebb,
    ),
    craft: 'D01093',
    // Half the sunshield's 21.197 m.
    radius: 10.5985,
    about: 'earth',
    pointing:
      'Drawn with its sunshield to the Sun, as it always is, and its mirror turned toward the celestial north: a convention, as where it looks at a given moment is not known here',
  },
  {
    kind: 'space',
    id: 'hubble',
    name: 'The Hubble Space Telescope',
    opening: 'An approximation built here from ESA/Hubble’s published sizes, at true scale:',
    caption:
      '13.2 m long and 4.2 m across, its 2.4 m mirror inside, its two solar arrays each 2.45 m by 7.56 m, its two antennas, and its aperture door open. The Sun is below, square to the arrays; a light from your side shows the side it does not reach.',
    sun: new Vector3(0.2, -1, 0.1),
    sceneSun: DOWN,
    centred: true,
    build: from(
      () => import('./hubbleModel'),
      (m) => m.buildHubble,
    ),
    craft: 'S20580',
    // Half its 13.2 m length.
    radius: 6.6,
    about: 'earth',
    pointing:
      'Drawn with its solar arrays square to the Sun and its aperture turned toward the celestial north, square to the Sun’s line: a convention, as where it is looking at a given moment is not known here; it is never pointed near the Sun',
  },
  {
    kind: 'space',
    id: 'planck',
    name: 'Planck',
    caption:
      '4.2 m tall and 4.2 m across its solar disc, which always faces the Sun (below), its 1.9 m by 1.5 m primary in the open baffle at its top, from ESA. The service module, the three V-groove shields and the baffle are given only by their area: their shapes are by eye.',
    sun: BELOW,
    build: from(light, (m) => m.buildPlanck),
    craft: 'D00880',
    radius: 2.1,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'wmap',
    name: 'WMAP',
    caption:
      '3.8 m tall on its 5.0 m sun shield of six solar panels, always to the Sun (below), its 1 m cylinder, and its two 1.4 m by 1.6 m primaries back to back with their 0.9 m by 1.0 m secondaries, from NASA (another NASA paper gives 3.6 m and 5.1 m). The hub and the radiators are by eye.',
    sun: BELOW,
    build: from(light, (m) => m.buildWmap),
    craft: 'D00778',
    radius: 2.5,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'gaia',
    name: 'Gaia',
    caption:
      'its 10.2 m sunshield of twelve frames, eight with solar cells, the Sun 45° off its spin axis, from ESA. No official page gives its height: the service module and the tent round its 3 m optical bench are by eye.',
    sun: new Vector3(0.71, -0.71, 0),
    build: from(light, (m) => m.buildGaia),
    craft: 'D00937',
    radius: 5.1,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'kepler',
    name: 'Kepler',
    caption:
      '4.7 m tall and 2.7 m across, its 0.95 m aperture over a 1.4 m primary at the foot of its tube, its bus round that, its fixed solar array of four panels on one side, to the Sun, shading the tube, from NASA. The tube’s width and the panels’ size are by eye.',
    sun: SIDE,
    build: from(light, (m) => m.buildKepler),
    craft: 'D00874',
    radius: 2.35,
    about: 'sun',
  },
  {
    kind: 'space',
    id: 'spitzer',
    name: 'The Spitzer Space Telescope',
    caption:
      '4.5 m tall and 2.1 m across, its octagonal bus below its cryogenic telescope of 0.85 m, its flat solar array up one side, always to the Sun, from NASA/JPL. The bus’s height and the array’s size are by eye.',
    sun: SIDE,
    build: from(light, (m) => m.buildSpitzer),
    craft: 'D00824',
    radius: 2.25,
    about: 'sun',
  },
  {
    kind: 'space',
    id: 'cobe',
    name: 'COBE',
    caption:
      '5.49 m long and 2.44 m across as launched, 8.53 m across its three solar panels once out, its instruments inside a conical shield opening away from the Sun and Earth, the Sun to its side, from NASA (another NASA page gives 16 ft, some 4.9 m). The shield’s size is by eye.',
    sun: new Vector3(1, -0.07, 0),
    build: from(light, (m) => m.buildCobe),
    craft: 'S20322',
    radius: 4.27,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'herschel-space',
    name: 'The Herschel Space Observatory',
    caption:
      '7.5 m tall and 4 m by 4 m (ESA; a paper gives 7.4 m), its 3.5 m primary and 0.3 m secondary on top of its cryostat, its sunshade with its solar cells on the Sun’s side. The cryostat’s and the sunshade’s size are by eye.',
    sun: SIDE,
    build: from(light, (m) => m.buildHerschelSpace),
    craft: 'D00879',
    radius: 3.75,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'tess',
    name: 'TESS',
    caption:
      'its four cameras of 10.5 cm in a column on their plate, its 0.7 m dish and its two solar wings, from NASA and MIT. No official page gives the craft’s size: the bus, the hoods, the wings and where the Sun is are by eye.',
    sun: new Vector3(0.3, -1, 0.2),
    build: from(light, (m) => m.buildTess),
    craft: 'D00995',
    radius: 1.75,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'iras',
    name: 'IRAS',
    caption:
      '3.6 m tall, 3.24 m wide and 2.05 m deep with its solar panels out, its 60 cm telescope in the cylinder above its box, its sunshade at the top on the Sun’s side, from NASA, JPL and IPAC. How that height is shared between the parts is by eye.',
    sun: new Vector3(1, 0.3, 0),
    build: from(light, (m) => m.buildIras),
    craft: 'S13777',
    radius: 1.8,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'hipparcos',
    name: 'Hipparcos',
    caption:
      'its 29 cm Schmidt telescope inside its shade on top, its three solar panels of 1.69 m by 1.19 m 120° apart about its base, the Sun 43° off its spin axis, from ESA. Its body is given only in drawings: by eye.',
    sun: new Vector3(0.68, -0.73, 0),
    build: from(light, (m) => m.buildHipparcos),
    craft: 'S20169',
    radius: 2.6,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'euclid',
    name: 'Euclid',
    caption:
      '4.5 m tall and 3.1 m across (ESA; its mission paper gives an envelope of 3.74 m by 4.8 m), its 1.2 m telescope above its service module, the sunshield with its solar cells up one side to the Sun, its 70 cm dish. The parts are by eye.',
    sun: SIDE,
    build: from(light, (m) => m.buildEuclid),
    craft: 'D01123',
    radius: 2.25,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'chandra',
    name: 'The Chandra X-ray Observatory',
    caption:
      '13.8 m long and 19.5 m across its solar arrays, its 1.2 m mirror assembly of four nested pairs in its spacecraft module, its 10 m optical bench back to its instruments, its sunshade door open at the front, from NASA and the Chandra X-ray Center. The bench’s and the module’s girth and the arrays’ width are by eye.',
    sun: WINGS,
    build: from(xray, (m) => m.buildChandra),
    craft: 'S25867',
    radius: 9.75,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'xmm-newton',
    name: 'XMM-Newton',
    caption:
      '10 m long and 16 m across its solar arrays, its three mirror modules and the 2 m Optical Monitor on its service module, its 6.8 m tube to its cameras, from ESA. The girths, and the mirror modules’ size, which no official page gives, are by eye.',
    sun: WINGS,
    build: from(xray, (m) => m.buildXmm),
    craft: 'S25989',
    radius: 8,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'fermi',
    name: 'The Fermi Gamma-ray Space Telescope',
    caption:
      '2.8 m tall and 2.5 m across as launched, 15 m wide with its arrays out, its Large Area Telescope, 1.8 m square, on top of its bus looking up, its burst monitor’s 12.7 cm detectors round it, from NASA (the LAT is 0.72 m deep in its paper, 1 m in the handbook). The bus’s height and the arrays’ width are by eye.',
    sun: WINGS,
    build: from(xray, (m) => m.buildFermi),
    craft: 'S33053',
    radius: 7.5,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'compton',
    name: 'The Compton Gamma Ray Observatory',
    caption:
      'its 9 m by 4.5 m body with EGRET (2.25 m tall, 1.65 m across) and COMPTEL (2.61 m tall, 1.76 m across), OSSE’s four detectors and BATSE’s eight at its corners, 21.3 m across its solar arrays, its 1.52 m dish on a 4.4 m boom, from NASA (another NASA page gives 9.1 m by 4.6 m). The body’s depth and OSSE’s mount are by eye.',
    sun: WINGS,
    build: from(xray, (m) => m.buildCompton),
    craft: 'S21225',
    radius: 10.65,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'swift',
    name: 'Swift',
    caption:
      'BAT’s coded mask of some 2.7 m² held 1 m above its 1.2 m by 0.6 m detector plane, beside the X-ray telescope and the 30 cm UVOT, from NASA. No official page gives the craft’s size: the bus, the tubes and the solar arrays are by eye.',
    sun: WINGS,
    build: from(xray, (m) => m.buildSwift),
    craft: 'S28485',
    radius: 2.5,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'nustar',
    name: 'NuSTAR',
    caption:
      'its two optics, each 38 cm across, 10.14 m from its detectors on a mast of 57 bays, from Caltech and NASA (its press kit gives 10.9 m and 11.4 m for the whole). The bus’s and the solar array’s size are by eye.',
    sun: WINGS,
    build: from(xray, (m) => m.buildNustar),
    craft: 'S38358',
    radius: 5.5,
    about: 'earth',
  },
  {
    kind: 'space',
    id: 'spektr-rg',
    name: 'Spektr-RG',
    caption:
      'eROSITA (1.9 m across, 3.2 m tall, seven mirror modules) and ART-XC (0.9 m across, 3.5 m tall) side by side on their frame atop the Navigator platform, both looking the same way, from IKI and MPE. No official page sizes the platform, the frame or the solar panels: by eye.',
    sun: WINGS,
    build: from(xray, (m) => m.buildSpektrRg),
    craft: 'D01021',
    radius: 2.6,
    about: 'earth',
  },
];
