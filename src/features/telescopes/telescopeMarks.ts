/**
 * The Telescopes layer's ground telescopes in a year (#848): each that was working, or being
 * built, then, at its site; those within a few kilometres of each other (Keck and Subaru on
 * Mauna Kea) gathered on one marker, named together. Their cards, their words, what the layer
 * says it shows.
 *
 * Pure: no DOM.
 */

import { stateIn, type Telescope, type Telescopes } from '../../data/telescopes';
import { telescopeModel } from '../../models/telescopeModels';
import { astronomicalYear, formatYear } from '../../time/year';
import type { CardModel } from '../../ui/markerCard';

type Ground = Extract<Telescope, { kind: 'ground' }>;

/** Telescopes within this many kilometres share a marker. */
const GATHER_KM = 5;
const EARTH_KM = 6371;

export interface TelescopeMark {
  /** What a tap picks: the telescopes' ids, joined. */
  readonly key: string;
  readonly point: { readonly latitude: number; readonly longitude: number };
  readonly telescopes: readonly Ground[];
  /** Whether every telescope on it is still being built. */
  readonly building: boolean;
  /** Its name: one telescope's, or the site's first word and how many. */
  readonly name: string;
}

function kmBetween(a: Ground['site'], b: Ground['site']): number {
  const toRadians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRadians;
  const dLon = (b.longitude - a.longitude) * toRadians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * toRadians) * Math.cos(b.latitude * toRadians) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The ground telescopes working or being built in `year`, gathered by site, in the record's order. */
export function groundMarks(record: Telescopes, year: number): TelescopeMark[] {
  const groups: Ground[][] = [];
  for (const telescope of record.telescopes) {
    if (telescope.kind !== 'ground' || stateIn(telescope, year) === null) continue;
    const near = groups.find((group) => {
      const [first] = group;
      return first !== undefined && kmBetween(first.site, telescope.site) <= GATHER_KM;
    });
    if (near === undefined) groups.push([telescope]);
    else near.push(telescope);
  }
  return groups.flatMap((group) => {
    const [first] = group;
    if (first === undefined) return [];
    return [
      {
        key: group.map((telescope) => telescope.id).join('+'),
        point: { latitude: first.site.latitude, longitude: first.site.longitude },
        telescopes: group,
        building: group.every((telescope) => stateIn(telescope, year) === 'building'),
        name: group.map((telescope) => telescope.name).join(' · '),
      },
    ];
  });
}

export const BAND_WORDS: Readonly<Record<Telescope['bands'][number], string>> = {
  radio: 'radio',
  microwave: 'microwaves',
  infrared: 'infrared',
  optical: 'visible light',
  ultraviolet: 'ultraviolet',
  'x-ray': 'X-rays',
  gamma: 'gamma rays',
};

/** A date as its source gives it, in words: "1897", "February 1845", "21 May 1897". */
export function dateText(date: string): string {
  const [year, month, day] = date.split('-');
  const when = new Date(Date.UTC(Number(year), Number(month ?? 1) - 1, Number(day ?? 1)));
  // All after 1789 CE: a year alone, as the dates with a month read.
  if (month === undefined) return String(year);
  const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric', timeZone: 'UTC' };
  if (day !== undefined) options.day = 'numeric';
  return when.toLocaleDateString('en-GB', options);
}

/** Its end in words. */
function untilText(telescope: Telescope): string {
  const { until } = telescope;
  if (until === 'operating') return 'Still working';
  if (typeof until === 'object') {
    return until.construction === null
      ? 'Being built'
      : `Being built; first light expected ${dateText(until.construction)}`;
  }
  return dateText(until);
}

/** A telescope's model, for its card, if it has one yet (#865). */
function withModel(id: string): { readonly model?: CardModel } {
  const model = telescopeModel(id);
  return model === undefined ? {} : { model };
}

/** A card's facts, links and the others on its site, for `telescope`. */
export function telescopeCard(telescope: Telescope): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly note: string;
  readonly model?: CardModel;
} {
  const where: readonly (readonly [string, string])[] =
    telescope.kind === 'ground'
      ? [['Where', telescope.site.name]]
      : [
          [
            'Orbit',
            telescope.orbit === 'L2' ? 'about L2, 1.5 million km from Earth' : telescope.orbit,
          ],
        ];
  return {
    title: telescope.name,
    facts: [
      ['Sees', telescope.bands.map((band) => BAND_WORDS[band]).join(', ')],
      [
        'Size',
        telescope.size.note === '' ? `${String(telescope.size.metres)} m` : telescope.size.note,
      ],
      [telescope.kind === 'ground' ? 'First light' : 'Launched', dateText(telescope.from)],
      [telescope.kind === 'ground' ? 'Until' : 'Worked until', untilText(telescope)],
      ...where,
      ['Operated by', telescope.operators.join('; ')],
      ...telescope.results.map((result) => ['Known for', result] as const),
    ],
    links: telescope.links,
    note: telescope.why,
    ...withModel(telescope.id),
  };
}

/** What the layer says it shows in `year`. */
export function telescopesText(marks: readonly TelescopeMark[], year: number): string {
  const when = formatYear(astronomicalYear(year));
  const working = marks.flatMap((mark) =>
    mark.telescopes.filter((telescope) => stateIn(telescope, year) === 'working'),
  );
  const building = marks.flatMap((mark) =>
    mark.telescopes.filter((telescope) => stateIn(telescope, year) === 'building'),
  );
  if (working.length === 0 && building.length === 0) {
    return `None of the great telescopes on the ground had seen first light by ${when}: Herschel’s 40-foot was the first of them, in 1789.`;
  }
  const being = building.length === 0 ? '' : `, and ${String(building.length)} being built`;
  return `${String(working.length)} of the great telescopes on the ground working in ${when}${being}; tap one for its card.`;
}
