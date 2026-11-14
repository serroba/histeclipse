/** Installed in a fresh browser page: all callbacks in one virtual display frame share its clock. */
export function installVirtualDisplay(hz: number): void {
  let time = performance.now();
  let nextId = 0;
  let timer: number | null = null;
  const callbacks = new Map<number, FrameRequestCallback>();
  // An animation's initial performance.now and its RAF timestamps must use the same clock.
  Object.defineProperty(performance, 'now', { configurable: true, value: () => time });
  window.requestAnimationFrame = (callback) => {
    const id = ++nextId;
    callbacks.set(id, callback);
    timer ??= window.setTimeout(() => {
      timer = null;
      time += 1000 / hz;
      const due = [...callbacks.entries()];
      for (const [handle, run] of due) {
        if (callbacks.delete(handle)) run(time);
      }
    }, 1000 / hz);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    callbacks.delete(id);
    if (callbacks.size === 0 && timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
}
