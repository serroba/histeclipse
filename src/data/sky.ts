/**
 * Stars and constellation figures for the sky view (`public/data/sky.json`), written by the
 * pipeline's `sky` command from the Yale Bright Star Catalogue and d3-celestial.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const finite = v.pipe(v.number(), v.finite());
const column = <const Item extends v.GenericSchema>(item: Item) => v.array(item);

const SkySchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    sources: v.string(),
    epoch: v.literal(2000),
    stars: v.strictObject({
      /** Harvard Revised (Bright Star Catalogue) number. */
      hr: column(v.pipe(v.number(), v.integer(), v.minValue(1))),
      /** J2000 right ascension and declination, degrees. */
      ra: column(v.pipe(finite, v.minValue(0), v.maxValue(360))),
      dec: column(v.pipe(finite, v.minValue(-90), v.maxValue(90))),
      /** Proper motion in mas/yr: along the great circle (μα cos δ), and in declination. */
      pmRa: column(finite),
      pmDec: column(finite),
      /** Parallax in mas, when measured. */
      parallax: column(v.nullable(finite)),
      /** Radial velocity in km/s, when measured. */
      radialVelocity: column(v.nullable(finite)),
      /** Visual magnitude and B−V colour index. */
      vmag: column(finite),
      bv: column(v.nullable(finite)),
    }),
    constellations: v.array(
      v.strictObject({
        id: v.pipe(v.string(), v.regex(/^[A-Z][A-Za-z]{2}$/)),
        name: v.pipe(v.string(), v.minLength(1)),
        /** 1 for the best-known figures, 3 for the faintest. */
        rank: v.picklist([1, 2, 3]),
        /** Where the name goes: J2000 right ascension and declination, degrees. */
        label: v.tuple([finite, finite]),
        /** The figure, as runs of indices into the star columns. */
        lines: v.array(v.array(v.pipe(v.number(), v.integer(), v.minValue(0)))),
      }),
    ),
  }),
  v.check((sky) => {
    const { hr, ra, dec, pmRa, pmDec, parallax, radialVelocity, vmag, bv } = sky.stars;
    return [ra, dec, pmRa, pmDec, parallax, radialVelocity, vmag, bv].every(
      (values) => values.length === hr.length,
    );
  }, 'star columns must have the same length'),
  v.check(
    (sky) =>
      sky.constellations.every((figure) =>
        figure.lines.every((run) => run.every((star) => star < sky.stars.hr.length)),
      ),
    'figures must point at stars in the catalogue',
  ),
);

export type Sky = v.InferOutput<typeof SkySchema>;
export type Constellation = Sky['constellations'][number];

export async function loadSky(url: string, fetchJson: Fetch): Promise<Sky> {
  return getJson(fetchJson, url, SkySchema);
}
