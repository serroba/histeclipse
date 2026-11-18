/**
 * The space telescopes for light, infrared and microwaves as 3D models (#861), each from the sizes
 * NASA, ESA or its team published, in metres, +Y along its spin or its tube; the Sun's direction
 * is with its caption (`catalogue.ts`). What no page sizes is placed by eye, and said so.
 */

import { Group } from 'three';

import { materials } from './kit';
import { body, cone, disc, ellipse, panel, wings } from './spaceKit';

/** Planck (ESA): 4.2 m tall and 4.2 m across its solar disc, which faces the Sun below; its
 * 1.9 m by 1.5 m primary in its open baffle at the top; the modules and shields by eye. */
export function buildPlanck(): Group {
  const kit = materials();
  const primary = ellipse(1.9, 1.5, kit);
  primary.position.set(0, 3.1, -0.5);
  primary.rotation.x = Math.PI / 3;
  return new Group().add(
    disc(4.2, 0, kit.solar, 8),
    body(2.8, 0.9, kit.steel, { sides: 8, base: 0.05 }),
    cone(2.4, 3.6, 0.25, 1.2, kit.foil),
    cone(2.4, 3.8, 0.25, 1.5, kit.foil),
    cone(2.4, 4.0, 0.25, 1.8, kit.foil),
    body(3.2, 2.15, kit.dark, { base: 2.05, open: true }),
    primary,
  );
}

/** WMAP (NASA): 3.8 m tall on its 5.0 m sun shield of six solar panels; its 1 m cylinder, then
 * two 1.4 m by 1.6 m primaries back to back with their 0.9 m by 1.0 m secondaries; the hub and
 * the radiators by eye. */
export function buildWmap(): Group {
  const kit = materials();
  const group = new Group().add(
    disc(5.0, 0, kit.solar, 6),
    body(1.8, 0.5, kit.steel, { sides: 6, base: 0.05 }),
    body(1.0, 1.4, kit.foil, { base: 0.55 }),
  );
  for (const side of [-1, 1]) {
    const primary = ellipse(1.4, 1.6, kit);
    primary.position.set(0, 2.9, side * 0.75);
    primary.rotation.x = Math.PI / 2 - side * 0.35;
    const secondary = ellipse(0.9, 1.0, kit);
    secondary.position.set(0, 2.6, -side * 0.45);
    secondary.rotation.x = Math.PI / 2 + side * 0.5;
    group.add(primary, secondary);
  }
  return group;
}

/** Gaia (ESA): its 10.2 m sunshield of twelve frames, eight with solar cells, the Sun 45° off its
 * spin axis; its service module and the tent round its 3 m optical bench above; their heights by
 * eye. */
export function buildGaia(): Group {
  const kit = materials();
  return new Group().add(
    disc(10.2, 0, kit.solar, 12),
    body(3.2, 1.2, kit.foil, { sides: 12, base: 0.05 }),
    body(3.6, 1.6, kit.shell, { base: 1.25 }),
  );
}

/** Kepler (NASA): 4.7 m tall and 2.7 m across, its 0.95 m Schmidt aperture over a 1.4 m primary at
 * the base of its tube, its bus round that, its fixed solar array of four panels on one side
 * facing the Sun; the tube's and the panels' size by eye. */
export function buildKepler(): Group {
  const kit = materials();
  const group = new Group().add(
    body(2.7, 0.7, kit.steel, { sides: 6 }),
    body(1.6, 4.0, kit.foil, { base: 0.7, open: false }),
  );
  for (let one = 0; one < 4; one += 1) {
    const wing = panel(1.2, 2.1, kit.solar);
    wing.rotation.set(Math.PI / 2, 0, Math.PI / 2 + (one - 1.5) * 0.18);
    wing.position.set(1.15 + Math.abs(one - 1.5) * 0.12, 1.9, (one - 1.5) * 0.62);
    group.add(wing);
  }
  return group;
}

/** Spitzer (NASA/JPL): 4.5 m tall and 2.1 m across, its octagonal bus below its cryogenic
 * telescope of 0.85 m, its flat solar array up one side, always to the Sun; the bus's height and
 * the array's size by eye. */
export function buildSpitzer(): Group {
  const kit = materials();
  const array = panel(2.1, 3.3, kit.solar);
  array.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  array.position.set(1.05, 2.6, 0);
  return new Group().add(
    body(2.0, 0.8, kit.steel, { sides: 8 }),
    body(1.5, 3.7, kit.dark, { base: 0.8 }),
    array,
  );
}

/** COBE (NASA): 5.49 m long and 2.44 m across as launched, 8.53 m across its three solar panels
 * once out; its dewar inside a conical shield opening upward, the Sun to the side; the shield's
 * size by eye. */
