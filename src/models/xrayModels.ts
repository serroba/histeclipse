/**
 * The space telescopes for X-rays and gamma rays as 3D models (#862), each from the sizes NASA,
 * ESA, IKI or its team published, in metres, +Y along its tube or its line of sight; the Sun's
 * direction is with its caption (`spaceTelescopeModels.ts`). What no page sizes is placed by eye,
 * and said so.
 */

import { BoxGeometry, Group, Mesh, Vector3 } from 'three';

import { materials, strut, type Materials } from './kit';
import { body, disc, panel } from './spaceKit';

/** Two wings out along ±X from a body `across` wide, to `span` in all, at height `y`. */
function sideWings(span: number, across: number, width: number, y: number, kit: Materials): Group {
  const group = new Group();
  const length = (span - across) / 2;
  for (const side of [-1, 1]) {
    const wing = panel(length, width, kit.solar);
    wing.rotation.x = Math.PI / 2;
    wing.position.set(side * (across / 2 + length / 2), y, 0);
    group.add(wing);
  }
  return group;
}

/** Chandra (NASA, the Chandra X-ray Center): 13.8 m long and 19.5 m across its solar arrays, its
 * 1.2 m mirror assembly in its spacecraft module, its 10 m optical bench back to its instruments,
 * its sunshade door open at the front; the bench's and the module's girth and the arrays' width
 * by eye. */
export function buildChandra(): Group {
  const kit = materials();
  const door = panel(1.6, 1.6, kit.foil);
  door.position.set(0, 13.8, -0.8);
  door.rotation.x = -0.6;
  return new Group().add(
    body(1.4, 1.0, kit.steel, { sides: 8 }),
    body(1.6, 9.6, kit.foil, { base: 1.0 }),
    body(2.6, 1.8, kit.steel, { sides: 8, base: 10.6 }),
    body(1.6, 1.4, kit.foil, { base: 12.4, open: true }),
    sideWings(19.5, 2.6, 2.0, 11.5, kit),
    door,
  );
}

/** XMM-Newton (ESA): 10 m long and 16 m across its arrays, its service module and its three mirror
 * modules with the 2 m Optical Monitor, the 6.8 m tube to its cameras; the girths by eye. */
export function buildXmm(): Group {
  const kit = materials();
  const group = new Group().add(
    body(3.9, 1.2, kit.steel, { sides: 8 }),
    body(2.6, 0.8, kit.steel, { base: 1.2 }),
    body(2.0, 6.8, kit.foil, { base: 2.0 }),
    body(2.4, 1.2, kit.dark, { base: 8.8, sides: 8 }),
    sideWings(16, 3.9, 1.8, 0.9, kit),
  );
  for (const [x, z] of [
    [0.6, 0.5],
    [-0.6, 0.5],
    [0, -0.6],
  ] as const) {
    const module = body(0.7, 0.6, kit.dish, { base: 1.4 });
    module.position.x = x;
    module.position.z = z;
    group.add(module);
  }
  const monitor = body(0.45, 2.0, kit.dark, { base: 2.0 });
  monitor.position.x = 1.25;
  return group.add(monitor);
}

/** Fermi (NASA): 2.8 m tall and 2.5 m across as launched, 15 m wide with its arrays out; its LAT,
 * 1.8 m square, on top of its bus, looking up; its burst monitor's 12.7 cm detectors round the
 * bus; the bus's height and the arrays' width by eye. */
export function buildFermi(): Group {
  const kit = materials();
  const lat = new Mesh(new BoxGeometry(1.8, 0.72, 1.8), kit.foil);
  lat.position.y = 1.6 + 0.36;
  const group = new Group().add(
    body(2.5, 1.6, kit.steel, { sides: 8 }),
    lat,
    sideWings(15, 2.5, 1.6, 0.8, kit),
  );
  for (let one = 0; one < 14; one += 1) {
    const angle = (2 * Math.PI * one) / 14;
    const detector = body(0.127, 0.15, one % 7 === 0 ? kit.steel : kit.dark, {
      base: 0.5 + (one % 2) * 0.5,
    });
    detector.position.x = 1.3 * Math.cos(angle);
    detector.position.z = 1.3 * Math.sin(angle);
    group.add(detector);
  }
  return group;
}

/** Compton (NASA): its 9 m by 4.5 m platform with EGRET (2.25 m tall, 1.65 m across) and COMPTEL
 * (2.61 m tall, 1.76 m across), OSSE's four detectors, BATSE's eight at its corners, 21.3 m across
 * its arrays, its 1.52 m dish on a 4.4 m boom; the platform's depth and OSSE's mount by eye. */
