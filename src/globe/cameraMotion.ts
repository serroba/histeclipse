import { Matrix4, type Camera } from 'three';

/**
 * How far a matrix's entries may move and the camera still count as still: far under a pixel.
 * The orbit controls' damping keeps easing the camera by ever smaller amounts, never quite none.
 */
const STILL = 1e-6;

function near(a: Matrix4, b: Matrix4): boolean {
  return a.elements.every((value, index) => Math.abs(value - (b.elements[index] ?? NaN)) <= STILL);
}

/**
 * Whether the camera moved since it was last looked at: where it is, how it is turned, how wide
 * it sees. While the globe turns, fewer names are shown over it (#631).
 */
export class CameraMotion {
  readonly #view = new Matrix4();
  readonly #projection = new Matrix4();
  #seen = false;

  /** True the first time, and whenever the camera has moved since the last call. */
  moved(camera: Camera): boolean {
    const still =
      this.#seen &&
      near(this.#view, camera.matrixWorld) &&
      near(this.#projection, camera.projectionMatrix);
    this.#view.copy(camera.matrixWorld);
    this.#projection.copy(camera.projectionMatrix);
    this.#seen = true;
    return !still;
  }
}
