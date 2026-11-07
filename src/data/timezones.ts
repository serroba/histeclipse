/**
 * Where each time zone is (`public/data/timezones.json`), from the tz database (IANA, public
 * domain) by the pipeline's `timezones` command: every zone and alias a browser may report, to
 * its zone's representative place. Used once, to open a first visit over the reader's region.
 *
 * The browser's time zone is read here, in the browser, and never sent anywhere.
 */

import * as v from 'valibot';

import type { GeoPoint } from '../state/viewState';
import { getJson, type Fetch } from './fetchJson';

const TimeZonesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.isoDate()),
  zones: v.record(
    v.string(),
    v.tuple([
      v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
      v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    ]),
  ),
});

export type TimeZones = v.InferOutput<typeof TimeZonesSchema>;

export async function loadTimeZones(url: string, fetchJson: Fetch): Promise<TimeZones> {
  return getJson(fetchJson, url, TimeZonesSchema);
}

/** The place of time zone `zone`, or null for one with none (UTC) or one not known. */
export function placeOfZone(data: TimeZones, zone: string): GeoPoint | null {
  const place = data.zones[zone];
  return place === undefined ? null : { latitude: place[0], longitude: place[1] };
}

/** The browser's time zone, or null where it gives none. */
export function browserTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone === '' ? null : zone;
  } catch {
    return null;
  }
}

/**
 * Whether a link leaves the first view to the reader's region: it names no camera, body, view,
 * eclipse or deep-time moment of its own.
 */
export function leavesViewOpen(search: string): boolean {
  const params = new URLSearchParams(search);
  return !['cam', 'focus', 'view', 'sel', 'ma', 'loc'].some((key) => params.has(key));
}
