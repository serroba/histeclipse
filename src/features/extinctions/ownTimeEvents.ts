/**
 * The extinctions that can be watched in their own time (#1191, #1192): the end-Cretaceous as
 * Chicxulub's strike on its log clock, and the end-Permian as the Siberian Traps fuming on the
 * crisis clock, each where the plates had its place at the moment shown.
 */

import { CRISIS_SCALE } from '../../deepTime/crisisClock';
import { siteThen, type ExtinctionSites } from '../../data/extinctions';
import type { GeoPoint } from '../../core/geo';
import { impactPlay, strikeEvent, strikePhasesOf } from '../impacts';
import type { OwnTimeEvent } from '../ownTime';
import { fumesLayer } from './fumesLayer';
import { END_PERMIAN } from './permianPhases';

/** Chicxulub's final crater, km, as the Impact Earth Database gives it. */
const CHICXULUB_KM = 180;
/** How far out the end-Permian is watched from: the traps and the haze over the globe. */
const PERMIAN_DISTANCE = 2.3;
/** How far out Chicxulub is watched from: far enough to see its front cross the globe (#1167). */
const STRIKE_DISTANCE = 3.4;

/** `event`, the globe first turned to `place` and drawn back to `distance`. */
function facing(event: OwnTimeEvent, place: GeoPoint, distance: number): OwnTimeEvent {
  return {
    ...event,
    play(tools) {
      tools.strikes.flyTo(place);
      tools.strikes.zoomTo(distance);
      return event.play(tools);
    },
  };
}

/** The end-Permian, the Siberian Traps fuming at `center`. */
function permianEvent(center: GeoPoint): OwnTimeEvent {
  return {
    key: 'end-permian-extinction',
    title: 'The end-Permian, in its own time',
    phases: END_PERMIAN,
    scale: CRISIS_SCALE,
    offer: 'Watch the end-Permian in its own time',
    play(tools) {
      const fumes = tools.layer(fumesLayer);
      return {
        at(seconds) {
          fumes.update({ center, seconds });
        },
        end() {
          fumes.update(null);
        },
      };
    },
  };
}

/** The place `site` lay at `ma`, if it is in the data and on a plate then. */
function placeOf(data: ExtinctionSites, site: string, ma: number): GeoPoint | null {
  const found = data.sites.find((each) => each.id === site);
  return found === undefined ? null : siteThen(data, found, ma);
}

/** The extinction `id`'s own time at `ma`, if it has one. */
export function ownTimeOf(data: ExtinctionSites, id: string, ma: number): OwnTimeEvent | null {
  if (id === 'end-permian-extinction') {
    const center = placeOf(data, 'siberian-traps', ma);
    if (center === null) return null;
    // Seen from the south, at a slant, so the plumes are seen rising.
    const from = { latitude: center.latitude - 4, longitude: center.longitude };
    return facing(permianEvent(center), from, PERMIAN_DISTANCE);
  }
  const phases = strikePhasesOf('Chicxulub');
  if (id !== 'k-pg-extinction' || phases === null) return null;
  const place = placeOf(data, 'chicxulub', ma);
  if (place === null) return null;
  const strike = strikeEvent(impactPlay('Chicxulub', place, CHICXULUB_KM), phases);
  return facing(strike, place, STRIKE_DISTANCE);
}