export function buildCompton(): Group {
  const kit = materials();
  const deck = new Mesh(new BoxGeometry(4.5, 1.2, 9), kit.steel);
  deck.position.y = 0.6;
  const egret = body(1.65, 2.25, kit.foil, { base: 1.2 });
  egret.position.z = -2.8;
  const comptel = body(1.76, 2.61, kit.foil, { base: 1.2 });
  comptel.position.z = 2.6;
  const group = new Group().add(deck, egret, comptel, sideWings(21.3, 4.5, 2.4, 0.6, kit));
  for (let one = 0; one < 4; one += 1) {
    const osse = body(0.5, 1.0, kit.dark, { base: 1.2 });
    osse.position.set(one < 2 ? -1.2 : 1.2, 1.2, one % 2 === 0 ? -0.4 : 0.4);
    group.add(osse);
  }
  for (const x of [-2.25, 2.25]) {
    for (const y of [0, 1.2]) {
      for (const z of [-4.5, 4.5]) {
        const batse = disc(0.508, y, kit.dark, 16);
        batse.position.set(x, y, z);
        batse.rotation.z = Math.PI / 4;
        group.add(batse);
      }
    }
  }
  const tip = new Vector3(0, -2.0, -4.5 - 3.6);
  const dish = disc(1.52, 0, kit.dish, 24);
  dish.position.copy(tip);
  return group.add(strut(new Vector3(0, 0.6, -4.5), tip, 0.08, kit.steel), dish);
}

/** Swift (NASA): BAT's coded mask some 2.7 m² held 1 m above its 1.2 m by 0.6 m detectors, beside
 * the X-ray telescope and the 30 cm UVOT; no official page sizes the craft, so the bus, the tubes
 * and the arrays are by eye. */
export function buildSwift(): Group {
  const kit = materials();
  const plane = panel(1.2, 0.6, kit.dark, 0.1);
  plane.position.set(0, 1.8, 0.7);
  const mask = panel(2.4, 1.1, kit.foil, 0.03);
  mask.position.set(0, 2.8, 0.7);
  const group = new Group().add(
    body(1.9, 1.2, kit.steel, { sides: 8 }),
    plane,
    mask,
    sideWings(5.0, 1.9, 1.4, 0.6, kit),
  );
  for (const [x, z] of [
    [-0.5, 0.65],
    [0.5, 0.65],
    [-0.5, -0.65],
    [0.5, -0.65],
  ] as const) {
    group.add(
      strut(
        new Vector3(x * 1.8, 1.2, z + 0.7),
        new Vector3(x * 2.2, 2.8, z * 0.8 + 0.7),
        0.05,
        kit.steel,
      ),
    );
  }
  const xrt = body(0.5, 3.6, kit.foil, { base: 1.2 });
  xrt.position.z = -0.5;
  const uvot = body(0.3, 2.6, kit.shell, { base: 1.2 });
  uvot.position.x = 0.5;
  uvot.position.z = -0.5;
  return group.add(xrt, uvot);
}

/** NuSTAR (Caltech, NASA): its optics 10.14 m from its detectors on a mast of 57 bays, its two
 * optics 38 cm across, 10.9 m long in all; the bus's size and the solar array's by eye. */
export function buildNustar(): Group {
  const kit = materials();
  const group = new Group().add(
    new Mesh(new BoxGeometry(1.2, 0.8, 1.2), kit.steel).translateY(0.4),
    sideWings(4.6, 1.2, 0.9, 0.4, kit),
  );
  const half = 0.25;
  const start = 0.8;
  const length = 10;
  for (const [x, z] of [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ] as const) {
    group.add(strut(new Vector3(x, start, z), new Vector3(x, start + length, z), 0.02, kit.steel));
  }
  for (let bay = 0; bay <= 57; bay += 1) {
    const y = start + (length * bay) / 57;
    group.add(
      strut(new Vector3(-half, y, -half), new Vector3(half, y, half), 0.012, kit.steel),
      strut(new Vector3(-half, y, half), new Vector3(half, y, -half), 0.012, kit.steel),
    );
  }
  const bench = new Mesh(new BoxGeometry(1.2, 0.1, 0.6), kit.steel);
  bench.position.y = 0.8 + 10.14 - 0.05;
  group.add(bench);
  for (const x of [-0.3, 0.3]) {
    const optic = body(0.382, 0.225, kit.dish, { base: 0.8 + 10.14 - 0.1 });
    optic.position.x = x;
    group.add(optic);
  }
  return group;
}

/** Spektr-RG (IKI, MPE): eROSITA (1.9 m across, 3.2 m tall) and ART-XC (0.9 m across, 3.5 m tall)
 * side by side on their frame atop the Navigator platform, looking the same way; the platform, the
 * frame and the solar panels by eye. */
export function buildSpektrRg(): Group {
  const kit = materials();
  const erosita = body(1.9, 3.2, kit.foil, { sides: 6, base: 1.6 });
  erosita.position.x = -0.7;
  const art = body(0.9, 3.5, kit.shell, { base: 1.6 });
  art.position.x = 1.0;
  const frame = new Mesh(new BoxGeometry(3.4, 0.3, 2.2), kit.steel);
  frame.position.y = 1.45;
  const panels = new Group();
  for (const side of [-1, 1]) {
    const one = panel(2.2, 1.3, kit.solar);
    one.rotation.x = Math.PI / 2;
    one.position.set(side * 1.25, 0.65, 1.2);
    panels.add(one);
  }
  return new Group().add(body(2.4, 1.3, kit.steel, { sides: 8 }), frame, erosita, art, panels);
}
