/**
 * Maps loaded in the order they were asked for: a newer one is shown as soon as it arrives,
 * even if a later one is still loading (as time plays, the latest is often not there yet);
 * an older one arriving late is not. Turning a layer off drops what is still loading.
 */
export function inOrder(): { ask(): number; show(ticket: number): boolean; drop(): void } {
  let asked = 0;
  let shown = 0;
  return {
    ask: () => ++asked,
    show(ticket) {
      if (ticket <= shown) return false;
      shown = ticket;
      return true;
    },
    drop() {
      shown = ++asked;
    },
  };
}
