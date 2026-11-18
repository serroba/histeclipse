/**
 * The James Webb Space Telescope as a 3D model (#797), built here from NASA's published
 * dimensions: an approximation, not a copy of a published model, so it carries no one's terms
 * but our own. True size, in metres.
 *
 * Axes: the origin is at the centre of the sunshield's coldest layer; +Y points away from the
 * Sun (the sunshield always faces it, the convention #796 turns the model by); +Z is the way the
 * primary mirror looks, along the sunshield's long side.
 */

import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  BoxGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhongMaterial,
  Quaternion,
  Vector3,
  type Material,
} from 'three';

import { elementAt } from '../util/arrays';

/** NASA's figures, and the few this model adds to place its parts. */
export const WEBB = {
  /** The sunshield, tip to tip along its long side and across (NASA: 21.197 m by 14.162 m). */
  sunshieldLength: 21.197,
  sunshieldWidth: 14.162,
  sunshieldLayers: 5,
  /** One mirror segment, flat side to flat side (NASA: 1.32 m). */
  segmentAcross: 1.32,
  segments: 18,
  /** The primary mirror's radius of curvature (15.88 m), which bends the segments together. */
  primaryCurvature: 15.88,
  /** The secondary mirror, 0.74 m across, about 7.2 m in front of the primary. */
  secondaryAcross: 0.74,
  secondaryDistance: 7.16,
} as const;

/** Where the primary mirror's centre is, above the sunshield and toward its back. */
const MIRROR_CENTRE = new Vector3(0, 4.6, -1.5);
const UP = new Vector3(0, 1, 0);

function phong(color: number, shininess = 30, specular = 0x222222): MeshPhongMaterial {
  return new MeshPhongMaterial({ color, shininess, specular, side: DoubleSide });
}

/**
 * The sunshield's outline in the X–Z plane: six corners, pointed at the ends of the long side
 * where the pallets fold out, widest at the mid-booms.
 */
function outline(scale: number): readonly (readonly [number, number])[] {
  const halfLength = (WEBB.sunshieldLength / 2) * scale;
  const halfWidth = (WEBB.sunshieldWidth / 2) * scale;
  const end = 2.1 * scale;
  return [
    [end, halfLength],
    [halfWidth, 0],
    [end, -halfLength],
    [-end, -halfLength],
    [-halfWidth, 0],
    [-end, halfLength],
  ];
}

/**
 * One layer: a fan from its centre to its outline, its edge lifted by `flare` metres, as the
 * layers open apart toward their edges to let heat out sideways.
 */
function layerGeometry(scale: number, height: number, flare: number): BufferGeometry {
  const corners = outline(scale);
  const positions: number[] = [0, height, 0];
  // Each side in four, so the flare bends smoothly between the corners.
  const steps = 4;
  corners.forEach(([x, z], index) => {
    const [nextX, nextZ] = elementAt(corners, (index + 1) % corners.length);
    for (let step = 0; step < steps; step += 1) {
      const along = step / steps;
      positions.push(x + (nextX - x) * along, height + flare, z + (nextZ - z) * along);
    }
  });
  const rim = corners.length * steps;
  const indices: number[] = [];
  for (let index = 0; index < rim; index += 1) indices.push(0, 1 + index, 1 + ((index + 1) % rim));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The five layers, the coldest on top at y = 0, the one facing the Sun largest and lowest. */
function sunshield(): Group {
  const group = new Group();
  group.name = 'sunshield';
  const tints = [0xc9b3d9, 0xc4b6d4, 0xbfb8cf, 0xbab9ca, 0xb6b8c4];
  for (let layer = 0; layer < WEBB.sunshieldLayers; layer += 1) {
    const height = -0.22 * (WEBB.sunshieldLayers - 1 - layer);
    const scale = 1 - 0.012 * layer;
    const mesh = new Mesh(
      layerGeometry(scale, height, 0.12 * layer),
      phong(elementAt(tints, layer), 60, 0x555566),
    );
    mesh.name = `sunshield-layer-${String(layer + 1)}`;
    group.add(mesh);
  }
  // The mid-booms across, and the pallets that fold out at either end.
  const boom = phong(0x3a3a40);
  group.add(
    strut(
      new Vector3(-WEBB.sunshieldWidth / 2, -0.5, 0),
      new Vector3(WEBB.sunshieldWidth / 2, -0.5, 0),
      0.06,
      boom,
    ),
  );
  for (const end of [1, -1]) {
    const pallet = new Mesh(new BoxGeometry(4.0, 0.5, 0.6), boom);
    pallet.position.set(0, -0.75, end * (WEBB.sunshieldLength / 2 - 1.2));
    group.add(pallet);
  }
  return group;
}

/** A rod from `from` to `to`. */
function strut(from: Vector3, to: Vector3, radius: number, material: Material): Mesh {
  const length = from.distanceTo(to);
  const rod = new Mesh(new CylinderGeometry(radius, radius, length, 8), material);
  rod.position.copy(from).add(to).multiplyScalar(0.5);
  rod.quaternion.copy(new Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize()));
  return rod;
}

