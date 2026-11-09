/**
 * A craft's card (#350): its mission, when it set out and whose it was, where it went, how it
 * ended as NASA's chronology tells it, and how its path is drawn. GCAT's codes become plain
 * words; its record is credited, as its licence asks (CC BY 4.0).
 */

import { elementAt } from '../util/arrays';
import type { Craft } from './spacecraft';
import { destinations } from './spacecraft';

/** GCAT's country codes, as the craft in the record use them. */
const COUNTRIES: Readonly<Record<string, string>> = {
  US: 'United States',
  SU: 'Soviet Union',
  RU: 'Russia',
  J: 'Japan',
  CN: 'China',
  'I-ESA': 'European Space Agency',
  IN: 'India',
  D: 'Germany',
  I: 'Italy',
  L: 'Luxembourg',
  UAE: 'United Arab Emirates',
  UK: 'United Kingdom',
  IL: 'Israel',
  KR: 'South Korea',
  PK: 'Pakistan',
  UY: 'Uruguay',
  F: 'France',
};

/** GCAT's names for where a craft went, as a reader knows them. */
const PLACES: Readonly<Record<string, string>> = {
  Luna: 'the Moon',
  SEL1: 'the Sun–Earth L1 point',
  SEL2: 'the Sun–Earth L2 point',
  EML1: 'the Earth–Moon L1 point',
  EML2: 'the Earth–Moon L2 point',
  '67P/': 'comet 67P/Churyumov–Gerasimenko',
  '81P/Wild 2': 'comet 81P/Wild 2',
  '9P/Tempel 1': 'comet 9P/Tempel 1',
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A GCAT date as written: "20 August 1977", "May 1979", "1979"; "about" where unsure. */
export function writtenDate(text: string): string {
  const unsure = text.endsWith('?');
  const [date = ''] = text.replace('?', '').split('T');
  const [year = '', month, day] = date.split('-');
  const named = month === undefined ? '' : elementAt(MONTHS, Number(month) - 1);
  const out =
    day !== undefined
      ? `${String(Number(day))} ${named} ${year}`
      : month !== undefined
        ? `${named} ${year}`
        : year;
  return unsure ? `about ${out}` : out;
}

/** A list in words: "Jupiter, Saturn and Uranus". */
function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${elementAt(items, items.length - 1)}`;
}

export interface CraftCard {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly note: string;
}

/** The card for a craft, and whether its path is Horizons's or approximate. */
export function craftCard(craft: Craft, approximate: boolean): CraftCard {
  const went = destinations(craft).map((place) => PLACES[place] ?? place);
  const country = COUNTRIES[craft.state] ?? craft.state;
  const facts: [string, string][] = [
    ['Set out', writtenDate(craft.launch)],
    ['Whose', `${country} (${craft.owner})`],
  ];
  if (craft.mission !== undefined && craft.mission !== craft.name)
    facts.push(['Craft', craft.name]);
  if (went.length > 0) facts.push(['Went to', listed(went)]);
  if (craft.about !== undefined) facts.push(['Mission', craft.about]);
  if (craft.crewed) facts.push(['Crew', 'Crewed']);
  if (craft.landing !== undefined) {
    const where = PLACES[craft.landing.world] ?? craft.landing.world;
    const when = craft.landing.date === null ? '' : `, ${writtenDate(craft.landing.date)}`;
    facts.push([
      'Came down',
      `on ${where}${craft.landing.site === '-' ? '' : `, ${craft.landing.site}`}${when}`,
    ]);
  }
  facts.push([
    'Path',
    approximate
      ? 'Approximate: each leg as the transfer orbit between where it left and where it arrived, as first planned, not as flown'
      : 'As flown, from JPL Horizons',
  ]);
  const links = [
    {
      label: 'NASA NSSDCA',
      href: `https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=${encodeURIComponent(craft.cospar)}`,
    },
  ];
  return {
    title: craft.mission ?? craft.name,
    facts,
    links,
    note: 'Record: GCAT, Jonathan McDowell, planet4589.org (CC BY 4.0); NASA NSSDCA’s Chronology of Lunar and Planetary Exploration.',
  };
}
