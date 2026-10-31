/**
 * Least-squares fit of a secular correction ΔL(T) = c₂T² + c₃T³ + c₄T⁴ (arcseconds, T in Julian
 * centuries from J2000) to longitude residuals. This is how ELP/MPP02 was adjusted to DE406
 * (Chapront & Francou 2003); we use it to adjust the same theory to DE441.
 */

import { elementAt } from '../util/arrays';

export interface Residual {
  /** Julian centuries from J2000. */
  readonly T: number;
  /** Reference minus model, arcseconds. */
  readonly arcseconds: number;
}

export type SecularCorrection = readonly [t2: number, t3: number, t4: number];

export function fitSecularCorrection(residuals: readonly Residual[]): SecularCorrection {
  // Normal equations for the three unknowns, then Gaussian elimination.
  const a = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const b = [0, 0, 0];
  for (const { T, arcseconds } of residuals) {
    const basis = [T * T, T ** 3, T ** 4];
    basis.forEach((bi, i) => {
      b[i] = elementAt(b, i) + bi * arcseconds;
      basis.forEach((bj, j) => {
        const row = elementAt(a, i);
        row[j] = elementAt(row, j) + bi * bj;
      });
    });
  }
  for (let pivot = 0; pivot < 3; pivot += 1) {
    const pivotRow = elementAt(a, pivot);
    const divisor = elementAt(pivotRow, pivot);
    if (Math.abs(divisor) < 1e-300) throw new RangeError('Residuals do not determine the fit');
    for (let row = pivot + 1; row < 3; row += 1) {
      const target = elementAt(a, row);
      const factor = elementAt(target, pivot) / divisor;
      for (let column = pivot; column < 3; column += 1) {
        target[column] = elementAt(target, column) - factor * elementAt(pivotRow, column);
      }
      b[row] = elementAt(b, row) - factor * elementAt(b, pivot);
    }
  }
  const x = [0, 0, 0];
  for (let row = 2; row >= 0; row -= 1) {
    const current = elementAt(a, row);
    let sum = elementAt(b, row);
    for (let column = row + 1; column < 3; column += 1) {
      sum -= elementAt(current, column) * elementAt(x, column);
    }
    x[row] = sum / elementAt(current, row);
  }
  return [elementAt(x, 0), elementAt(x, 1), elementAt(x, 2)];
}

/** Value of the correction at T, arcseconds. */
export function secularCorrectionAt(correction: SecularCorrection, T: number): number {
  const [t2, t3, t4] = correction;
  return T * T * (t2 + T * (t3 + T * t4));
}
