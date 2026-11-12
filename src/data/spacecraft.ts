/**
 * Every craft sent beyond Earth orbit, and those that set out but never left (#350):
 * `public/data/spacecraft.json`, written by the pipeline's `spacecraft` command from Jonathan
 * McDowell's GCAT (CC BY 4.0) and NASA NSSDCA's Chronology of Lunar and Planetary Exploration.
 * Each craft has its phases: a stretch about one body (Earth, the Sun, the Moon, a planet),
 * when it began and ended, how it ended, and where it went next. Dates are GCAT's, to the
 * minute where known, ending in "?" where it is unsure.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

/** A GCAT date: "1977", "1979-05", "1977-08-22" or "1977-08-22T08:24", "?" if unsure. */
const When = v.pipe(v.string(), v.regex(/^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2})?)?)?\??$/));

const PhaseSchema = v.tuple([
  v.pipe(v.string(), v.minLength(1)),
  v.nullable(When),
  v.nullable(When),
  v.string(),
  v.string(),
]);

const CraftSchema = v.strictObject({
  id: v.pipe(v.string(), v.regex(/^D\d+$/)),
  name: v.pipe(v.string(), v.minLength(1)),
  cospar: v.string(),
  /** NSSDCA's identifier for its page on the craft, or its carrier's; null where it has none. */
  nssdc: v.nullable(v.string()),
  launchTag: v.string(),
  launch: When,
  owner: v.string(),
  state: v.string(),
  crewed: v.boolean(),
  part: v.boolean(),
  parent: v.nullable(v.string()),
  phases: v.pipe(v.array(PhaseSchema), v.minLength(1)),
  about: v.optional(v.string()),
  mission: v.optional(v.string()),
  landing: v.optional(
    v.strictObject({
      world: v.string(),
      lat: v.nullable(v.number()),
      lon: v.nullable(v.number()),
      date: v.nullable(When),
      site: v.string(),
    }),
  ),
});

const NeverLeftSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1)),
  launch: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}(-\d{2})?$/)),
  about: v.string(),
  nssdc: v.nullable(v.string()),
});

const SpacecraftSchema = v.strictObject({
  schemaVersion: v.literal(1),
  sources: v.strictObject({
    gcat: v.pipe(v.string(), v.url()),
    nssdca: v.pipe(v.string(), v.url()),
  }),
  craft: v.array(CraftSchema),
  neverLeft: v.array(NeverLeftSchema),
});

export type Craft = v.InferOutput<typeof CraftSchema>;
export type CraftPhase = Craft['phases'][number];
export type Spacecraft = v.InferOutput<typeof SpacecraftSchema>;

export async function loadSpacecraft(url: string, fetchJson: Fetch): Promise<Spacecraft> {
  return getJson(fetchJson, url, SpacecraftSchema);
}

/** The bodies a craft went to, in order: the Moon, the planets, comets, asteroids, L points. */
export function destinations(craft: Craft): readonly string[] {
  const out: string[] = [];
  for (const [body] of craft.phases) {
    if (body === 'Earth' || body === 'Sun' || out.includes(body)) continue;
    out.push(body);
  }
  return out;
}
