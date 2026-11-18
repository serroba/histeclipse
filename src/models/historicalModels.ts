/**
 * The great telescopes of the past as 3D models (#860), from the sizes their observatories,
 * museums and builders published, in metres, +Y up, +X east, -Z north (`kit.ts`): the equatorial
 * giants turning about the celestial pole at their latitude, the reflectors before them on frames
 * and walls. What no source sizes is placed by eye, and its caption says so.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  Quaternion,
  TorusGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';

import { ground, materials, strut, type Materials } from './kit';
import { cutawayDome, monolith, poleward, trussTube } from './observatoryKit';

/**
 * A yoke: two beams along the polar axis `width` apart and `length` long, joined at its south
 * end, its north end a horseshoe (Hale's) or a crossbar (Hooker's closed yoke), the tube between
 * them on the declination axis, `declinationDeg` from the pole. Its +Y is the polar axis.
 */
function yoke(
  tube: Object3D,
  options: { readonly width: number; readonly length: number; readonly horseshoe: boolean },
  kit: Materials,
): Group {
  const { width, length } = options;
  const group = new Group();
  for (const side of [-1, 1]) {
    group.add(
      strut(
        new Vector3((side * width) / 2, 0, 0),
        new Vector3((side * width) / 2, length, 0),
        width * 0.08,
        kit.steel,
      ),
    );
  }
  group.add(
    strut(new Vector3(-width / 2, 0, 0), new Vector3(width / 2, 0, 0), width * 0.1, kit.steel),
  );
  if (options.horseshoe) {
    const shoe = new Mesh(
      new TorusGeometry(width / 2, width * 0.06, 12, 48, Math.PI * 1.6),
      kit.steel,
    );
    shoe.position.y = length;
    shoe.rotation.set(Math.PI / 2, 0, Math.PI * 0.7);
    group.add(shoe);
  } else {
    group.add(
      strut(
        new Vector3(-width / 2, length, 0),
        new Vector3(width / 2, length, 0),
        width * 0.1,
        kit.steel,
      ),
    );
  }
  const declination = new Group();
  declination.position.y = length / 2;
  declination.rotation.x = -Math.PI / 3;
  declination.add(tube);
  group.add(declination);
  return group;
}

/** `object` turned so its +Y is the polar axis at `latitudeDeg`, its foot at `foot`. */
function onPolarAxis(object: Object3D, latitudeDeg: number, foot: Vector3): Object3D {
  object.quaternion.copy(
    new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), poleward(latitudeDeg)),
  );
  object.position.copy(foot);
  return object;
}

/** A tube centred on its middle, `length` along +Y. */
function centred(tube: Object3D, length: number): Object3D {
  tube.position.y = -length / 2;
  return new Group().add(tube);
}

/** The Hale (Caltech, Palomar): its 5.1 m mirror at prime focus 16.76 m, in its Serrurier truss,
 * on a yoke with its horseshoe at the north, at Palomar's 33.4°, in its dome 42 m across and 41 m
 * tall; the yoke's and the horseshoe's size by eye. */
export function buildHale(): Group {
  const kit = materials();
  const tube = centred(trussTube(monolith(5.1, 16.76, kit), 6.4, 17, kit), 17);
  const mount = onPolarAxis(
    yoke(tube, { width: 14, length: 18, horseshoe: true }, kit),
    33.4,
    new Vector3(0, 4, 9),
  );
  const pier = new Mesh(new BoxGeometry(5, 4, 5), kit.concrete);
  pier.position.set(0, 2, 9);
  return new Group().add(mount, pier, cutawayDome(42, 41, kit), ground(60, kit));
}

/** The Hooker (Mount Wilson): its 2.57 m mirror, 12.8 m to its plate, in its 3.35 m tube, on a
 * closed yoke at Mount Wilson's 34.2°, on its 10 m pier on a 13.7 m by 6.1 m base, its floor
 * 16.5 m across, in its 30.5 m dome; the yoke's size and the dome's height by eye. */
export function buildHooker(): Group {
  const kit = materials();
  const shell = new Mesh(new CylinderGeometry(1.68, 1.68, 13.5, 32, 1, true), kit.dark);
  shell.position.y = 13.5 / 2;
  const tube = centred(new Group().add(monolith(2.57, 12.8, kit), shell), 13.5);
  const pier = new Mesh(new BoxGeometry(6.1, 10.06, 13.72), kit.concrete);
  pier.position.y = 10.06 / 2;
  const floor = new Mesh(new CylinderGeometry(8.23, 8.23, 0.4, 48), kit.concrete);
  floor.position.y = 10.06;
  const mount = onPolarAxis(
    yoke(tube, { width: 5, length: 12, horseshoe: false }, kit),
    34.2,
    new Vector3(0, 11, 5),
  );
  const dome = cutawayDome(30.48, 24, kit);
  dome.position.y = 10.06;
  return new Group().add(pier, floor, mount, dome, ground(45, kit));
}

