/** A cancellable frame loop with an injectable scheduler, shared by the two time players. */
export interface AnimationScheduler {
  now(): number;
  request(callback: (now: number) => void): number;
  cancel(id: number): void;
}

const browserScheduler: AnimationScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => {
    cancelAnimationFrame(id);
  },
};

export interface AnimationLoop {
  start(): void;
  stop(): void;
}

/** Minimum spacing accumulates elapsed time instead of dropping high-refresh-rate frames. */
export function animationLoop(
  step: (seconds: number) => void,
  minimumSeconds = 0,
  scheduler: AnimationScheduler = browserScheduler,
): AnimationLoop {
  let active = false;
  let generation = 0;
  let pending: number | null = null;
  let last = 0;

  const running = () => active;

  function schedule(version: number): void {
    pending = scheduler.request((now) => {
      if (!active || version !== generation) return;
      pending = null;
      const seconds = Math.max(0, (now - last) / 1000);
      if (seconds >= minimumSeconds) {
        last = Math.max(last, now);
        step(seconds);
      }
      // A step may stop, or stop and restart: neither leaves a second chain behind.
      if (running() && version === generation) schedule(version);
    });
  }

  return {
    start() {
      if (active) return;
      active = true;
      last = scheduler.now();
      generation += 1;
      schedule(generation);
    },
    stop() {
      if (!active) return;
      active = false;
      generation += 1;
      if (pending !== null) scheduler.cancel(pending);
      pending = null;
    },
  };
}
