/**
 * Plate boundaries painted onto deep time's map (#1160), over what is already painted: ridges,
 * where plates part, orange; subduction zones, where one sinks under another, blue and widest;
 * transforms, where they slide past, green; the rest faint and dashed. The continents' own
 * outlines are pink, so none of these is.
 */

import { BOUNDARY_KINDS, type BoundaryFrame, type BoundaryKind } from '../../data/plateBoundaries';
import { traceRings } from '../../globe/empireCanvas';

interface Stroke {
  readonly colour: string;
  readonly width: number;
  readonly dash: readonly number[];
}

export const BOUNDARY_STYLES: Readonly<Record<BoundaryKind, Stroke>> = {
  ridge: { colour: 'rgba(255, 150, 70, 0.95)', width: 4, dash: [] },
  subduction: { colour: 'rgba(90, 190, 255, 0.95)', width: 5, dash: [] },
  transform: { colour: 'rgba(170, 225, 110, 0.95)', width: 3, dash: [] },
  other: { colour: 'rgba(255, 255, 255, 0.5)', width: 2, dash: [10, 8] },
};

/** Paint a frame's boundaries, the faint ones first so the rest lie over them. */
export function paintBoundaries(canvas: HTMLCanvasElement, frame: BoundaryFrame): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  for (const kind of [...BOUNDARY_KINDS].reverse()) {
    const style = BOUNDARY_STYLES[kind];
    context.strokeStyle = style.colour;
    context.lineWidth = style.width;
    context.setLineDash([...style.dash]);
    traceRings(context, frame.lines[kind], false, () => {
      context.stroke();
    });
  }
  context.setLineDash([]);
}
