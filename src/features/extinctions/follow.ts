/**
 * The globe turned to the extinction deep time is near (#1266), with the Mass extinctions layer
 * on: as its places come up, the camera turns to its causes (the lava, the impact), or to its
 * places where none is marked, once for each extinction.
 * The reader may still turn the globe: the guide then waits, and once they have left it alone a
 * while, it turns back. While an extinction's own clock is open, the clock has the camera.
 */

import { createGuide, type Guide } from '../ownTime';
import type { GeoPoint } from '../../core/geo';
import { angularDistance } from '../../eclipses/visibility';
import type { ExtinctionMark } from './view';

/** How far out an extinction's places are seen from, Earth radii: far enough to see them all. */
export const NEAR_DISTANCE = 3.2;

/** What the follow turns: the globe's camera, and where the reader's hand on it is felt. */
interface Camera {
  flyTo(place: GeoPoint): void;
  zoomTo(distance: number): void;
  readonly on: EventTarget;
}

export interface Follow {
  /** Deep time shows `marks`: turn to the extinction they are of, if it is a new one. */
  at(marks: readonly ExtinctionMark[]): void;
  end(): void;
}

/** The middle of `points` on the globe: their mean direction, so it holds across the date line. */
export function middleOf(points: readonly GeoPoint[]): GeoPoint {
  const radian = Math.PI / 180;
  let [x, y, z] = [0, 0, 0];
  for (const { latitude, longitude } of points) {
    const [la, lo] = [latitude * radian, longitude * radian];
    x += Math.cos(la) * Math.cos(lo);
    y += Math.cos(la) * Math.sin(lo);
    z += Math.sin(la);
  }
  return {
    latitude: Math.atan2(z, Math.hypot(x, y)) / radian,
    longitude: Math.atan2(y, x) / radian,
  };
}

/** How far from an extinction's first cause another may lie and be looked at with it, degrees. */
const TOGETHER = 30;

/**
 * Where to look for an extinction marked by `its`: its first cause and those near it (the
 * Siberian Traps' two places; not the Deccan Traps half a world from Chicxulub), or the middle of
 * its places where none is marked as its cause.
 */
function focusOf(its: readonly ExtinctionMark[]): GeoPoint {
  const causes = its.filter((mark) => mark.site.role === 'cause').map((mark) => mark.point);
  const [first] = causes;
  if (first === undefined) return middleOf(its.map((mark) => mark.point));
  return middleOf(causes.filter((point) => angularDistance(first, point) <= TOGETHER));
}

/** A follow turning `camera`, held off while `watching` (a clock is open). */
export function createFollow(camera: Camera, watching: () => boolean): Follow {
  let following: string | null = null;
  let guide: Guide | null = null;
  const end = (): void => {
    guide?.end();
    guide = null;
    following = null;
  };
  return {
    at(marks) {
      if (watching()) return;
      const id = marks[0]?.extinction.id;
      if (id === undefined) {
        end();
        return;
      }
      if (id !== following) {
        end();
        following = id;
        const place = focusOf(marks.filter((mark) => mark.extinction.id === id));
        guide = createGuide([{ from: -Infinity, place, distance: NEAR_DISTANCE }], {
          camera,
          input: camera.on,
        });
      }
      guide?.at(0);
    },
    end,
  };
}
