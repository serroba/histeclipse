/**
 * The radio telescopes' models (#859), each from the sizes its operator publishes, in metres,
 * standing with +Y up and -Z north (`kit.ts`). What no page sizes is placed by eye and said so in
 * its caption (`telescopeModels.ts`).
 */

import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, Vector3 } from 'three';

import { array, ground, groundRing, materials, strut, type Materials } from './kit';
import { bowl, dishWithFeed, steerable } from './radioKit';

/** Lovell (Jodrell Bank, Facts & Figures): 76.2 m, f/D 0.30, its axis 50.5 m up, its rail 107.5 m. */
export function buildLovell(): Group {
  const kit = materials();
  const group = steerable(
    {
      diameter: 76.2,
      focalRatio: 0.3,
      axisHeight: 50.5,
      railDiameter: 107.5,
      elevationDeg: 50,
      legs: 4,
    },
    kit,
  );
  group.add(ground(130, kit));
  return group;
}

/** Murriyang, Parkes (CSIRO Users Guide, Table 1.3): 64 m, f/D 0.41, its centre 27.4 m up on a
 * 10.7 m concrete tower; the tower's girth is by eye. */
export function buildParkes(): Group {
  const kit = materials();
  const group = new Group();
  const tower = new Mesh(new CylinderGeometry(6, 6, 10.7, 32), kit.concrete);
  tower.position.y = 10.7 / 2;
  const turret = new Mesh(new BoxGeometry(14, 14, 10), kit.steel);
  turret.position.y = 10.7 + 7;
  const dish = dishWithFeed(64, 0.41, 3, kit);
  dish.position.y = 27.4;
  dish.rotation.x = (30 * Math.PI) / 180;
  group.add(tower, turret, dish, ground(90, kit));
  return group;
}

/** Hung over a bowl: three towers on a ring, cables to a platform `height` above the rim. */
function hungPlatform(
  options: {
    readonly ring: number;
    readonly towerHeight: number;
    readonly height: number;
    readonly platform: number;
  },
  kit: Materials,
): Group {
  const group = new Group();
  const platform = new Mesh(
    new CylinderGeometry(options.platform / 2, options.platform / 2, 6, 3),
    kit.steel,
  );
  platform.position.y = options.height;
  group.add(platform);
  for (let tower = 0; tower < 3; tower += 1) {
    const angle = (2 * Math.PI * tower) / 3 + Math.PI / 2;
    const foot = new Vector3(options.ring * Math.cos(angle), 0, options.ring * Math.sin(angle));
    const top = foot.clone().setY(options.towerHeight);
    group.add(strut(foot, top, 8, kit.concrete));
    const corner = new Vector3(
      (options.platform / 2) * Math.cos(angle),
      options.height,
      (options.platform / 2) * Math.sin(angle),
    );
    group.add(strut(top, corner, 1.2, kit.steel));
  }
  return group;
}

/** Arecibo's sizes (#877): those Cornell published, as it ran it, and those placed by eye. */
export const ARECIBO = {
  sourced: {
    /** The bowl, 1000 ft across and 167 ft deep. */
    across: 305,
    deep: 51,
    /** The platform's reflectors above the rim. */
    platform: 137,
    /** The Gregorian dome, 86 ft across. */
    dome: 26,
  },
  byEye: { ground: 460, ring: 190, towerHeight: 110, platformAcross: 70, domeTall: 20 },
} as const;

/** Arecibo (Cornell, as it ran it): its bowl, its platform above it and the Gregorian dome under
 * that; its towers, ring and platform's size by eye. */
export function buildArecibo(): Group {
  const { sourced, byEye } = ARECIBO;
  const kit = materials();
  const group = new Group();
  group.add(
    bowl(sourced.across, sourced.deep, kit.dish),
    groundRing(sourced.across, byEye.ground, kit),
  );
  group.add(
    hungPlatform(
      {
        ring: byEye.ring,
        towerHeight: byEye.towerHeight,
        height: sourced.platform,
        platform: byEye.platformAcross,
      },
      kit,
    ),
  );
  const dome = new Mesh(
    new CylinderGeometry(sourced.dome / 2, sourced.dome / 2, byEye.domeTall, 24),
    kit.dark,
  );
  dome.position.y = sourced.platform - 16;
  group.add(dome);
  return group;
}

/** FAST (NAOC): 500 m across, curved to some 315 m, its 13 m feed cabin some 140 m above the
 * reflector on six cables from six towers; the towers' height and place by eye. */
