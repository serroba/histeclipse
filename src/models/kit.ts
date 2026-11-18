/**
 * The kit the telescopes' models are built with (#859): parts a telescope is made of, each sized
 * in metres from what its operator publishes, so a model is its sizes put together. A model
 * stands with +Y up (the zenith), +X east and -Z north, as it would on the ground; a space telescope's model
 * keeps its own axes (`webbModel.ts`).
 *
 * Builds objects only: the model view (`modelView.ts`) draws them.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from 'three';

/** The materials, made once a model and shared by its parts. */
export interface Materials {
  readonly dish: Material;
  readonly steel: Material;
  readonly concrete: Material;
  readonly dark: Material;
  readonly ground: Material;
  /** A dome's or an enclosure's shell, seen from inside once it is cut away. */
  readonly shell: Material;
}

export function materials(): Materials {
  return {
    dish: new MeshStandardMaterial({
      color: 0xe8ecf0,
      roughness: 0.45,
      metalness: 0.3,
      side: DoubleSide,
    }),
    steel: new MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.5, metalness: 0.6 }),
    concrete: new MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.9 }),
    dark: new MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.7 }),
    ground: new MeshStandardMaterial({ color: 0x5b6b4e, roughness: 1, side: DoubleSide }),
    shell: new MeshStandardMaterial({ color: 0xd6d3cc, roughness: 0.8, side: DoubleSide }),
  };
}

/**
 * A paraboloidal dish `diameter` across, its focus `focalRatio` diameters above its vertex: its
 * depth follows, r²/4f at the rim. Its axis is +Y, its vertex at the origin.
 */
export function dish(
  diameter: number,
  focalRatio: number,
  material: Material,
  segments = 48,
): Mesh {
  const focal = focalRatio * diameter;
  const profile: Vector2[] = [];
  const steps = 16;
  for (let step = 0; step <= steps; step += 1) {
    const r = (diameter / 2) * (step / steps);
    profile.push(new Vector2(r, (r * r) / (4 * focal)));
  }
  return new Mesh(new LatheGeometry(profile, segments), material);
}

/** How deep a dish is at its rim. */
export function dishDepth(diameter: number, focalRatio: number): number {
  return diameter / (16 * focalRatio);
}

/** A straight member from `from` to `to`, `thickness` across: a strut, a leg, a cable, or with
 * more `sides` a tube. */
export function strut(
  from: Vector3,
  to: Vector3,
  thickness: number,
  material: Material,
  sides = 6,
): Mesh {
  const length = from.distanceTo(to);
  const member = new Mesh(
    new CylinderGeometry(thickness / 2, thickness / 2, length, sides),
    material,
  );
  member.position.copy(from).add(to).multiplyScalar(0.5);
  member.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return member;
}

/**
 * Feed legs from a dish's rim to its focus, `legs` of them, and the feed's box there: a dish's
 * axis is +Y, its focus `focalRatio` diameters up.
 */
function feed(diameter: number, focalRatio: number, legs: number, kit: Materials): Group {
  const group = new Group();
  const focus = new Vector3(0, focalRatio * diameter, 0);
  const rim = dishDepth(diameter, focalRatio);
  for (let leg = 0; leg < legs; leg += 1) {
    const angle = (2 * Math.PI * leg) / legs + Math.PI / legs;
    const foot = new Vector3(
      (diameter / 2) * 0.92 * Math.cos(angle),
      rim * 0.85,
      (diameter / 2) * 0.92 * Math.sin(angle),
    );
    group.add(strut(foot, focus, diameter * 0.008, kit.steel));
  }
  const box = new Mesh(
    new BoxGeometry(diameter * 0.05, diameter * 0.05, diameter * 0.05),
    kit.steel,
  );
  box.position.copy(focus);
  group.add(box);
  return group;
}

/** A dish with its feed, as one, its axis +Y. */
export function dishWithFeed(
  diameter: number,
  focalRatio: number,
  legs: number,
  kit: Materials,
): Group {
  const group = new Group();
  group.add(dish(diameter, focalRatio, kit.dish), feed(diameter, focalRatio, legs, kit));
  return group;
}

/**
 * A steerable dish on an alt-azimuth mount: two towers either side carry the elevation axis
 * `axisHeight` up, through the plane of its rim, the dish tilted `elevationDeg` from the horizon toward +Z, on a base that turns
 * on a ring rail `railDiameter` across.
 */
export function steerable(
  options: {
    readonly diameter: number;
    readonly focalRatio: number;
    readonly axisHeight: number;
    readonly railDiameter: number;
    readonly elevationDeg: number;
    readonly legs: number;
  },
  kit: Materials,
): Group {
  const { diameter, focalRatio, axisHeight, railDiameter } = options;
  const group = new Group();
  const rail = new Mesh(
    new CylinderGeometry(railDiameter / 2, railDiameter / 2, 1, 64, 1, true),
    kit.concrete,
  );
  rail.position.y = 0.5;
  group.add(rail);
  // The towers either side of the bowl, holding it at its rim, through whose plane the axis runs.
  const reach = diameter / 2 + diameter * 0.04;
  for (const side of [-1, 1]) {
    const tower = new Mesh(
      new BoxGeometry(diameter * 0.06, axisHeight, diameter * 0.12),
      kit.steel,
    );
    tower.position.set(side * reach, axisHeight / 2, 0);
    group.add(tower);
  }

  // The bowl turns about the axle, its axis from the zenith to the elevation.
  const pivot = new Group();
  pivot.position.y = axisHeight;
  pivot.rotation.x = ((90 - options.elevationDeg) * Math.PI) / 180;
  const bowlAndFeed = dishWithFeed(diameter, focalRatio, options.legs, kit);
  bowlAndFeed.position.y = -dishDepth(diameter, focalRatio);
  pivot.add(bowlAndFeed);
  group.add(pivot);
  return group;
}

/** Copies of `make()` at each of `places` (east, north metres from the array's centre). */
export function array(places: readonly (readonly [number, number])[], make: () => Object3D): Group {
  const group = new Group();
  group.name = 'array';
  for (const [east, north] of places) {
    const one = make();
    one.position.set(east, 0, -north);
    group.add(one);
  }
  return group;
}

/** A flat disc of ground `diameter` across, for an array or a bowl to stand on. */
export function ground(diameter: number, kit: Materials): Mesh {
  const disc = new Mesh(new CylinderGeometry(diameter / 2, diameter / 2, 0.2, 64), kit.ground);
  disc.position.y = -0.1;
  return disc;
}

/** Ground round a hole `inner` across, out to `outer`: for a bowl set into it. */
export function groundRing(inner: number, outer: number, kit: Materials): Mesh {
  const ring = new Mesh(new RingGeometry(inner / 2, outer / 2, 64), kit.ground);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

/**
 * A spherical bowl `diameter` across and `depth` deep, set into the ground (Arecibo's, FAST's):
 * its rim at y = 0, its lowest point `depth` below. Its curvature's radius follows.
 */
export function bowl(diameter: number, depth: number, material: Material, segments = 64): Mesh {
  const r = diameter / 2;
  // The radius of the sphere it is cut from.
  const radius = (r * r + depth * depth) / (2 * depth);
  const profile: Vector2[] = [];
  const steps = 24;
  for (let step = 0; step <= steps; step += 1) {
    const x = r * (step / steps);
    profile.push(new Vector2(x, radius - Math.sqrt(radius * radius - x * x) - depth));
  }
  return new Mesh(new LatheGeometry(profile, segments), material);
}
