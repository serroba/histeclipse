/**
 * Counters installed in the page before any of its scripts run, for the rendering audit (#661).
 * Runs in the browser: self-contained, no imports. It counts animation-frame callbacks and the
 * display frames they ran in, WebGL draw calls per canvas, canvas bitmap resets (each width or
 * height assignment reallocates the drawing buffer, even with the same value) and long animation
 * frames. `take()` returns the counts since the last take and starts again.
 */

export interface ProbeCounts {
  /** Animation-frame callbacks that ran. */
  readonly callbacks: number;
  /** Display frames in which at least one callback ran, with their timestamps. */
  readonly frameTimes: readonly number[];
  /** WebGL draw calls, by the test id of the canvas's nearest labelled ancestor. */
  readonly draws: Readonly<Record<string, number>>;
  /** Display frames in which each canvas drew at least once. */
  readonly drawFrames: Readonly<Record<string, number>>;
  /** Canvas width/height assignments by canvas, and how many kept the same value. */
  readonly sizeSets: Readonly<Record<string, { all: number; same: number }>>;
  /** Long animation frames (50 ms or more): count, total and blocking duration. */
  readonly longFrames: { count: number; ms: number; blockingMs: number; worstMs: number };
}

export interface Probe {
  take(): ProbeCounts;
  /** Milliseconds since the last animation-frame callback ran; Infinity before the first. */
  quietFor(): number;
  /** The WebGL renderer's name, unmasked where the browser allows. */
  gpu(): string;
}

export function installProbe(): void {
  const label = new WeakMap<object, string>();
  function nameOf(canvas: unknown): string {
    if (!(canvas instanceof HTMLCanvasElement)) return 'offscreen';
    const known = label.get(canvas);
    if (known !== undefined) return known;
    const owner = canvas.closest<HTMLElement>('[data-testid]');
    const name = owner?.dataset['testid'] ?? (canvas.isConnected ? 'page' : 'detached');
    if (canvas.isConnected) label.set(canvas, name);
    return name;
  }

  let callbacks = 0;
  let frameTimes: number[] = [];
  let frame = 0;
  let lastStamp = Number.NaN;
  let lastCallbackAt = Number.NEGATIVE_INFINITY;
  let draws: Record<string, number> = {};
  let drawFrames: Record<string, number> = {};
  const drewIn = new Map<string, number>();
  let sizeSets: Record<string, { all: number; same: number }> = {};
  let longFrames = { count: 0, ms: 0, blockingMs: 0, worstMs: 0 };

  const request = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    request((now) => {
      callbacks += 1;
      lastCallbackAt = performance.now();
      if (now !== lastStamp) {
        lastStamp = now;
        frame += 1;
        frameTimes.push(now);
      }
      callback(now);
    });

  function countDraw(this: WebGLRenderingContext | WebGL2RenderingContext): void {
    const name = nameOf(this.canvas);
    draws[name] = (draws[name] ?? 0) + 1;
    if (drewIn.get(name) !== frame) {
      drewIn.set(name, frame);
      drawFrames[name] = (drawFrames[name] ?? 0) + 1;
    }
  }
  const methods = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'];
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const method of methods) {
      const original: unknown = Reflect.get(proto, method);
      if (typeof original !== 'function') continue;
      Reflect.set(proto, method, function (this: WebGL2RenderingContext, ...args: unknown[]) {
        countDraw.call(this);
        return Reflect.apply(original, this, args) as unknown;
      });
    }
  }

  for (const dimension of ['width', 'height'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dimension);
    // Read as values, to be called with the canvas as `this`.
    const get: unknown = descriptor === undefined ? undefined : Reflect.get(descriptor, 'get');
    const set: unknown = descriptor === undefined ? undefined : Reflect.get(descriptor, 'set');
    if (typeof get !== 'function' || typeof set !== 'function') continue;
    Object.defineProperty(HTMLCanvasElement.prototype, dimension, {
      ...descriptor,
      set(this: HTMLCanvasElement, value: number) {
        const name = nameOf(this);
        const counts = (sizeSets[name] ??= { all: 0, same: 0 });
        counts.all += 1;
        if (Reflect.apply(get, this, []) === Math.floor(value)) counts.same += 1;
        Reflect.apply(set, this, [value]);
      },
    });
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const blocking = Number(Reflect.get(entry, 'blockingDuration') ?? 0);
        longFrames.count += 1;
        longFrames.ms += entry.duration;
        longFrames.blockingMs += blocking;
        longFrames.worstMs = Math.max(longFrames.worstMs, entry.duration);
      }
    }).observe({ type: 'long-animation-frame', buffered: false });
  } catch {
    // Not every browser reports long animation frames; the counts stay at zero.
  }

  const probe: Probe = {
    take() {
      const counts: ProbeCounts = {
        callbacks,
        frameTimes,
        draws,
        drawFrames,
        sizeSets,
        longFrames,
      };
      callbacks = 0;
      frameTimes = [];
      draws = {};
      drawFrames = {};
      sizeSets = {};
      longFrames = { count: 0, ms: 0, blockingMs: 0, worstMs: 0 };
      return counts;
    },
    quietFor: () => performance.now() - lastCallbackAt,
    gpu() {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (gl === null) return 'no WebGL2';
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return String(gl.getParameter(info === null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL));
    },
  };
  Object.defineProperty(window, '__renderingProbe', { value: probe });
}