/**
 * Where each of the 18 segments sits on the mirror's face, in metres from its centre: five
 * columns of hexagons, flat sides up, of 3, 4, 4, 4 and 3, the middle one's centre left open for
 * the light to pass to the instruments.
 */
export function segmentCentres(): readonly (readonly [number, number])[] {
  const across = WEBB.segmentAcross;
  const corner = across / Math.sqrt(3);
  const columns: readonly (readonly number[])[] = [
    [-1, 0, 1],
    [-1.5, -0.5, 0.5, 1.5],
    [-2, -1, 1, 2],
    [-1.5, -0.5, 0.5, 1.5],
    [-1, 0, 1],
  ];
  return columns.flatMap((rows, column) =>
    rows.map((row) => [(column - 2) * 1.5 * corner, row * across] as const),
  );
}

/** The primary mirror: its gold segments, bent to share one curve, on their dark backplane. */
function primaryMirror(): Group {
  const group = new Group();
  group.name = 'primary-mirror';
  const gold = phong(0xe8b84a, 90, 0xfff0c0);
  const gap = 0.03;
  const corner = (WEBB.segmentAcross - gap) / Math.sqrt(3);
  const hexagon = new CylinderGeometry(corner, corner, 0.06, 6)
    .rotateX(Math.PI / 2)
    .rotateZ(Math.PI / 6);
  const curvature = new Vector3(0, 0, WEBB.primaryCurvature);
  for (const [x, y] of segmentCentres()) {
    const segment = new Mesh(hexagon, gold);
    segment.name = 'mirror-segment';
    segment.position.set(x, y, (x * x + y * y) / (2 * WEBB.primaryCurvature));
    segment.lookAt(curvature);
    group.add(segment);
  }
  const dark = phong(0x1c1c22);
  const backplane = new Mesh(new BoxGeometry(3.4, 5.4, 0.5), dark);
  backplane.position.set(0, 0, -0.4);
  group.add(backplane);
  // The instruments' box behind it, and the aft optics standing out of the central opening.
  const instruments = new Mesh(new BoxGeometry(2.2, 2.2, 1.8), dark);
  instruments.position.set(0, -0.6, -1.6);
  group.add(instruments);
  const aft = new Mesh(new BoxGeometry(0.6, 0.9, 0.7), phong(0x2b2b33));
  aft.position.set(0, 0, 0.3);
  group.add(aft);
  // The secondary mirror on its three struts: two from the mirror's lower sides, one from its top.
  const secondary = new Mesh(
    new CircleGeometry(WEBB.secondaryAcross / 2, 24),
    phong(0xe8b84a, 90, 0xfff0c0),
  );
  secondary.name = 'secondary-mirror';
  const focus = new Vector3(0, 0, WEBB.secondaryDistance);
  secondary.position.copy(focus);
  secondary.rotateY(Math.PI);
  group.add(secondary);
  const struts = phong(0x2e2e34);
  for (const foot of [
    new Vector3(-1.9, -2.6, 0.3),
    new Vector3(1.9, -2.6, 0.3),
    new Vector3(0, 3.2, 0.3),
  ]) {
    group.add(strut(foot, focus.clone().add(new Vector3(0, 0, -0.1)), 0.05, struts));
  }
  group.position.copy(MIRROR_CENTRE);
  return group;
}

/** Below the sunshield, on the Sun's side: the bus, its solar array, antenna and the tower. */
function bus(): Group {
  const group = new Group();
  group.name = 'bus';
  const body = new Mesh(new BoxGeometry(2.6, 1.4, 2.6), phong(0x2a2a30, 40, 0x444444));
  body.position.set(0, -1.7, -1.0);
  group.add(body);
  // The tower that lifted the telescope clear of the bus, through the sunshield.
  group.add(strut(new Vector3(0, -1.0, -1.0), new Vector3(0, 2.0, -1.5), 0.35, phong(0x55555c)));
  // The solar array, facing the Sun, out toward the back.
  const panel = new Mesh(new BoxGeometry(2.0, 0.05, 5.4), phong(0x1d2a4a, 70, 0x6677aa));
  panel.name = 'solar-array';
  panel.position.set(0, -2.45, -5.0);
  group.add(panel);
  // The high-gain antenna, a dish below the bus.
  const dish = new Mesh(new CylinderGeometry(0.1, 0.6, 0.25, 24, 1, true), phong(0xdddddd));
  dish.position.set(0.8, -2.65, 0.3);
  group.add(dish);
  // The momentum flap at the back of the sunshield, trimming the push of sunlight.
  const flap = new Mesh(new BoxGeometry(2.4, 0.04, 1.0), phong(0x2a2a30));
  flap.position.set(0, -0.6, -WEBB.sunshieldLength / 2 + 0.6);
  flap.rotateX(-0.5);
  group.add(flap);
  return group;
}

/** The whole telescope, at true size in metres, on the axes this file's header states. */
export function buildWebb(): Group {
  const webb = new Group();
  webb.name = 'webb';
  webb.add(sunshield(), primaryMirror(), bus());
  return webb;
}
