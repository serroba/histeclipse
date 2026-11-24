/**
 * The plate boundaries with the Plates layer (#1160): the frame nearest the moment, loaded the
 * first time it is wanted and kept, turned as the continents are, and shown once it is in; the
 * frame before stays until then, so playing never blanks them.
 */

import {
  boundaryFrameMa,
  loadBoundaryFrame,
  loadBoundaryIndex,
  turnedFrame,
  type BoundaryFrame,
  type BoundaryIndex,
} from '../../data/plateBoundaries';
import type { GlobeLayer } from '../../globe/layerHost';
import type { Fetch } from '../../util/fetchJson';
import { errorMessage } from '../../util/errors';
import type { BoundariesShown } from './plateBoundaryLayer';

export interface PlateBoundaries {
  /** The boundaries at `ma`, turned east by `turn` degrees; null hides them. */
  show(at: { readonly ma: number; readonly turn: number } | null): void;
  /** Whether boundaries are drawn now. */
  drawn(): boolean;
}

export function createPlateBoundaries(options: {
  readonly base: string;
  readonly fetchJson: Fetch;
  readonly layer: GlobeLayer<BoundariesShown | null>;
  /** The page: shown again when something comes in, and told what could not load. */
  readonly page: { refresh(): void; notify(message: string): void };
}): PlateBoundaries {
  const { base, fetchJson, layer } = options;
  const folder = `${base}data/plate-boundaries/`;
  let index: BoundaryIndex | null = null;
  let asked = false;
  const frames = new Map<number, BoundaryFrame | 'loading' | 'failed'>();
  let shown: BoundariesShown | null = null;

  function failed(what: string, error: unknown): void {
    options.page.notify(`Could not load ${what}: ${errorMessage(error)}`);
  }

  function frameAt(ma: number): BoundaryFrame | null {
    const known = frames.get(ma);
    if (known === undefined) {
      frames.set(ma, 'loading');
      loadBoundaryFrame(`${folder}${String(ma)}.json`, fetchJson).then(
        (frame) => {
          frames.set(ma, frame);
          options.page.refresh();
        },
        (error: unknown) => {
          frames.set(ma, 'failed');
          failed('the plate boundaries', error);
        },
      );
    }
    return typeof known === 'object' ? known : null;
  }

  return {
    show(at) {
      if (at === null) {
        shown = null;
        layer.update(null);
        return;
      }
      if (index === null) {
        if (!asked) {
          asked = true;
          loadBoundaryIndex(`${folder}index.json`, fetchJson).then(
            (loaded) => {
              index = loaded;
              options.page.refresh();
            },
            (error: unknown) => {
              failed('the plate boundaries', error);
            },
          );
        }
        return;
      }
      const ma = boundaryFrameMa(index, at.ma);
      const frame = ma === null ? null : frameAt(ma);
      if (ma === null) shown = null;
      const key = `${String(ma)}:${String(at.turn)}`;
      if (frame !== null && shown?.key !== key) shown = { key, frame: turnedFrame(frame, at.turn) };
      layer.update(shown);
    },
    drawn: () => shown !== null,
  };
}
