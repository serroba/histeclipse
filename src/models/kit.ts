/**
 * The kit the telescopes' models are built with (#859, #877): the materials, and the parts any
 * model is made of (struts, panels, bodies, discs, the ground, copies in an array), each sized in
 * metres from what its operator publishes, so a model is its sizes put together. Parts of one
 * kind have their own kit: dishes and bowls in `radioKit.ts`, domes, mirrors and mounts in
 * `observatoryKit.ts`, a spacecraft's in `spaceKit.ts`.
 *
 * A model stands with +Y up (the zenith), +X east and -Z north, as it would on the ground; a
 * space telescope's model keeps its own axes (`webbModel.ts`). A model keeps its sizes in one
 * constant beside its builder (`WEBB`, `HUBBLE`), those its operator publishes apart from those
 * placed by eye, which its builder, its tests and its caption read.
 *
 * Builds objects only: the model view (`modelView.ts`) draws them.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
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
  /** Solar cells. */
  readonly solar: Material;
  /** Gold or silver insulation, wrapped round a craft. */
  readonly foil: Material;
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
    solar: new MeshStandardMaterial({
      color: 0x1d2c5a,
      roughness: 0.35,
      metalness: 0.5,
      side: DoubleSide,
    }),
    foil: new MeshStandardMaterial({
      color: 0xc9a54a,
      roughness: 0.4,
      metalness: 0.7,
      side: DoubleSide,
    }),
  };
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

/** The name of a model's ground, which the globe has its own of (#864). */
export const GROUND = 'ground';

/** A flat disc of ground `diameter` across, for an array or a bowl to stand on. */
export function ground(diameter: number, kit: Materials): Mesh {
  const made = disc(diameter, -0.1, kit.ground, 64, 0.2);
  made.name = GROUND;
  return made;
}

/** Ground round a hole `inner` across, out to `outer`: for a bowl set into it. */
export function groundRing(inner: number, outer: number, kit: Materials): Mesh {
  const ring = new Mesh(new RingGeometry(inner / 2, outer / 2, 64), kit.ground);
  ring.rotation.x = -Math.PI / 2;
  ring.name = GROUND;
  return ring;
}

/** A flat panel `width` by `length` (along X and Z), `thickness` thick, centred. */
export function panel(width: number, length: number, material: Material, thickness = 0.04): Mesh {
  return new Mesh(new BoxGeometry(width, thickness, length), material);
}

/** A prism or a cylinder (`sides` 0) `across` wide and `height` tall, standing from y = `base`. */
export function body(
  across: number,
  height: number,
  material: Material,
  options: { readonly sides?: number; readonly base?: number; readonly open?: boolean } = {},
): Mesh {
  const sides = options.sides ?? 0;
  const r = across / 2;
  const made = new Mesh(
    new CylinderGeometry(r, r, height, sides === 0 ? 32 : sides, 1, options.open ?? false),
    material,
  );
  made.position.y = (options.base ?? 0) + height / 2;
  return made;
}

/** A flat disc `diameter` across at height `y`, `thickness` thick: a solar disc (Planck's,
 * WMAP's), a shield, the ground. */
export function disc(
  diameter: number,
  y: number,
  material: Material,
  sides = 48,
  thickness = 0.05,
): Mesh {
  const made = new Mesh(
    new CylinderGeometry(diameter / 2, diameter / 2, thickness, sides),
    material,
  );
  made.position.y = y;
  return made;
}