/** The Yerkes refractor's tube: 18.3 m long, 1.07 m across at its lens, 1.32 m at its middle,
 * 0.97 m at its eyepiece, along +Y from its eye end. */
function yerkesTube(kit: Materials): Mesh {
  const profile = [new Vector2(0.48, 0), new Vector2(0.66, 9.14), new Vector2(0.53, 18.29)];
  return new Mesh(new LatheGeometry(profile, 32), kit.dark);
}

/** Yerkes (Hale, 1897): its 40-inch lens, 18.9 m focal length, its tube 18.3 m long, on its
 * German mount: a column 13.1 m tall, 3.35 m by 1.52 m at its foot, the polar axis 4.1 m and the
 * declination axis 3.5 m, at 42.6°; in its dome 27.4 m across; the walls under the dome by eye. */
export function buildYerkes(): Group {
  const kit = materials();
  const column = new Mesh(new BoxGeometry(1.52, 13.1, 3.2), kit.dark);
  column.position.y = 13.1 / 2;
  const foot = new Mesh(new BoxGeometry(4.27, 0.6, 5.49), kit.dark);
  foot.position.y = 0.3;
  const polar = new Group();
  polar.add(new Mesh(new CylinderGeometry(0.19, 0.19, 4.1, 16).translate(0, 2.05, 0), kit.steel));
  const declination = new Group();
  declination.position.y = 4.1;
  declination.add(strut(new Vector3(0, 0, 0), new Vector3(3.5, 0, 0), 0.3, kit.steel));
  const tube = centred(yerkesTube(kit), 18.29);
  tube.position.x = 3.5;
  tube.rotation.x = -Math.PI / 4;
  declination.add(tube);
  polar.add(declination);
  onPolarAxis(polar, 42.6, new Vector3(0, 13.1, 0));
  return new Group().add(foot, column, polar, cutawayDome(27.43, 27.4, kit), ground(40, kit));
}

/** Herschel's 40-foot (Royal Museums Greenwich, Science Museum Group): its 1.22 m mirror at the
 * foot of its iron tube 12.2 m long and some 1.47 m across, raised by ropes from its timber frame;
 * the frame and its turning base, of which no size survives, by eye. */
export function buildHerschel(): Group {
  const kit = materials();
  const from = new Vector3(0, 1.5, 4);
  const up = (40 * Math.PI) / 180;
  const to = from.clone().add(new Vector3(0, Math.sin(up), -Math.cos(up)).multiplyScalar(12.19));
  const tube = strut(from, to, 1.47, kit.dark, 32);
  tube.name = 'tube';
  const group = new Group().add(tube);
  for (const side of [-1, 1]) {
    const apex = new Vector3(side * 3.5, 15, -3);
    group.add(
      strut(new Vector3(side * 3.5, 0, 6), apex, 0.35, kit.concrete),
      strut(new Vector3(side * 3.5, 0, -9), apex, 0.35, kit.concrete),
      strut(apex, to, 0.05, kit.steel),
    );
  }
  group.add(strut(new Vector3(-3.5, 15, -3), new Vector3(3.5, 15, -3), 0.3, kit.concrete));
  const base = new Mesh(new TorusGeometry(8, 0.25, 8, 48), kit.concrete);
  base.rotation.x = Math.PI / 2;
  group.add(base, ground(24, kit));
  return group;
}

/** The Leviathan (Birr Castle; Lyons, Trinity College Dublin): its 1.83 m mirror in its tube
 * 1.8 m across and some 16 m long, slung between masonry walls 21.4 m long and 15.2 m tall,
 * pointing south; the walls' thickness and the gap between them by eye. */
export function buildLeviathan(): Group {
  const kit = materials();
  const group = new Group();
  for (const side of [-1, 1]) {
    const wall = new Mesh(new BoxGeometry(2.5, 15.2, 21.4), kit.concrete);
    wall.position.set(side * 4.9, 7.6, 0);
    group.add(wall);
  }
  const from = new Vector3(0, 1.2, -9);
  const up = (35 * Math.PI) / 180;
  const to = from.clone().add(new Vector3(0, Math.sin(up), Math.cos(up)).multiplyScalar(16));
  const tube = strut(from, to, 1.8, kit.dark, 32);
  tube.name = 'tube';
  group.add(tube, ground(40, kit));
  return group;
}
