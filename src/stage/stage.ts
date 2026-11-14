/**
 * The frame every 3D view draws in (#603): the renderer, the scene and camera, a drawing only
 * when something changed, and the canvas kept the size of its container. What a view shows comes
 * as parts, each joining in at the moments of a frame it cares about, in the order added. The
 * globe, the sky and the story scenes each wrote this loop of their own before.
 */

import { Scene } from 'three';
import type { Camera, WebGLRenderer } from 'three';

/** Something a view shows or keeps up to date, joining in at the moments of each frame. */
export interface StagePart {
  /** While awake, before drawing: true while moving, to draw and request another frame. */
  step?(now: number): boolean;
  /** Before a drawing: true when the frame after needs drawing too (a map still arriving). */
  beforeRender?(now: number): boolean | undefined;
  /** After a drawing: what is placed over the picture, and what the tests read. */
  afterRender?(): void;
  /** The container's new size, in CSS pixels. */
  resize?(width: number, height: number): void;
  dispose?(): void;
}

/** What the stage needs of a renderer: so a test can lend it one without WebGL. */
export type StageRenderer = Pick<WebGLRenderer, 'domElement' | 'setSize' | 'render' | 'dispose'>;

export interface StageOptions<C extends Camera = Camera> {
  readonly renderer: StageRenderer;
  readonly camera: C;
  /**
   * Whether the canvas's CSS size is set with its pixels (true), or left to the stylesheet. A
   * container with no size yet is left alone when true: the canvas is not shrunk to nothing.
   */
  readonly styleSize: boolean;
}

export class Stage<C extends Camera = Camera> {
  readonly scene = new Scene();
  readonly renderer: StageRenderer;
  readonly camera: C;
  readonly #container: HTMLElement;
  readonly #styleSize: boolean;
  readonly #parts: StagePart[] = [];
  #observer: ResizeObserver | null = null;
  #dirty = true;
  #frame: number | null = null;
  #running = false;

  constructor(container: HTMLElement, options: StageOptions<C>) {
    this.#container = container;
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.#styleSize = options.styleSize;
    container.append(options.renderer.domElement);
  }

  /** Join `part` in, after the parts already added; returns it. */
  add<T extends StagePart>(part: T): T {
    this.#parts.push(part);
    return part;
  }

  /** Draw on the next frame. */
  invalidate(): void {
    this.#dirty = true;
    this.#requestFrame();
  }

  /** Size the canvas to its container, and tell the parts. */
  resize(): void {
    const width = this.#container.clientWidth;
    const height = this.#container.clientHeight;
    if (this.#styleSize && (width === 0 || height === 0)) return;
    this.renderer.setSize(width, height, this.#styleSize);
    for (const part of this.#parts) part.resize?.(width, height);
    this.invalidate();
  }

  /** Keep the canvas the container's size from now on, as the container changes. */
  observeResize(): void {
    this.#observer ??= new ResizeObserver(() => {
      this.resize();
    });
    this.#observer.observe(this.#container);
  }

  /** Start the frames: the first on the next animation frame, or now when `immediately`. */
  start(immediately = false): void {
    if (this.#running) return;
    this.#running = true;
    if (immediately) this.#tick(performance.now());
    else this.#requestFrame();
  }

  /** Stop the frames; `start` takes them up again. */
  stop(): void {
    this.#running = false;
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }

  /** Stop, and let go of the parts and the renderer. */
  dispose(): void {
    this.stop();
    this.#observer?.disconnect();
    for (const part of this.#parts) part.dispose?.();
    this.renderer.dispose();
  }

  /** Coalesce wake-ups; a hidden container resumes through its resize observer or next update. */
  #requestFrame(): void {
    if (this.#running && this.#frame === null && this.#container.hidden === false)
      this.#frame = requestAnimationFrame(this.#tick);
  }

  readonly #tick = (now: number): void => {
    this.#frame = null;
    if (!this.#running || this.#container.hidden !== false) return;
    let moving = false;
    for (const part of this.#parts) {
      if (part.step?.(now) === true) {
        this.#dirty = true;
        moving = true;
      }
    }
    if (this.#dirty) {
      this.#dirty = false;
      for (const part of this.#parts) if (part.beforeRender?.(now) === true) this.#dirty = true;
      this.renderer.render(this.scene, this.camera);
      for (const part of this.#parts) part.afterRender?.();
    }
    if (moving || this.#dirty) this.#requestFrame();
  };
}
