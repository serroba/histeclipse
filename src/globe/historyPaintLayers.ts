/**
 * The parts of the history map painted on Earth's surface under the states (#379): today's
 * rocks, the ways of life, and the squares with radiocarbon dates. Each is a layer with its slot
 * on the map; under the states each is fainter, so theirs still read.
 */

import type { DateCell } from '../data/radiocarbonDates';
import type { RockUnit } from '../data/rocks';
import type { WayRegion } from '../data/waysOfLife';
import { paintDateCells, paintRocks, paintWays } from './empireCanvas';
import { HISTORY_PAINT_ORDER, type LayerFactory } from './layerHost';

/** Today's rocks, by unit; null takes them away. */
export const rocksLayer: LayerFactory<readonly RockUnit[] | null> = (host) => {
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.rocks);
  return {
    update(units) {
      // Painting the map is slow: only when the rocks come or go.
      if ((units === null ? 'off' : 'on') === host.container.dataset['rocks']) return;
      host.container.dataset['rocks'] = units === null ? 'off' : 'on';
      slot.show(
        units === null
          ? null
          : (canvas, statesOver) => {
              paintRocks(canvas, units, statesOver ? 0.45 : 1);
            },
      );
    },
  };
};

/** Each region's most widespread way of life; null takes them away. */
export const waysLayer: LayerFactory<readonly WayRegion[] | null> = (host) => {
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.ways);
  return {
    update(regions) {
      host.container.dataset['ways'] = regions === null ? 'off' : String(regions.length);
      slot.show(
        regions === null
          ? null
          : (canvas, statesOver) => {
              paintWays(canvas, regions, statesOver ? 0.45 : 1);
            },
      );
    },
  };
};

export interface DateCells {
  readonly cells: readonly DateCell[];
  readonly cellDegrees: number;
}

/** The squares with radiocarbon dates near the year shown; null takes them away. */
export const dateCellsLayer: LayerFactory<DateCells | null> = (host) => {
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.dates);
  return {
    update(dates) {
      host.container.dataset['dateCells'] = dates === null ? 'off' : String(dates.cells.length);
      slot.show(
        dates === null
          ? null
          : (canvas, statesOver) => {
              paintDateCells(canvas, dates.cells, dates.cellDegrees, statesOver ? 0.6 : 1);
            },
      );
    },
  };
};
