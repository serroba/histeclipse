/**
 * What the spacecraft layer's front needs to know without its body (#220): what it asks for, and
 * the views that change what it draws.
 */

import type { ViewState } from '../../state/viewState';

export const NEEDS = ['cards', 'anchors', 'ephemerides', 'zoomRail'] as const;
export type SpacecraftNeeds = (typeof NEEDS)[number];

/** From further off than this, in Earth's radii, a craft in Earth orbit sits on Earth. */
const CLOSE_ON_EARTH = 25;

/**
 * Whether Earth is close up: its orbiting craft can be told from it. On a craft about Earth
 * (#796), whose own few metres the distance is in, they are drawn too.
 */
export function closeOnEarth(state: ViewState): boolean {
  return state.focus === 'earth' && (state.on !== null || state.camera.distance <= CLOSE_ON_EARTH);
}

/**
 * Nearer than this, in the craft's radii, its model is a few pixels across or more (some 4 at
 * 300 radii, with the view's 40°), and it is drawn as its model alone.
 */
const SEEN_AS_MODEL = 300;

/** Whether the camera is on a craft close enough to see its model, in its radii `distance`. */
export function seesModel(craft: string | null, distance: number): boolean {
  return craft !== null && distance < SEEN_AS_MODEL;
}
