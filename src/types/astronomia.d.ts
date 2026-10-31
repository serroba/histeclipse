/**
 * Types for the parts of astronomia (MIT, https://github.com/commenthol/astronomia) we use:
 * ELP/MPP02 (Chapront & Francou 2003) with constants fitted to DE405/DE406.
 * Checked against astronomia 4.2.0's src/elp.js and data/elpMppDe.js.
 */

declare module 'astronomia/elp' {
  /** Series data; only the mean longitude W1 is read directly by our code. */
  export interface ElpData {
    readonly name: string;
    /** Mean longitude of the Moon: polynomial in Julian centuries from J2000, radians. */
    readonly W1: readonly number[];
    readonly L: unknown;
    readonly B: unknown;
    readonly R: unknown;
  }

  export class Moon {
    constructor(data: ElpData);
    /** Geocentric position, km, in the inertial mean ecliptic and equinox of J2000. */
    positionXYZ(jde: number): { x: number; y: number; z: number };
  }
}

declare module 'astronomia/data/elpMppDe' {
  import type { ElpData } from 'astronomia/elp';

  const data: ElpData;
  export default data;
}

declare module 'astronomia/coord' {
  export class Equatorial {
    constructor(ra: number, dec: number);
    ra: number;
    dec: number;
  }
}

declare module 'astronomia/precess' {
  import type { Equatorial } from 'astronomia/coord';

  /** Rigorous precession (Meeus ch. 21) between Julian epochs, with proper motion in radians/yr. */
  export function position(
    eqFrom: Equatorial,
    epochFrom: number,
    epochTo: number,
    mα: number,
    mδ: number,
  ): Equatorial;
}
