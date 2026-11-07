/**
 * Maps of the whole Sun from SDO (`public/data/sun-images.json`), written by the pipeline's
 * `sun-images` command. For each channel, frames taken about a week apart are stitched into one
 * equirectangular map in heliographic coordinates: latitude from the Sun's equator (north at the
 * top) and longitude from the central meridian seen from Earth at the newest frame, growing
 * toward the west limb, 0 in the middle of the map. The newest frame is kept too, centred on the
 * Sun with solar north up and the limb at `diskRadius` of its width: beyond the limb it shows
 * the corona.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

export const SUN_LAYERS = ['visible', 'magnetogram', '304', '171', '193', '131'] as const;
export type SunLayer = (typeof SUN_LAYERS)[number];

const path = v.pipe(v.string(), v.regex(/^textures\/sun\/[a-z0-9-]+\.webp$/));
const moment = v.pipe(v.string(), v.isoTimestamp());

const SunImagesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(3),
    credit: v.pipe(v.string(), v.minLength(1)),
    diskRadius: v.pipe(v.number(), v.gtValue(0), v.maxValue(0.5)),
    layers: v.array(
      v.strictObject({
        key: v.picklist(SUN_LAYERS),
        /** What the channel shows, such as "Chromosphere"; the light it is beneath (#249). */
        label: v.pipe(v.string(), v.minLength(1)),
        detail: v.pipe(v.string(), v.minLength(1)),
        description: v.pipe(v.string(), v.minLength(1)),
        /** When SDO took each frame in the map, UTC, oldest first; the last is the disc's. */
        frames: v.pipe(
          v.array(moment),
          v.minLength(1),
          v.check(
            (frames) => frames.every((frame, i) => i === 0 || elementAt(frames, i - 1) < frame),
            'frames are in time order',
          ),
        ),
        /** The map, small to show at once and sharp for close up, by width in pixels. */
        map: v.strictObject({ '512': path, '4096': path }),
        /** The newest frame, for the corona around the limb. */
        disc: v.strictObject({ '512': path, '2048': path }),
      }),
    ),
  }),
  v.check(
    (images) => new Set(images.layers.map(({ key }) => key)).size === images.layers.length,
    'each channel appears once',
  ),
);

export type SunImages = v.InferOutput<typeof SunImagesSchema>;
export type SunImage = SunImages['layers'][number];

export async function loadSunImages(url: string, fetchJson: Fetch): Promise<SunImages> {
  return getJson(fetchJson, url, SunImagesSchema);
}

/** The days of a layer's first and last frames, such as "18 Apr 2024" and "08 May 2024". */
export function frameSpan(image: SunImage): readonly [first: string, last: string] {
  const day = (iso: string): string => new Date(iso).toUTCString().slice(5, 16);
  return [day(elementAt(image.frames, 0)), day(elementAt(image.frames, image.frames.length - 1))];
}
