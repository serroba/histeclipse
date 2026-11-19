/**
 * What El Niño and La Niña usually do to rain and temperature (#891, #892), as
 * `enso-composites/` has it: for each of NOAA's two indices, each phase and each season
 * (December–February, June–August), the mean of the seasons the index names so, of each place's
 * departure from its own trend; one image each on the 1° grid, 90°N first, 180°W first: R the
 * composite from −bound to +bound, B 255 where it is significant at 10%, A 255 where there is
 * data. Rain from GPCP (from 1979), temperature from Berkeley Earth (from 1950).
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const text = v.pipe(v.string(), v.minLength(1));
const year = v.pipe(v.number(), v.integer());

const VariableSchema = v.strictObject({
  id: v.picklist(['rain', 'temperature']),
  label: text,
  units: text,
  bound: v.pipe(v.number(), v.minValue(0.1)),
  years: v.tuple([year, year]),
  sourceId: text,
  credit: text,
  source: v.pipe(v.string(), v.url()),
  licence: text,
});

const MapSchema = v.strictObject({
  variable: v.picklist(['rain', 'temperature']),
  index: text,
  phase: v.picklist(['elNino', 'laNina']),
  season: v.picklist(['djf', 'jja']),
  file: v.pipe(v.string(), v.regex(/^[a-zA-Z-]+\.png$/u)),
  seasons: v.pipe(v.number(), v.integer(), v.minValue(0)),
  years: v.array(year),
  significantShare: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
});

const CompositesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  accessed: text,
  method: text,
  encoding: text,
  variables: v.pipe(v.array(VariableSchema), v.minLength(1)),
  maps: v.pipe(v.array(MapSchema), v.minLength(1)),
});

export type EnsoComposites = v.InferOutput<typeof CompositesSchema>;
export type CompositeVariable = EnsoComposites['variables'][number];
export type CompositeMap = EnsoComposites['maps'][number];
type Season = CompositeMap['season'];

export async function loadEnsoComposites(url: string, fetchJson: Fetch): Promise<EnsoComposites> {
  return getJson(fetchJson, url, CompositesSchema);
}

/** What is picked: a variable, phase and season; the index is picked apart. */
export interface CompositePick {
  readonly variable: CompositeMap['variable'];
  readonly phase: CompositeMap['phase'];
  readonly season: Season;
}

/** The map for a pick and an index, if there is one. */
export function compositeFor(
  composites: EnsoComposites,
  pick: CompositePick,
  index: string,
): CompositeMap | null {
  return (
    composites.maps.find(
      (map) =>
        map.variable === pick.variable &&
        map.phase === pick.phase &&
        map.season === pick.season &&
        map.index === index,
    ) ?? null
  );
}

const PHASE_WORDS = { elNino: 'El Niño', laNina: 'La Niña' } as const;
const SEASON_WORDS: Readonly<Record<Season, string>> = {
  djf: 'December–February',
  jja: 'June–August',
};

/** Every pick there is, named in words (`Rain, El Niño, December–February`): variables first. */
export function pickOptions(
  composites: EnsoComposites,
): { readonly pick: CompositePick; readonly label: string }[] {
  return composites.variables.flatMap((variable) =>
    (['elNino', 'laNina'] as const).flatMap((phase) =>
      (['djf', 'jja'] as const).map((season) => ({
        pick: { variable: variable.id, phase, season },
        label: `${variable.label}, ${PHASE_WORDS[phase]}, ${SEASON_WORDS[season]}`,
      })),
    ),
  );
}

/**
 * A composite in words: what it is, how many seasons it rests on and which years, how much of
 * it is significant; and how the other indices' lists of seasons differ.
 */
export function compositeText(
  composites: EnsoComposites,
  map: CompositeMap,
  indexName: (id: string) => string,
): string {
  const variable = composites.variables.find(({ id }) => id === map.variable);
  const label = variable === undefined ? map.variable : variable.label;
  const head = `${label} in ${PHASE_WORDS[map.phase]}’s ${SEASON_WORDS[map.season]}, by ${indexName(map.index)}`;
  if (map.seasons === 0) return `${head}: no such season in the years used.`;
  const years = map.years.length === 1 ? String(map.years[0]) : listYears(map.years);
  const significant =
    map.significantShare === null
      ? ''
      : ` ${String(Math.round(map.significantShare * 100))}% of it is significant at 10%; the rest is faded.`;
  const others = composites.maps
    .filter(
      (other) =>
        other.index !== map.index &&
        other.variable === map.variable &&
        other.phase === map.phase &&
        other.season === map.season,
    )
    .map((other) => {
      const apart =
        other.years.filter((each) => !map.years.includes(each)).length +
        map.years.filter((each) => !other.years.includes(each)).length;
      const same = apart === 0 ? 'the same ones' : `${String(apart)} differing`;
      return ` ${indexName(other.index)} names ${String(other.seasons)}, ${same}.`;
    })
    .join('');
  return `${head}: the mean of ${String(map.seasons)} season${map.seasons === 1 ? '' : 's'} (${years}), each place against its own trend.${significant}${others}`;
}

