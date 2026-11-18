/**
 * The Hubble Space Telescope as a 3D model (#797), built here from ESA/Hubble's published sizes:
 * an approximation, not a copy of a published model, so it carries no one's terms but our own.
 * True size, in metres.
 *
 * Axes: the origin is at the middle of the tube; +Z is the way it looks, out of its aperture; its
 * solar arrays stand out along ±X on their masts, and turn about them to face the Sun, which in
 * this model is down −Y (the convention #796 turns it by: arrays square to the Sun, the aperture
 * square to the Sun's line, as Hubble is never pointed near the Sun).
 */

import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshPhongMaterial,
  Quaternion,
  Vector3,
  type Material,
} from 'three';

/** ESA/Hubble's figures, and the few this model adds to place its parts. */
export const HUBBLE = {
  /** Its length and its widest diameter, the aft shroud's (ESA/Hubble: 13.2 m and 4.2 m). */
  length: 13.2,
  diameter: 4.2,
  /** The primary mirror (2.4 m). */
  mirror: 2.4,
  /** Each of its two solar arrays (ESA/Hubble: 2.45 m by 7.56 m). */
  arrayWidth: 2.45,
  arrayLength: 7.56,
  /** The forward tube and light shield, narrower than the aft shroud (about 3.1 m). */
  tube: 3.1,
} as const;

const HALF = HUBBLE.length / 2;
const UP = new Vector3(0, 1, 0);

function phong(color: number, shininess = 40, specular = 0x333333): MeshPhongMaterial {
  return new MeshPhongMaterial({ color, shininess, specular, side: DoubleSide });
}

/** A rod from `from` to `to`. */
function strut(from: Vector3, to: Vector3, radius: number, material: Material): Mesh {
  const rod = new Mesh(new CylinderGeometry(radius, radius, from.distanceTo(to), 8), material);
  rod.position.copy(from).add(to).multiplyScalar(0.5);
  rod.quaternion.copy(new Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize()));
  return rod;
}

/** A length of the body along Z, from `back` to `front`, `sides` faceted; `open` at its ends. */
function section(
  radius: number,
  [back, front]: readonly [number, number],
  sides: number,
  foil: Material,
  open = false,
): Mesh {
  const shape = new CylinderGeometry(radius, radius, front - back, sides, 1, open);
  const mesh = new Mesh(shape, foil).rotateX(Math.PI / 2);
  mesh.position.z = (back + front) / 2;
  return mesh;
}

/**
 * The body, back to front: the aft shroud the instruments sit in, the ring of equipment bays,
 * the forward shell round the mirror, and the light shield out to the aperture, its door open.
 */
function body(): Group {
  const group = new Group();
  group.name = 'body';
  // Its silver insulation, and the bays' darker panels.
  const foil = phong(0xd9dade, 90, 0x888888);
  const bays = phong(0x9a9ca3, 50);
  const radius = HUBBLE.diameter / 2;
  const tube = HUBBLE.tube / 2;
  group.add(
    section(radius, [-HALF, -3.2], 24, foil),
    section(radius, [-3.2, -1.6], 10, bays),
    section(tube, [-1.6, 2.4], 24, foil),
    // The light shield, open to the sky at its front.
    section(tube, [2.4, HALF], 24, foil, true),
  );
  // The dark inside of the tube, seen through the aperture, and the mirror down it.
  const inside = new Mesh(new CircleGeometry(tube - 0.05, 32), phong(0x111114));
  inside.position.z = 2.45;
  const mirror = new Mesh(
    new CircleGeometry(HUBBLE.mirror / 2, 32),
    phong(0x8fa3c4, 100, 0xcccccc),
  );
  mirror.name = 'primary-mirror';
  // Seen down the tube, just in front of the dark: deeper in, it sits in the shell that closes it.
  mirror.position.z = 2.47;
  // The aperture door, hinged at the top of the rim: closed it hangs over the aperture; open, as
  // in orbit, it is swung 105° out and up, a visor in front of the tube.
  const door = new Mesh(new CircleGeometry(tube, 32), foil);
  door.name = 'aperture-door';
  door.position.y = -tube;
  const hinge = new Group();
  hinge.position.set(0, tube, HALF);
  hinge.rotateX((-105 * Math.PI) / 180);
  hinge.add(door);
  // The aft bulkhead closing the shroud.
  const aft = new Mesh(new CircleGeometry(radius, 24), bays);
  aft.position.z = -HALF;
  aft.rotateY(Math.PI);
  group.add(inside, mirror, hinge, aft);
  return group;
}

/** The two solar arrays on their masts, long side along the tube, square to the Sun (−Y). */
function arrays(): Group {
  const group = new Group();
  group.name = 'solar-arrays';
  const cells = phong(0x2a3a6b, 80, 0x8899cc);
  const mast = phong(0xb8b8bc);
  const out = HUBBLE.tube / 2 + 0.6 + HUBBLE.arrayWidth / 2;
  for (const side of [1, -1]) {
    const wing = new Mesh(new BoxGeometry(HUBBLE.arrayWidth, 0.04, HUBBLE.arrayLength), cells);
    wing.name = 'solar-array';
    wing.position.set(side * out, 0, -0.6);
    group.add(
      wing,
      strut(new Vector3(side * HUBBLE.tube * 0.5, 0, -0.6), wing.position, 0.05, mast),
    );
  }
  return group;
}

/** The two high-gain antennas, dishes on booms above and below the tube. */
function antennas(): Group {
  const group = new Group();
  group.name = 'antennas';
  const boom = phong(0xb8b8bc);
  const dishes = phong(0xe8e8ea, 30);
  for (const side of [1, -1]) {
    const foot = new Vector3(0, side * (HUBBLE.tube / 2), 0.8);
    const end = new Vector3(0, side * 3.2, 0.8);
    const dish = new Mesh(new CylinderGeometry(0.65, 0.12, 0.3, 24, 1, true), dishes);
    dish.position.copy(end);
    if (side < 0) dish.rotateX(Math.PI);
    group.add(strut(foot, end, 0.04, boom), dish);
  }
  return group;
}

/** The whole telescope, at true size in metres, on the axes this file's header states. */
export function buildHubble(): Group {
  const hubble = new Group();
  hubble.name = 'hubble';
  hubble.add(body(), arrays(), antennas());
  return hubble;
}
