/**
 * A first visit whose link names no view of its own opens over the reader's region (#451), from
 * the browser's time zone: read here, matched to the tz database's places, sent nowhere. The
 * globe turns there only if the reader has not moved it meanwhile.
 */

import type { Fetch } from '../../data/fetchJson';
import { browserTimeZone, leavesViewOpen, loadTimeZones, placeOfZone } from '../../data/timezones';
import type { Store } from '../../state/store';
import type { GeoPoint, ViewState } from '../../state/viewState';

export function openOverRegion(options: {
  /** The link as the reader opened it. */
  readonly search: string;
  readonly base: string;
  readonly fetchJson: Fetch;
  readonly store: Pick<Store<ViewState>, 'get'>;
  flyTo(place: GeoPoint): void;
}): void {
  const { search, base, fetchJson, store } = options;
  if (!leavesViewOpen(search)) return;
  const zone = browserTimeZone();
  const opened = store.get().camera;
  if (zone === null) return;
  loadTimeZones(`${base}data/timezones.json`, fetchJson).then(
    (zones) => {
      const place = placeOfZone(zones, zone);
      const state = store.get();
      // The scene reports the camera it opened with: only a real move counts as moving it.
      const moved =
        Math.abs(state.camera.target.latitude - opened.target.latitude) > 0.01 ||
        Math.abs(state.camera.target.longitude - opened.target.longitude) > 0.01 ||
        Math.abs(state.camera.distance - opened.distance) > 0.01;
      if (place === null || moved || state.focus !== 'earth') return;
      options.flyTo(place);
    },
    () => {
      // Without the table the globe keeps its usual first view.
    },
  );
}
