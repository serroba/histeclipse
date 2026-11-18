/**
 * The radio telescopes' parts (#859, #877): paraboloidal dishes, their feeds, a steerable dish on
 * its mount, and the spherical bowls set into the ground. Metres, +Y up, as in `kit.ts`.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
  Vector3,
  type Material,
} from 'three';

import { strut, type Materials } from './kit';

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
