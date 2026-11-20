/**
 * Where a name in space can go (#997): beside its dot, to the right, or to the left where the
 * right is taken; clear of the panels, of the zoom rail's column at the right, of the bodies'
 * names and of the names already placed. A craft at L2 seen behind Earth had its long name drawn
 * over "Earth and Moon" and on into the rail's labels.
 */

import { clearOf, type Box } from './spaceFrame';

/** Pixels at the view's right that the zoom rail's buttons take: names keep out of them. */
export const RAIL_COLUMN = 72;

/** The view a name goes in: its size, and the panels' cover at the top and bottom, px. */
export interface NameRoom {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly bottom: number;
}

/** A body marker's name: 0.75rem, beside its ring (`spaceMarkers.css`), as wide as its letters. */
const MARKER_CHAR = 6.8;
const MARKER_HEIGHT = 16;
const MARKER_GAP = 8;

/**
 * The box a body marker's name covers, its ring centred at (`x`, `y`), `radius` px: the name
 * beside the ring, not the ring, which a craft's name may cross (Hubble on Earth's limb).
 */
export function markerNameBox(x: number, y: number, radius: number, name: string): Box {
  return {
    x: x + radius + MARKER_GAP,
    y: y - MARKER_HEIGHT / 2,
    w: name.length * MARKER_CHAR,
    h: MARKER_HEIGHT,
  };
}

/** Whether `box` is in the room: on screen, between the panels, left of the rail's column. */
function inRoom(box: Box, room: NameRoom): boolean {
  return (
    box.x >= 0 &&
    box.x + box.w <= room.width - RAIL_COLUMN &&
    box.y >= room.top &&
    box.y + box.h <= room.height - room.bottom
  );
}

/**
 * Where a name `w` by `h` goes, for a dot at (`x`, `y`): to its right, else its left; failing
 * both, the same a line above, then a line below, as the names on Earth's surface do. Each where
 * the box is in the room and clear of `taken`; null where none is. The box is added to `taken`.
 */
export function fitName(
  x: number,
  y: number,
  size: { readonly width: number; readonly height: number },
  room: NameRoom,
  taken: Box[],
): { readonly box: Box; readonly left: boolean; readonly lift: number } | null {
  for (const lift of [0, -size.height, size.height]) {
    for (const left of [false, true]) {
      const box = {
        x: left ? x - size.width : x,
        y: y + lift - size.height / 2,
        w: size.width,
        h: size.height,
      };
      if (inRoom(box, room) && clearOf(box, taken)) {
        taken.push(box);
        return { box, left, lift };
      }
    }
  }
  return null;
}
