/**
 * The optical telescopes' parts (#860), beside the radio kit (`kit.ts`): a dome cut away to show
 * what is inside, a mirror of hexagonal segments, a truss tube, an alt-azimuth fork, and the
 * equatorial mounts of the great telescopes before it (a yoke, a refractor's column). Metres,
 * +Y up, +X east, -Z north.
 */

import {
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';

import { dish, strut, type Materials } from './kit';

/** Where the camera first looks from (`modelView.ts`): a dome is cut away on that side. */
const OPEN_SIDE = Math.atan2(0.6, 1);

/**
 * A dome `diameter` across and `height` to its top, its wall and its half-sphere cut away on the
 * side the camera first looks from; `round` false for a flat-roofed cylinder (Subaru's, the VLT's).
 */
export function cutawayDome(diameter: number, height: number, kit: Materials, round = true): Group {
  const r = diameter / 2;
  const wall = round ? Math.max(height - r, 0.5) : height;
  const start = OPEN_SIDE + Math.PI / 2;
  const group = new Group();
  const side = new Mesh(new CylinderGeometry(r, r, wall, 48, 1, true, start, Math.PI), kit.shell);
  side.position.y = wall / 2;
  group.add(side);
  if (round) {
    const top = new Mesh(
      new SphereGeometry(r, 48, 16, start + Math.PI / 2, Math.PI, 0, Math.PI / 2),
      kit.shell,
    );
    top.position.y = wall;
    group.add(top);
  }
  return group;
}

/** Where the hexagons of rings `from` to `to` lie (east, north), each `across` corner to corner. */
export function hexRings(from: number, to: number, across: number): [number, number][] {
  const r = across / 2;
  const places: [number, number][] = [];
  for (let q = -to; q <= to; q += 1) {
    for (let s = -to; s <= to; s += 1) {
      const ring = Math.max(Math.abs(q), Math.abs(s), Math.abs(q + s));
      if (ring >= from && ring <= to) places.push([Math.sqrt(3) * r * (q + s / 2), 1.5 * r * s]);
    }
  }
  return places;
}

/**
 * A mirror of hexagonal segments, `across` corner to corner, on rings `from` to `to` about its
 * centre (Keck's 36 on rings 1 to 3), each on the paraboloid of focal length `focal`, facing +Y.
 */
export function segmented(
  rings: { readonly from: number; readonly to: number },
  across: number,
  focal: number,
  kit: Materials,
): InstancedMesh {
  const places = hexRings(rings.from, rings.to, across);
  const tile = new CylinderGeometry(across / 2 - 0.02, across / 2 - 0.02, 0.08, 6);
  const mirror = new InstancedMesh(tile, kit.dish, places.length);
  const place = new Object3D();
  places.forEach(([east, north], index) => {
    place.position.set(east, (east * east + north * north) / (4 * focal), -north);
    place.updateMatrix();
    mirror.setMatrixAt(index, place.matrix);
  });
  mirror.name = 'segments';
  return mirror;
}

/**
 * An open truss tube from its mirror (a dish or segments, at the origin) up `length` along +Y to
 * a top ring `width` across holding the secondary: rings and eight struts, as Serrurier's.
 */
export function trussTube(mirror: Object3D, width: number, length: number, kit: Materials): Group {
  const group = new Group();
  const ring = (y: number): Mesh => {
    const made = new Mesh(
      new CylinderGeometry(width / 2, width / 2, width * 0.06, 24, 1, true),
      kit.steel,
    );
    made.position.y = y;
    return made;
  };
  group.add(mirror, ring(0), ring(length));
  for (let one = 0; one < 8; one += 1) {
    const a = (Math.PI * one) / 4;
    const b = a + Math.PI / 4;
    const foot = new Vector3((width / 2) * Math.cos(a), 0, (width / 2) * Math.sin(a));
    const top = new Vector3((width / 2) * Math.cos(b), length, (width / 2) * Math.sin(b));
    group.add(strut(foot, top, width * 0.025, kit.steel));
  }
  const secondary = new Mesh(
    new CylinderGeometry(width * 0.08, width * 0.08, width * 0.05, 24),
    kit.dark,
  );
  secondary.position.y = length;
  group.add(secondary);
  return group;
}

/**
 * An alt-azimuth fork: a tube (along +Y from its mirror) turning on an elevation axis `axis` up,
 * between two arms `span` apart, tilted `elevationDeg` from the horizon toward the north, on a
 * base turning about the vertical. The axis passes `pivot` above the tube's mirror.
 */
export function altAz(
  tube: Object3D,
  options: {
    readonly axis: number;
    readonly span: number;
    readonly pivot: number;
    readonly elevationDeg: number;
  },
  kit: Materials,
): Group {
  const { axis, span } = options;
  const group = new Group();
  const base = new Mesh(new CylinderGeometry(span * 0.55, span * 0.6, axis * 0.25, 32), kit.steel);
  base.position.y = axis * 0.125;
  group.add(base);
  for (const side of [-1, 1]) {
    group.add(
      strut(
        new Vector3((side * span) / 2, axis * 0.25, 0),
        new Vector3((side * span) / 2, axis, 0),
        span * 0.08,
        kit.steel,
      ),
    );
  }
  const turning = new Group();
  turning.position.y = axis;
  turning.rotation.x = -((90 - options.elevationDeg) * Math.PI) / 180;
  tube.position.y = -options.pivot;
  turning.add(tube);
  group.add(turning);
  return group;
}

/** A plain mirror (Subaru's, the VLT's, Rubin's): a dish `diameter` across. */
export function monolith(diameter: number, focal: number, kit: Materials): Mesh {
  return dish(diameter, focal / diameter, kit.dish);
}

/** The direction of the celestial pole from a place at `latitudeDeg` north: up, toward north. */
export function poleward(latitudeDeg: number): Vector3 {
  const lat = (latitudeDeg * Math.PI) / 180;
  return new Vector3(0, Math.sin(lat), -Math.cos(lat));
}
