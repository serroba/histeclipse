/**
 * LIGO Livingston (#831), in three.js: the L of its two arms on their true bearings, 4 km each
 * (drawn a unit long), the laser light along them from the beam splitter at the corner to the
 * mirrors at the ends, and the light at the output port. A passing wave stretches one arm as it
 * shrinks the other, by the strain the detector measured (`set`); the output, held dark while
 * the arms are equal, brightens as they differ. North is −z, east +x.
 *
 * Builds objects only: the view (`waveView.ts`) draws them.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  MeshBasicMaterial,
  SphereGeometry,
  DoubleSide,
  type Object3D,
} from 'three';

/** Where the detectors are, and their arms' bearings, degrees east of north (LALSuite's). */
export const DETECTOR_SITES = {
  L1: {
    name: 'LIGO Livingston, Louisiana',
    latitude: 30.5629,
    longitude: -90.7742,
    x: 252.28,
    y: 162.28,
  },
  H1: {
    name: 'LIGO Hanford, Washington',
    latitude: 46.4551,
    longitude: -119.4077,
    x: 324.0,
    y: 234.0,
  },
} as const;

/** Which way a bearing points on the ground: north is −z, east +x. */
export function bearingDirection(degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [Math.sin(radians), -Math.cos(radians)];
}

/** The arms' lengths for a strain h (already stretched to be seen): one longer as the other is
 * shorter, by half of it each, so their difference over their length is h. */
export function armLengths(h: number): { readonly x: number; readonly y: number } {
  return { x: 1 + h / 2, y: 1 - h / 2 };
}

/** How bright the output port is: dark with the arms equal, full as they differ by `largest`. */
export function outputBrightness(h: number, largest: number): number {
  if (largest <= 0) return 0;
  const share = Math.min(1, Math.abs(h) / largest);
  return Math.sin((share * Math.PI) / 2) ** 2;
}

const COLOURS = {
  tube: 0x9aa3b2,
  laser: 0xff4a3d,
  mirror: 0xd9e2f0,
  ground: 0x2a3b2c,
  output: 0xfff1c4,
} as const;

export interface DetectorRig {
  readonly group: Group;
  /** Move the arms for the detector's strain, stretched; `largest` is its peak, stretched. */
  set(h: number, largest: number): void;
  /** How bright the output port is now, 0 to 1. */
  readonly brightness: () => number;
  dispose(): void;
}

/** A thing laid along the ground from the corner, `along` the bearing, its middle at half. */
function along(object: Object3D, bearing: number, length: number): void {
  const [east, south] = bearingDirection(bearing);
  object.position.set((east * length) / 2, object.position.y, (south * length) / 2);
  object.rotation.set(0, Math.atan2(east, south), 0);
}

/** The rig's materials, each let go of with it. */
function rigMaterials(own: <T extends { dispose(): void }>(item: T) => T): {
  readonly tubeMaterial: MeshStandardMaterial;
  readonly laserMaterial: MeshStandardMaterial;
  readonly mirrorMaterial: MeshStandardMaterial;
  readonly outputMaterial: MeshStandardMaterial;
} {
  const tubeMaterial = own(
    new MeshStandardMaterial({
      color: COLOURS.tube,
      roughness: 0.5,
      metalness: 0.4,
      transparent: true,
      opacity: 0.35,
    }),
  );
  const laserMaterial = own(
    new MeshStandardMaterial({
      color: COLOURS.laser,
      emissive: new Color(COLOURS.laser),
      emissiveIntensity: 1.2,
    }),
  );
  const mirrorMaterial = own(
    new MeshStandardMaterial({ color: COLOURS.mirror, roughness: 0.15, metalness: 0.9 }),
  );
  const outputMaterial = own(
    new MeshStandardMaterial({
      color: COLOURS.output,
      emissive: new Color(COLOURS.output),
      emissiveIntensity: 0,
    }),
  );
  return { tubeMaterial, laserMaterial, mirrorMaterial, outputMaterial };
}

export function createDetectorRig(site: (typeof DETECTOR_SITES)['L1']): DetectorRig {
  const group = new Group();
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };
  const ground = new Mesh(
    own(new RingGeometry(0, 1.6, 64)),
    own(
      new MeshBasicMaterial({
        color: COLOURS.ground,
        transparent: true,
        opacity: 0.35,
        side: DoubleSide,
      }),
    ),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  group.add(ground);

  const { tubeMaterial, laserMaterial, mirrorMaterial, outputMaterial } = rigMaterials(own);
  // Unit long along their own z, so a length is a scale.
  const tubeGeometry = own(new CylinderGeometry(0.018, 0.018, 1, 12).rotateX(Math.PI / 2));
  const beamGeometry = own(new CylinderGeometry(0.004, 0.004, 1, 6).rotateX(Math.PI / 2));
  const mirrorGeometry = own(new CylinderGeometry(0.04, 0.04, 0.025, 20).rotateX(Math.PI / 2));

  const arms = (['x', 'y'] as const).map((arm) => {
    const bearing = site[arm];
    const tube = new Mesh(tubeGeometry, tubeMaterial);
    const beam = new Mesh(beamGeometry, laserMaterial);
    const mirror = new Mesh(mirrorGeometry, mirrorMaterial);
    group.add(tube, beam, mirror);
    return { arm, bearing, tube, beam, mirror };
  });

  // The beam splitter at the corner; the laser comes in from one side, the output leaves by the
  // other, between the arms' far sides.
  const splitter = new Mesh(own(new BoxGeometry(0.06, 0.06, 0.012)), mirrorMaterial);
  splitter.rotation.y = Math.PI / 4;
  const output = new Mesh(own(new SphereGeometry(0.05, 20, 14)), outputMaterial);
  const [ox, oz] = bearingDirection((site.x + site.y) / 2 + 180);
  output.position.set(ox * 0.22, 0, oz * 0.22);
  group.add(splitter, output);

  let bright = 0;
  function set(h: number, largest: number): void {
    const lengths = armLengths(h);
    for (const { arm, bearing, tube, beam, mirror } of arms) {
      const length = lengths[arm];
      tube.scale.set(1, 1, length);
      beam.scale.set(1, 1, length);
      along(tube, bearing, length);
      along(beam, bearing, length);
      along(mirror, bearing, 2 * length);
    }
    bright = outputBrightness(h, largest);
    outputMaterial.emissiveIntensity = 0.1 + 2.4 * bright;
  }
  set(0, 1);

  return {
    group,
    set,
    brightness: () => bright,
    dispose() {
      for (const item of owned) item.dispose();
    },
  };
}
