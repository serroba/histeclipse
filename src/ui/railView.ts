/** What the zoom rail shows for the view (#474). */

import { nearestDistance, type ViewState } from '../state/viewState';
import type { RailView } from './zoomRail';

/**
 * On the globe looked at freely, in the years: the body in focus and how far out. With an
 * eclipse open its own player runs the time, and in deep time the bodies rest, so the rail
 * makes way. It comes down as near as the device lets the camera: nearest over Earth where the
 * graphics take on its tiles (`tiled`).
 */
export function railView(state: ViewState, tiled: boolean): RailView | null {
  if (state.mode !== 'globe' || state.view !== 'free' || state.ma !== null) return null;
  const { focus } = state;
  return { body: focus, distance: state.camera.distance, near: nearestDistance(focus, tiled) };
}
