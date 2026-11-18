/**
 * The space telescopes' parts (#861, #862, #877): shades and hoods, off-axis mirrors, solar
 * wings; their panels, bodies and discs are the general kit's (`kit.ts`). Metres; a space telescope keeps its own axes, +Y along
 * its spin or its tube, the Sun's direction given with each model (`telescopeModels.ts`).
 */

import { CylinderGeometry, Group, Mesh, type Material } from 'three';

import { panel, type Materials } from './kit';

/** A cone from `bottom` across at y = `base` to `top` across, `height` tall: a shield, a hood. */
export function cone(
  bottom: number,
  top: number,
  height: number,
  base: number,
  material: Material,
): Mesh {
  const made = new Mesh(new CylinderGeometry(top / 2, bottom / 2, height, 32, 1, true), material);
  made.position.y = base + height / 2;
  return made;
}

/** An off-axis mirror `width` by `height`, an ellipse, facing +Z before it is turned. */
export function ellipse(width: number, height: number, kit: Materials): Mesh {
  const made = new Mesh(new CylinderGeometry(0.5, 0.5, 0.05, 40), kit.dish);
  made.scale.set(width, 1, height);
  made.rotation.x = Math.PI / 2;
  return made;
}

/** Panels `count` round an axis, each `width` by `length`, from radius `inner`, at height `y`,
 * leaning `tiltDeg` down from flat: solar wings deployed about a base. */
export function wings(
  count: number,
  size: { readonly width: number; readonly length: number },
  inner: number,
  y: number,
  tiltDeg: number,
  kit: Materials,
): Group {
  const group = new Group();
  for (let one = 0; one < count; one += 1) {
    const arm = new Group();
    arm.rotation.y = (2 * Math.PI * one) / count;
    const wing = panel(size.width, size.length, kit.solar);
    wing.position.z = size.length / 2;
    const hinge = new Group();
    hinge.position.set(0, y, inner);
    hinge.rotation.x = (tiltDeg * Math.PI) / 180;
    hinge.add(wing);
    arm.add(hinge);
    group.add(arm);
  }
  return group;
}
