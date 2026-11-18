/**
 * The space telescopes' models for their cards (#797, #861, epic #865), by the telescopes
 * record's ids: Webb and Hubble (also in their craft's cards, `features/spacecraft`), and those
 * for light, infrared and microwaves (`lightModels.ts`). Each keeps its own axes, the Sun where it
 * is kept from the craft, its caption saying which parts are placed by eye.
 */

import { Vector3 } from 'three';

import { from, lazyModel, type LazyModel, type ModelLoad } from './lazyModel';

const light = () => import('./lightModels');

function inSpace(name: string, caption: string, sun: Vector3, load: ModelLoad): LazyModel {
  return lazyModel(`${name} in 3D: drag to turn it, pinch or scroll to zoom`, caption, sun, load);
}

/** An approximation built at true scale: what such a caption starts with. */
const BUILT = 'An approximation built here at true scale:';

export const WEBB = inSpace(
  'The James Webb Space Telescope',
  'An approximation built here from NASA’s published sizes, at true scale: the 6.5 m mirror of 18 gold segments and its secondary on three struts, above the 21 m by 14 m sunshield of five layers. The Sun is below, where the sunshield always faces it; in space the mirror is always in shade, so a light from your side shows it.',
  new Vector3(0.25, -1, 0.15),
  from(
    () => import('./webbModel'),
    (m) => m.buildWebb,
  ),
);

export const HUBBLE = inSpace(
  'The Hubble Space Telescope',
  'An approximation built here from ESA/Hubble’s published sizes, at true scale: 13.2 m long and 4.2 m across, its 2.4 m mirror inside, its two solar arrays each 2.45 m by 7.56 m, its two antennas, and its aperture door open. The Sun is below, square to the arrays; a light from your side shows the side it does not reach.',
  new Vector3(0.2, -1, 0.1),
  from(
    () => import('./hubbleModel'),
    (m) => m.buildHubble,
  ),
);

/** The Sun below, where a spinning craft keeps its solar disc to it. */
const BELOW = new Vector3(0, -1, 0);
/** The Sun to one side, where a craft keeps its solar array or its shade. */
const SIDE = new Vector3(1, -0.1, 0.2);

export const SPACE_MODELS: Readonly<Record<string, LazyModel>> = {
  webb: WEBB,
  hubble: HUBBLE,
  planck: inSpace(
    'Planck',
    `${BUILT} 4.2 m tall and 4.2 m across its solar disc, which always faces the Sun (below), its 1.9 m by 1.5 m primary in the open baffle at its top, from ESA. The service module, the three V-groove shields and the baffle are given only by their area: their shapes are by eye.`,
    BELOW,
    from(light, (m) => m.buildPlanck),
  ),
  wmap: inSpace(
    'WMAP',
    `${BUILT} 3.8 m tall on its 5.0 m sun shield of six solar panels, always to the Sun (below), its 1 m cylinder, and its two 1.4 m by 1.6 m primaries back to back with their 0.9 m by 1.0 m secondaries, from NASA (another NASA paper gives 3.6 m and 5.1 m). The hub and the radiators are by eye.`,
    BELOW,
    from(light, (m) => m.buildWmap),
  ),
  gaia: inSpace(
    'Gaia',
    `${BUILT} its 10.2 m sunshield of twelve frames, eight with solar cells, the Sun 45° off its spin axis, from ESA. No official page gives its height: the service module and the tent round its 3 m optical bench are by eye.`,
    new Vector3(0.71, -0.71, 0),
    from(light, (m) => m.buildGaia),
  ),
  kepler: inSpace(
    'Kepler',
    `${BUILT} 4.7 m tall and 2.7 m across, its 0.95 m aperture over a 1.4 m primary at the foot of its tube, its bus round that, its fixed solar array of four panels on one side, to the Sun, shading the tube, from NASA. The tube’s width and the panels’ size are by eye.`,
    SIDE,
    from(light, (m) => m.buildKepler),
  ),
  spitzer: inSpace(
    'The Spitzer Space Telescope',
    `${BUILT} 4.5 m tall and 2.1 m across, its octagonal bus below its cryogenic telescope of 0.85 m, its flat solar array up one side, always to the Sun, from NASA/JPL. The bus’s height and the array’s size are by eye.`,
    SIDE,
    from(light, (m) => m.buildSpitzer),
  ),
  cobe: inSpace(
    'COBE',
    `${BUILT} 5.49 m long and 2.44 m across as launched, 8.53 m across its three solar panels once out, its instruments inside a conical shield opening away from the Sun and Earth, the Sun to its side, from NASA (another NASA page gives 16 ft, some 4.9 m). The shield’s size is by eye.`,
    new Vector3(1, -0.07, 0),
    from(light, (m) => m.buildCobe),
  ),
  'herschel-space': inSpace(
    'The Herschel Space Observatory',
    `${BUILT} 7.5 m tall and 4 m by 4 m (ESA; a paper gives 7.4 m), its 3.5 m primary and 0.3 m secondary on top of its cryostat, its sunshade with its solar cells on the Sun’s side. The cryostat’s and the sunshade’s size are by eye.`,
    SIDE,
    from(light, (m) => m.buildHerschelSpace),
  ),
  tess: inSpace(
    'TESS',
    `${BUILT} its four cameras of 10.5 cm in a column on their plate, its 0.7 m dish and its two solar wings, from NASA and MIT. No official page gives the craft’s size: the bus, the hoods, the wings and where the Sun is are by eye.`,
    new Vector3(0.3, -1, 0.2),
    from(light, (m) => m.buildTess),
  ),
  iras: inSpace(
    'IRAS',
    `${BUILT} 3.6 m tall, 3.24 m wide and 2.05 m deep with its solar panels out, its 60 cm telescope in the cylinder above its box, its sunshade at the top on the Sun’s side, from NASA, JPL and IPAC. How that height is shared between the parts is by eye.`,
    new Vector3(1, 0.3, 0),
    from(light, (m) => m.buildIras),
  ),
  hipparcos: inSpace(
    'Hipparcos',
    `${BUILT} its 29 cm Schmidt telescope inside its shade on top, its three solar panels of 1.69 m by 1.19 m 120° apart about its base, the Sun 43° off its spin axis, from ESA. Its body is given only in drawings: by eye.`,
    new Vector3(0.68, -0.73, 0),
    from(light, (m) => m.buildHipparcos),
  ),
  euclid: inSpace(
    'Euclid',
    `${BUILT} 4.5 m tall and 3.1 m across (ESA; its mission paper gives an envelope of 3.74 m by 4.8 m), its 1.2 m telescope above its service module, the sunshield with its solar cells up one side to the Sun, its 70 cm dish. The parts are by eye.`,
    SIDE,
    from(light, (m) => m.buildEuclid),
  ),
};
