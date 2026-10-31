/** Small 3×3 rotation helpers (row-major), enough for frame changes. */

export type Vector3 = readonly [number, number, number];
export type Matrix3 = readonly [Vector3, Vector3, Vector3];

export const IDENTITY: Matrix3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** Rotation by `angle` radians about x (y toward z). */
export function rotationX(angle: number): Matrix3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

/** Rotation by `angle` radians about y (z toward x). */
export function rotationY(angle: number): Matrix3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

/** Rotation by `angle` radians about z (x toward y). */
export function rotationZ(angle: number): Matrix3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

export function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const row = (r: Vector3): Vector3 => [
    r[0] * b[0][0] + r[1] * b[1][0] + r[2] * b[2][0],
    r[0] * b[0][1] + r[1] * b[1][1] + r[2] * b[2][1],
    r[0] * b[0][2] + r[1] * b[1][2] + r[2] * b[2][2],
  ];
  return [row(a[0]), row(a[1]), row(a[2])];
}

export function transpose(m: Matrix3): Matrix3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

export function apply(m: Matrix3, v: Vector3): Vector3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** Unit vector toward right ascension `ra` and declination `dec` (radians). */
export function directionFromRaDec(ra: number, dec: number): Vector3 {
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** Right ascension and declination (radians) of a vector. */
export function raDecFromVector([x, y, z]: Vector3): { ra: number; dec: number } {
  const ra = Math.atan2(y, x);
  return { ra: ra < 0 ? ra + 2 * Math.PI : ra, dec: Math.atan2(z, Math.hypot(x, y)) };
}
