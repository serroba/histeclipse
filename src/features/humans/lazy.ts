/**
 * A data file loaded once, the first time it is asked for (#1047): its value once it has arrived,
 * null until then. A failed load waits for Try again from the layer's chip (#762), rather than
 * being asked for again at every moment.
 */

import type { LayerLoad } from '../../state/activeLayers';
import { loadOnce, type LoadOnceOptions } from '../../state/loadOnce';

export interface Lazy<T> {
  /** The data, once it has arrived. */
  readonly value: T | null;
  /** Start loading it, unless it has arrived, is on its way, or failed. */
  ask(): void;
  /** How its load stands while the layer is on, for the chip. */
  report(on: boolean): LayerLoad | null;
}

export function lazy<T>(options: LoadOnceOptions<T>): Lazy<T> {
  const load = loadOnce(options);
  return {
    get value() {
      return load.value();
    },
    ask: () => {
      load.want();
    },
    report: (on) => load.report(on),
  };
}
