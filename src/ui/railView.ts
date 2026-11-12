/** What the zoom rail shows for the view (#474). */

import type { ViewState } from '../state/viewState';
import type { RailView } from './zoomRail';

/**
 * On the globe looked at freely, in the years: the body in focus and how far out. With an
 * eclipse open its own player runs the time, and in deep time the bodies rest, so the rail
 * makes way.
 */
export function railView(state: ViewState): RailView | null {
  if (state.mode !== 'globe' || state.view !== 'free' || state.ma !== null) return null;
  return { body: state.focus, distance: state.camera.distance };
}
