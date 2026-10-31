/**
 * Full-disk SDO images of the Sun (`public/data/sun-images.json`), written by the pipeline's
 * `sun-images` command: one frame per channel, centred on the Sun with solar north up, the limb
 * at `diskRadius` of the frame's width.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

export const SUN_LAYERS = ['visible', 'magnetogram', '304', '171', '193', '131'] as const;
export type SunLayer = (typeof SUN_LAYERS)[number];

const path = v.pipe(v.string(), v.regex(/^textures\/sun\/[a-z0-9-]+\.webp$/));

const SunImagesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    credit: v.pipe(v.string(), v.minLength(1)),
    diskRadius: v.pipe(v.number(), v.gtValue(0), v.maxValue(0.5)),
    layers: v.array(
      v.strictObject({
        key: v.picklist(SUN_LAYERS),
        label: v.pipe(v.string(), v.minLength(1)),
        description: v.pipe(v.string(), v.minLength(1)),
        /** When SDO took the image, UTC. */
        observed: v.pipe(v.string(), v.isoTimestamp()),
        /** A small frame to show at once, and a sharp one for close up, by width in pixels. */
        files: v.strictObject({ '512': path, '2048': path }),
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