export function buildFast(): Group {
  const kit = materials();
  const group = new Group();
  const depth = 315 - Math.sqrt(315 * 315 - 250 * 250);
  group.add(bowl(500, depth, kit.dish), groundRing(500, 700, kit));
  const cabin = new Mesh(new CylinderGeometry(6.5, 6.5, 4, 24), kit.dark);
  cabin.position.y = 140 - depth;
  group.add(cabin);
  for (let tower = 0; tower < 6; tower += 1) {
    const angle = (2 * Math.PI * tower) / 6;
    const foot = new Vector3(290 * Math.cos(angle), 0, 290 * Math.sin(angle));
    const top = foot.clone().setY(120);
    group.add(strut(foot, top, 4, kit.steel), strut(top, cabin.position, 0.6, kit.steel));
  }
  return group;
}

/** A dish on a pedestal, as the VLA's, ALMA's and SKA-Mid's: `height` to its top. */
function antenna(diameter: number, height: number, kit: Materials, offset = false): Group {
  const group = new Group();
  const axis = height - diameter / 2;
  const pedestal = new Mesh(
    new CylinderGeometry(diameter * 0.08, diameter * 0.12, axis, 12),
    kit.dish,
  );
  pedestal.position.y = axis / 2;
  const dish = dishWithFeed(diameter, offset ? 0.5 : 0.4, offset ? 1 : 4, kit);
  dish.position.y = axis;
  dish.rotation.x = (40 * Math.PI) / 180;
  group.add(pedestal, dish);
  return group;
}

/** Where the pads of a Y lie, east and north: `per` on each arm, out to `reach` m, spaced as
 * the VLA's are, closer in the middle (a power of the pad's number). */
export function yPads(per: number, reach: number): [number, number][] {
  const places: [number, number][] = [];
  // The arms at 5°, 125° and 245° east of north, the VLA's (north, south-east, south-west).
  for (const bearing of [5, 125, 245]) {
    const radians = (bearing * Math.PI) / 180;
    for (let pad = 1; pad <= per; pad += 1) {
      const out = reach * (pad / per) ** 1.716;
      places.push([out * Math.sin(radians), out * Math.cos(radians)]);
    }
  }
  return places;
}

/** The VLA (NRAO): 27 dishes of 25 m, some 28.7 m tall, on a Y, along the rail tracks they are
 * moved on; here its most compact (D),
 * about 1 km across; its dishes' focal ratio by eye. */
export function buildVla(): Group {
  const kit = materials();
  const tracks = [5, 125, 245].map((bearing) => {
    const radians = (bearing * Math.PI) / 180;
    const end = new Vector3(620 * Math.sin(radians), 0.3, -620 * Math.cos(radians));
    return strut(new Vector3(0, 0.3, 0), end, 6, kit.concrete);
  });
  return new Group().add(
    array(yPads(9, 600), () => antenna(25, 28.7, kit)),
    ...tracks,
    ground(1400, kit),
  );
}

/** ALMA (ESO, NRAO): 66 antennas, 54 of 12 m (14.7 m tall) and 12 of 7 m; here a compact
 * configuration some 300 m across; the 7 m antennas' height by eye. */
export function buildAlma(): Group {
  const kit = materials();
  const group = new Group();
  const big: [number, number][] = [];
  for (let one = 0; one < 54; one += 1) {
    // A spiral, filling a disc as the compact configurations do.
    const r = 150 * Math.sqrt((one + 0.5) / 54);
    const angle = one * 2.39996;
    big.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  group.add(array(big, () => antenna(12, 14.7, kit)));
  const small: [number, number][] = Array.from({ length: 12 }, (_, one) => {
    const angle = (2 * Math.PI * one) / 12;
    return [-230 + 30 * Math.cos(angle), 30 * Math.sin(angle)];
  });
  group.add(
    array(small, () => antenna(7, 9, kit)),
    ground(560, kit),
  );
  return group;
}

/** SKA-Mid (SKAO): 15 m offset Gregorian dishes, over 22 m tall; a group of seven here, of its
 * 197 over 150 km; their focal ratio by eye. */
export function buildSkaMid(): Group {
  const kit = materials();
  const places: [number, number][] = [[0, 0]];
  for (let one = 0; one < 6; one += 1) {
    const angle = (2 * Math.PI * one) / 6;
    places.push([45 * Math.cos(angle), 45 * Math.sin(angle)]);
  }
  return new Group().add(
    array(places, () => antenna(15, 22, kit, true)),
    ground(140, kit),
  );
}

/** SKA-Low (SKAO): one station of its 512, 256 antennas each 2 m tall, log-periodic "trees";
 * the station's width, some 38 m, by eye. */
export function buildSkaLow(): Group {
  const kit = materials();
  const places: [number, number][] = [];
  for (let one = 0; one < 256; one += 1) {
    const r = 19 * Math.sqrt((one + 0.5) / 256);
    const angle = one * 2.39996;
    places.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  const tree = new ConeGeometry(0.8, 2, 4);
  const station = array(places, () => {
    const one = new Mesh(tree, kit.steel);
    one.position.y = 1;
    const holder = new Group();
    holder.add(one);
    return holder;
  });
  return new Group().add(station, ground(46, kit));
}