export function buildCobe(): Group {
  const kit = materials();
  return new Group().add(
    body(2.44, 2.0, kit.steel, { sides: 6 }),
    body(1.4, 3.0, kit.shell, { base: 2.0 }),
    cone(2.44, 4.6, 2.6, 2.6, kit.foil),
    wings(3, { width: 1.6, length: (8.53 - 2.44) / 2 }, 1.22, 0.4, 0, kit),
  );
}

/** Herschel (ESA): 7.5 m tall and 4 m by 4 m, its service module below its cryostat, its 3.5 m
 * primary and 0.3 m secondary on top, its sunshade with its solar cells on the Sun's side; the
 * cryostat's and the sunshade's size by eye. */
export function buildHerschelSpace(): Group {
  const kit = materials();
  const shade = panel(4.0, 7.0, kit.solar);
  shade.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.12);
  shade.position.set(1.9, 3.7, 0);
  const primary = disc(3.5, 5.3, kit.dish);
  const secondary = disc(0.3, 6.9, kit.dark, 16);
  return new Group().add(
    body(4.0, 1.2, kit.steel, { sides: 8 }),
    body(2.8, 4.0, kit.shell, { base: 1.2 }),
    primary,
    cone(3.5, 3.5, 2.2, 5.3, kit.dark),
    secondary,
    shade,
  );
}

/** TESS (NASA, MIT): its four cameras of 10.5 cm in a column on their plate, its 0.7 m dish, its
 * two solar wings; no official page sizes the craft, so the bus, the hoods and the wings are by
 * eye. */
export function buildTess(): Group {
  const kit = materials();
  const group = new Group().add(body(1.2, 1.0, kit.steel, { sides: 6 }));
  for (let one = 0; one < 4; one += 1) {
    const camera = cone(0.3, 0.45, 0.8, 0, kit.dark);
    const holder = new Group().add(camera);
    holder.position.y = 1.1;
    holder.rotation.x = (one - 1.5) * 0.42;
    group.add(holder);
  }
  for (const side of [-1, 1]) {
    const wing = panel(1.6, 1.0, kit.solar);
    wing.position.set(side * 1.45, 0.5, 0);
    group.add(wing);
  }
  const dish = disc(0.7, 0.5, kit.dish, 24);
  dish.rotation.x = Math.PI / 2;
  dish.position.z = -0.65;
  return group.add(dish);
}

/** IRAS (NASA, JPL, IPAC): 3.6 m tall, 3.24 m wide and 2.05 m deep with its solar panels out; its
 * 60 cm telescope in the cylinder above its box, its sunshade at the top on the Sun's side; the
 * parts' share of that by eye. */
export function buildIras(): Group {
  const kit = materials();
  const box = panel(2.05, 2.05, kit.steel, 0.9);
  box.position.y = 0.45;
  const shade = panel(2.0, 1.0, kit.foil);
  shade.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.4);
  shade.position.set(0.95, 3.1, 0);
  const group = new Group().add(box, body(1.8, 2.7, kit.foil, { base: 0.9 }), shade);
  // Out from both sides of the box, to 3.24 m across in all.
  for (const side of [-1, 1]) {
    const wing = panel((3.24 - 2.05) / 2, 1.8, kit.solar);
    wing.rotation.x = Math.PI / 2;
    wing.position.set((side * (2.05 + 3.24)) / 4, 0.9, 0);
    group.add(wing);
  }
  return group;
}

/** Hipparcos (ESA): its 29 cm Schmidt telescope inside its shade on top, its three solar panels of
 * 1.69 m by 1.19 m 120° apart about its base, the Sun 43° off its spin axis; the body by eye. */
export function buildHipparcos(): Group {
  const kit = materials();
  return new Group().add(
    body(1.8, 1.0, kit.steel, { sides: 6 }),
    body(1.6, 1.4, kit.foil, { base: 1.0, sides: 6 }),
    wings(3, { width: 1.19, length: 1.69 }, 0.9, 0.1, 10, kit),
  );
}

/** Euclid (ESA): 4.5 m tall and 3.1 m across, its 1.2 m telescope above its service module, the
 * sunshield with its solar cells up one side to the Sun, its 70 cm dish; the parts by eye. */
export function buildEuclid(): Group {
  const kit = materials();
  const shield = panel(3.1, 4.5, kit.solar);
  shield.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  shield.position.set(1.4, 2.25, 0);
  const dish = disc(0.7, 0.6, kit.dish, 24);
  dish.rotation.x = Math.PI / 2;
  dish.position.set(-0.6, 0.4, -1.4);
  return new Group().add(
    body(3.1, 1.0, kit.steel, { sides: 6 }),
    body(1.6, 3.3, kit.shell, { base: 1.0 }),
    shield,
    dish,
  );
}
