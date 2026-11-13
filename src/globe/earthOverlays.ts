/**
 * The maps painted over Earth's surface (#603): history's (the layers' parts in order, the
 * states over them) and deep time's (the land people had reached, the ice-sheet outlines). Both
 * paint one map-shaped canvas the Earth's shader samples, the whole map again whenever a part
 * changes, and say whether anything is on so the shader can skip it.
 */

import { CanvasTexture, type IUniform, SRGBColorSpace } from 'three';
import type { ArrivalGrid } from '../data/dispersal';
import { clearOverlay, createEmpireCanvas, paintSettled } from './empireCanvas';
import {
  DEEP_PAINT_ORDER,
  type DeepPainter,
  HISTORY_PAINT_ORDER,
  type HistoryPainter,
} from './layerHost';
import { createPaintSlots, type PaintSlot, type PaintSlots } from './paintSlots';

export class EarthOverlays {
  /** The painted map, which the Earth's shader samples as `overlayMap`. */
  readonly texture: CanvasTexture;
  /** History's map: each part painted with whether the states are drawn over it. */
  readonly history: PaintSlots<HistoryPainter>;
  /** Deep time's map, on the same canvas: history is never shown then. */
  readonly deep: PaintSlots<DeepPainter>;
  readonly #canvas = createEmpireCanvas();
  /** A dispersal model's settled land, the first of deep time's parts. */
  readonly #settled: PaintSlot<DeepPainter>;
  readonly #dataset: DOMStringMap;
  readonly #uniforms: () => Record<string, IUniform>;
  readonly #invalidate: () => void;

  /** `uniforms` are the Earth's shader's, asked for when a map is painted. */
  constructor(world: {
    readonly uniforms: () => Record<string, IUniform>;
    readonly invalidate: () => void;
    /** Where the settled land shown is written, for the tests. */
    readonly dataset: DOMStringMap;
  }) {
    this.#uniforms = world.uniforms;
    this.#dataset = world.dataset;
    this.#invalidate = world.invalidate;
    this.texture = new CanvasTexture(this.#canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.history = createPaintSlots<HistoryPainter>(() => {
      const statesOver = this.history.shows(HISTORY_PAINT_ORDER.states);
      this.#paint(
        'empiresActive',
        this.history.painters().map((paint) => (canvas: HTMLCanvasElement) => {
          paint(canvas, statesOver);
        }),
      );
    });
    this.deep = createPaintSlots<DeepPainter>(() => {
      this.#paint('iceOutlinesActive', this.deep.painters());
    });
    this.#settled = this.deep.add(DEEP_PAINT_ORDER.settled);
  }

  /**
   * Shade where a dispersal model has people settled `ka` thousand years ago, under any ice
   * outlines; null hides it. Whole thousands of years only: the model's own step.
   */
  setSettled(
    settled: { readonly scenario: string; readonly grid: ArrivalGrid; readonly ka: number } | null,
  ): void {
    const ka = settled === null ? null : Math.round(settled.ka);
    const key = settled === null ? 'off' : `${settled.scenario} ${String(ka)}`;
    if (key === this.#dataset['settled']) return;
    this.#dataset['settled'] = key;
    this.#settled.show(
      settled === null || ka === null
        ? null
        : (canvas) => {
            paintSettled(canvas, settled.grid, ka);
          },
    );
  }

  /** Paint the map from `painters`, in order, and say whether it is on through `flag`. */
  #paint(flag: string, painters: readonly DeepPainter[]): void {
    const uniforms = this.#uniforms();
    const on = painters.length > 0;
    uniforms[flag] = { value: on ? 1 : 0 };
    this.#invalidate();
    if (!on) return;
    clearOverlay(this.#canvas);
    for (const paint of painters) paint(this.#canvas);
    this.texture.needsUpdate = true;
    uniforms['overlayMap'] = { value: this.texture };
  }
}
