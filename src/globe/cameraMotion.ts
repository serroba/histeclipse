import { Matrix4, type Camera } from 'three';

/**
 * How far a matrix's entries may move and the camera still count as still: far under a pixel.
 * The orbit controls' damping keeps easing the camera by ever smaller amounts, never quite none.
 */
const STILL = 1e-6;

/** How long the camera is still before the view counts as settled, ms (#631). */
export const SETTLE_MS = 200;

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
  #lastMove = -Infinity;
  #wake: ReturnType<typeof setTimeout> | undefined;

  readonly #onSettled: () => void;

  /** `onSettled` asks for a frame once the view has settled (see `turning`). */
  constructor(onSettled: () => void = () => undefined) {
    this.#onSettled = onSettled;
  }

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

  /**
   * Looking at the camera at `now` (ms): how long until the view settles, `SETTLE_MS` after it
   * last moved; 0 once settled. A pause shorter than that, mid-drag, does not settle it.
   */
  settlesIn(camera: Camera, now: number): number {
    if (this.moved(camera)) this.#lastMove = now;
    return Math.max(0, this.#lastMove + SETTLE_MS - now);
  }

  /**
   * Whether the view counts as turning at `now`: moved within `SETTLE_MS`. While it does, one
   * wake is set for when it settles: one frame then, not a frame after every frame, which on a
   * slow phone doubled the frames drawn while the view moved.
   */
  turning(camera: Camera, now: number): boolean {
    const wait = this.settlesIn(camera, now);
    clearTimeout(this.#wake);
    if (wait > 0) this.#wake = setTimeout(this.#onSettled, wait);
    return wait > 0;
  }

  /** No wake to come. */
  dispose(): void {
    clearTimeout(this.#wake);
  }
}