/** Years in a list, the middle ones left out when there are many: `1983, 1987, … 2016`. */
function listYears(years: readonly number[]): string {
  if (years.length <= 6) return years.join(', ');
  return `${years.slice(0, 3).join(', ')}, … ${years.slice(-2).join(', ')}`;
}

/** The composite a byte stands for: 0 is −bound, 255 is +bound. */
export function compositeOf(byte: number, bound: number): number {
  return -bound + (byte / 255) * 2 * bound;
}

type Rgb = readonly [number, number, number];

const PALE: Rgb = [245, 243, 238];
/** Rain's own scale (#530): brown where drier, green-blue where wetter; never temperature's. */
const DRIER: Rgb = [140, 81, 10];
const WETTER: Rgb = [1, 110, 100];
const COOLER: Rgb = [35, 85, 205];
const WARMER: Rgb = [205, 35, 25];

/** How opaque a value is drawn where it is not significant, against where it is. */
const NOT_SIGNIFICANT = 0.35;

function mix(from: Rgb, to: Rgb, share: number): Rgb {
  const step = (a: number, b: number): number => Math.round(a + (b - a) * share);
  return [step(from[0], to[0]), step(from[1], to[1]), step(from[2], to[2])];
}

/** The scale's two ends for a variable, low first: for the legend and the map alike. */
export function scaleEnds(variable: CompositeVariable['id']): readonly [Rgb, Rgb] {
  return variable === 'rain' ? [DRIER, WETTER] : [COOLER, WARMER];
}

/**
 * Colour each pixel of a packed composite (RGBA bytes): its hue by sign on the variable's own
 * scale, its strength by size against the bound, faded where not significant, nothing where
 * there is no data.
 */
export function compositeColours(
  packed: Uint8ClampedArray,
  bound: number,
  variable: CompositeVariable['id'],
): Uint8ClampedArray {
  const [low, high] = scaleEnds(variable);
  const out = new Uint8ClampedArray(packed.length);
  const bytes = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  for (let at = 0; at + 3 < packed.length; at += 4) {
    if (bytes.getUint8(at + 3) === 0) continue;
    const value = compositeOf(bytes.getUint8(at), bound);
    const strength = Math.min(1, Math.abs(value) / bound);
    const [r, g, b] = mix(PALE, value < 0 ? low : high, Math.sqrt(strength));
    const significant = bytes.getUint8(at + 2) > 127;
    out.set(
      [r, g, b, Math.round(255 * (0.3 + 0.6 * strength) * (significant ? 1 : NOT_SIGNIFICANT))],
      at,
    );
  }
  return out;
}

/** Where a place's node is in a packed map's bytes: the 1° grid, 90°N first, 180°W first. */
export function nodeOffset(latitude: number, longitude: number, columns = 361): number {
  const row = Math.round(90 - Math.max(-90, Math.min(90, latitude)));
  const column = Math.round((((longitude + 180) % 360) + 360) % 360);
  return (row * columns + column) * 4;
}

/** The season a month (1–12) leans to: October–March December–February, else June–August. */
export function seasonOf(month: number): Season {
  return month >= 4 && month <= 9 ? 'jja' : 'djf';
}

/** One composite read at a place: its value (null without data) and whether it is significant. */
export interface HereReading {
  readonly variable: CompositeMap['variable'];
  readonly phase: CompositeMap['phase'];
  readonly index: string;
  readonly value: number | null;
  readonly significant: boolean;
}

/** A composite's value and significance at a byte offset of its packed bytes. */
export function readingAt(
  pixels: Uint8ClampedArray,
  offset: number,
  bound: number,
): Pick<HereReading, 'value' | 'significant'> {
  const bytes = new DataView(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  if (offset + 3 >= pixels.length || bytes.getUint8(offset + 3) === 0) {
    return { value: null, significant: false };
  }
  return {
    value: compositeOf(bytes.getUint8(offset), bound),
    significant: bytes.getUint8(offset + 2) > 127,
  };
}

const signed = (value: number, digits: number): string =>
  `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(digits)}`;

/**
 * For "Why here?" (#893): what El Niño and La Niña usually bring to a place in a season, by each
 * index, from the composites: each variable's value, or "no clear signal" where it is not
 * significant; null where no composite has data there.
 */
export function hereText(
  composites: EnsoComposites,
  season: Season,
  readings: readonly HereReading[],
  indexName: (id: string) => string,
): string | null {
  if (readings.every(({ value }) => value === null)) return null;
  const indices = [...new Set(readings.map(({ index }) => index))];
  const phases = (['elNino', 'laNina'] as const).map((phase) => {
    const each = indices.map((index) => {
      const values = composites.variables.flatMap((variable) => {
        const found = readings.find(
          (reading) =>
            reading.phase === phase && reading.index === index && reading.variable === variable.id,
        );
        if (found?.value === undefined || found.value === null) return [];
        const name = variable.label.toLowerCase();
        return [
          found.significant
            ? `${name} ${signed(found.value, 2)} ${variable.units}`
            : `${name} no clear signal`,
        ];
      });
      return `by ${indexName(index)}, ${values.join(', ')}`;
    });
    return `${PHASE_WORDS[phase]} ${each.join('; ')}`;
  });
  return `What El Niño and La Niña have usually brought here in ${SEASON_WORDS[season]}, against the trend: ${phases.join('. ')}.`;
}
