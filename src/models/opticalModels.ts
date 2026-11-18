/**
 * The great optical telescopes of today as 3D models (#860), each from its observatory's
 * published sizes, in metres, +Y up, +X east, -Z north (`kit.ts`), its dome cut away to show it.
 * What no page sizes is placed by eye, and its caption says so (`telescopeModels.ts`).
 */

import { BoxGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, Vector2 } from 'three';

import { array, ground, materials, type Materials } from './kit';
import { altAz, cutawayDome, monolith, segmented, trussTube } from './observatoryKit';

/** Keck (W. M. Keck Observatory): 36 segments 1.8 m across, 10.95 m at most, focal length
 * 17.5 m; the twins 85 m apart, Keck II to the north-east; domes and structure by eye. */
export function buildKeck(): Group {
  const kit = materials();
  const one = (): Group => {
    const tube = trussTube(segmented({ from: 1, to: 3 }, 1.8, 17.5, kit), 11.4, 14, kit);
    return new Group().add(
      altAz(tube, { axis: 11, span: 13, pivot: 3, elevationDeg: 60 }, kit),
      cutawayDome(37, 30, kit),
    );
  };
  const reach = 85 / Math.SQRT2;
  return new Group().add(
    array(
      [
        [0, 0],
        [reach, reach],
      ],
      one,
    ),
    middle(ground(170, kit), reach / 2, reach / 2),
  );
}

/** `object` moved to `east`, `north` of the origin. */
function middle<Part extends Mesh>(object: Part, east: number, north: number): Part {
  object.position.x = east;
  object.position.z = -north;
  return object;
}

/** Subaru (NAOJ): its 8.2 m mirror of focal length 15 m, in a structure 22.2 m tall and 27.2 m
 * wide, in its cylindrical enclosure 43 m tall and 40 m across. */
export function buildSubaru(): Group {
  const kit = materials();
  const tube = trussTube(monolith(8.2, 15, kit), 9, 15, kit);
  return new Group().add(
    altAz(tube, { axis: 22.2 - 11.5, span: 27.2 - 3, pivot: 4, elevationDeg: 60 }, kit),
    cutawayDome(40, 43, kit, false),
    ground(60, kit),
  );
}

/** One of the VLT's Unit Telescopes: an 8.2 m mirror in its enclosure, 29 m across and 28.5 m
 * tall; the structure by eye. */
function unitTelescope(kit: Materials): Group {
  const tube = trussTube(monolith(8.2, 14, kit), 9, 12, kit);
  return new Group().add(
    altAz(tube, { axis: 10, span: 11, pivot: 3, elevationDeg: 55 }, kit),
    cutawayDome(29, 28.5, kit, false),
  );
}

/** An Auxiliary Telescope: 1.82 m, in its enclosure 3.9 m across and 6.3 m tall. */
function auxiliary(kit: Materials): Group {
  const shell = new Mesh(new CylinderGeometry(1.95, 1.95, 6.3, 24), kit.dish);
  shell.position.y = 3.15;
  return new Group().add(shell);
}

/** The VLT (ESO): its four Unit Telescopes where ESO's station table puts them, and four
 * Auxiliary Telescopes at stations between them, placed by eye. */
export function buildVlt(): Group {
  const kit = materials();
  const units = array(
    [
      [-9.925, -20.335],
      [14.887, 30.502],
      [44.915, 66.183],
      [103.306, 43.999],
    ],
    () => unitTelescope(kit),
  );
  const auxiliaries = array(
    [
      [30, 10],
      [50, 25],
      [70, 15],
      [60, 45],
    ],
    () => auxiliary(kit),
  );
  return new Group().add(units, auxiliaries, ground(220, kit));
}

/** The GTC (IAC): 36 segments 1.9 m across, 10.4 m as a single mirror, in its dome 35 m across
 * and 24 m tall on a building 41 m tall in all; the structure by eye. */
export function buildGtc(): Group {
  const kit = materials();
  const tube = trussTube(segmented({ from: 1, to: 3 }, 1.9, 17, kit), 12, 14, kit);
  const building = new Mesh(new CylinderGeometry(17.5, 18.5, 41 - 24, 48), kit.concrete);
  building.position.y = (41 - 24) / 2;
  const top = new Group().add(
    altAz(tube, { axis: 11, span: 14, pivot: 3, elevationDeg: 60 }, kit),
    cutawayDome(35, 24, kit),
  );
  top.position.y = 41 - 24;
  return new Group().add(building, top, ground(70, kit));
}

/** Rubin's mirror: one glass 8.4 m across with a 5 m hole, its tertiary in the middle. */
function rubinMirror(kit: Materials): Group {
  const profile = [new Vector2(2.5, 0), new Vector2(4.2, 0.4)];
  const primary = new Mesh(new LatheGeometry(profile, 48), kit.dish);
  const tertiary = new Mesh(
    new LatheGeometry([new Vector2(0, 0.2), new Vector2(2.5, 0)], 48),
    kit.dish,
  );
  return new Group().add(primary, tertiary);
}

/** Rubin (Rubin Observatory, Ivezić et al. 2019): its 8.4 m mirror with its 5 m hole, its 3.4 m
 * secondary, on a 15 m pier in a 30 m dome; the mount, the building and the dome's height by eye. */
export function buildRubin(): Group {
  const kit = materials();
  const tube = trussTube(rubinMirror(kit), 9, 7, kit);
  const telescope = altAz(tube, { axis: 6, span: 10, pivot: 2, elevationDeg: 60 }, kit);
  telescope.position.y = 15;
  // The building round the pier, under the dome.
  const pier = new Mesh(new CylinderGeometry(15, 15, 15, 48), kit.concrete);
  pier.position.y = 7.5;
  const dome = cutawayDome(30, 26, kit);
  dome.position.y = 15;
  return new Group().add(pier, telescope, dome, ground(60, kit));
}

/** The ELT (ESO): 798 segments 1.45 m across in a 39 m mirror, its focal length half its 68.7 m
 * curvature, in a structure 50 m tall on a 51 m track, with its 30 m by 15 m Nasmyth platforms, in
 * its dome 93 m across and 80 m tall. */
export function buildElt(): Group {
  const kit = materials();
  // Rings 3 to 16 of hexagons: 798, leaving the middle open for the light to come back through;
  // its secondary 60 m up at the zenith, as ESO gives it.
  const tube = trussTube(segmented({ from: 3, to: 16 }, 1.45, 68.7 / 2, kit), 40, 36, kit);
  const telescope = altAz(tube, { axis: 28, span: 44, pivot: 4, elevationDeg: 60 }, kit);
  for (const side of [-1, 1]) {
    const platform = new Mesh(new BoxGeometry(15, 1, 30), kit.steel);
    platform.position.set(side * 30, 18, 0);
    telescope.add(platform);
  }
  return new Group().add(telescope, cutawayDome(93, 80, kit), ground(140, kit));
}
