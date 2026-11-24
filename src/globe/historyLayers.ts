/**
 * History's map painted from its layers (#1045), the sea's monthly maps kept from repainting the
 * others. A sea map changes every month the years play (El Niño's anomaly, the ocean's
 * temperature); the states and ways of life under and over it change far more rarely, and are
 * slow to trace: on a phone, repainting them with each month took 140 to 370 ms.
 *
 * So while a sea map is on, the layers painted under the sea's maps (the rocks, the ways of life,
 * the radiocarbon dates) and those over them (the AMOC's line, the ozone hole, the states) are
 * each painted once onto a map of their own and kept. Each repaint copies the one under, paints
 * the sea's maps, and copies the one over: everything in its order, as before. A kept map is let
 * go once it is not needed: each is many megabytes on a phone.
 */

import { HISTORY_PAINT_ORDER } from './layerHost';

/** The history map's layers that are the sea's maps, repainted month by month. */
export const SEA_PAINT_ORDERS: ReadonlySet<number> = new Set([
  HISTORY_PAINT_ORDER.oceanHeat,
  HISTORY_PAINT_ORDER.oceanTemp,
  HISTORY_PAINT_ORDER.enso,
]);
const FIRST_SEA = Math.min(...SEA_PAINT_ORDERS);

/** A layer of the map: where it is painted in the order, and how. */
export interface PaintedLayer {
  readonly order: number;
  readonly paint: (canvas: HTMLCanvasElement) => void;
  /** What it paints: the same while its painting is the same, to keep the maps made of it. */
  readonly key: unknown;
}

/** What the layers need of a canvas: a new one map-shaped, and to clear one. */
export interface MapCanvases {
  make(): HTMLCanvasElement;
  clear(canvas: HTMLCanvasElement): void;
}

/** A map of some layers painted together, kept while they paint the same. */
class KeptMap {
  readonly #canvases: MapCanvases;
  #map: HTMLCanvasElement | null = null;
  #keys: readonly unknown[] = [];

  constructor(canvases: MapCanvases) {
    this.#canvases = canvases;
  }

  get kept(): boolean {
    return this.#map !== null;
  }

  /** `layers` painted, again only when one of them, or `shared`, changed. */
  of(layers: readonly PaintedLayer[], shared: unknown): HTMLCanvasElement {
    const keys = [shared, ...layers.map(({ key }) => key)];
    const same =
      keys.length === this.#keys.length && keys.every((key, index) => key === this.#keys[index]);
    if (same && this.#map !== null) return this.#map;
    const map = this.#map ?? this.#canvases.make();
    this.#canvases.clear(map);
    for (const layer of layers) layer.paint(map);
    this.#map = map;
    this.#keys = keys;
    return map;
  }

  letGo(): void {
    if (this.#map === null) return;
    this.#map.width = 0;
    this.#map.height = 0;
    this.#map = null;
    this.#keys = [];
  }
}

export class HistoryLayers {
  readonly #canvases: MapCanvases;
  readonly #under: KeptMap;
  readonly #over: KeptMap;

  constructor(canvases: MapCanvases) {
    this.#canvases = canvases;
    this.#under = new KeptMap(canvases);
    this.#over = new KeptMap(canvases);
  }

  /** Which maps are kept now, under the sea's and over them (for tests). */
  get kept(): { readonly under: boolean; readonly over: boolean } {
    return { under: this.#under.kept, over: this.#over.kept };
  }

  /**
   * Paint `layers` (in order, lower first) onto `canvas`; `shared` is anything else they paint
   * by, the kept maps painted again when it changes.
   */
  paint(canvas: HTMLCanvasElement, layers: readonly PaintedLayer[], shared?: unknown): void {
    const sea = layers.filter(({ order }) => SEA_PAINT_ORDERS.has(order));
    const others = layers.filter(({ order }) => !SEA_PAINT_ORDERS.has(order));
    const under = others.filter(({ order }) => order < FIRST_SEA);
    const over = others.filter(({ order }) => order > FIRST_SEA);
    this.#canvases.clear(canvas);
    const context = sea.length === 0 || others.length === 0 ? null : canvas.getContext('2d');
    if (context === null) {
      this.#under.letGo();
      this.#over.letGo();
      for (const layer of layers) layer.paint(canvas);
      return;
    }
    const copy = (kept: KeptMap, group: readonly PaintedLayer[]): void => {
      if (group.length === 0) kept.letGo();
      else context.drawImage(kept.of(group, shared), 0, 0, canvas.width, canvas.height);
    };
    copy(this.#under, under);
    for (const layer of sea) layer.paint(canvas);
    copy(this.#over, over);
  }
}
