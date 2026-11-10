/**
 * Every layer the reader can lay over the globe, in one set for all of time: grouped by what
 * they show, each with the spans it draws on and how far its data reaches, and what it says
 * when the moment shown lies outside its data.
 */

import { astronomicalYear, formatYear } from '../time/year';
import { SPAN_LABELS, type BorderSource, type Layer, type Span } from './viewState';

export interface LayerChoice {
  readonly id: Layer;
  readonly label: string;
  readonly about: string;
  /** The spans of time it draws on. */
  readonly spans: readonly Span[];
  /** How far its data reaches, said where it draws nothing. */
  readonly reach: string;
  /** Where going to its span lands, when somewhere is better than the span's present end. */
  readonly arrive?: { readonly ma: number; readonly label: string };
}

export interface LayerGroup {
  readonly name: string;
  readonly layers: readonly LayerChoice[];
}

/** What radiocarbon cannot reach, and what dates older things instead. */
export const CARBON_LIMIT =
  'After about 50,000 years too little carbon-14 is left to measure, so older things are dated by other clocks, such as potassium–argon and uranium–lead.';

const DEEP: readonly Span[] = ['ice', 'all', 'eons'];

export const LAYER_GROUPS: readonly LayerGroup[] = [
  {
    name: 'People',
    layers: [
      {
        id: 'empires',
        label: 'States and empires',
        about:
          'Borders from Cliopatria or OpenHistoricalMap, or both to compare: OpenHistoricalMap’s names in italics, and a state both name nearby named once, underlined with dots.',
        spans: ['years'],
        reach: 'From 3400 BCE (Cliopatria) or 4000 BCE (OpenHistoricalMap) to today.',
      },
      {
        id: 'ways',
        label: 'Ways of life',
        about:
          'How people lived by region, as archaeologists rated it (ArchaeoGLOBE): foraging, herding, farming, towns.',
        spans: ['years'],
        reach: 'From 10,000 years ago to 1850 CE, rated at ten moments.',
      },
      {
        id: 'periods',
        label: 'Named periods',
        about:
          'The archaeological and historical periods named for the place picked, each by its source (PeriodO).',
        spans: ['years'],
        reach: 'Periods of the last 11,700 years.',
      },
      {
        id: 'dates',
        label: 'Radiocarbon dates',
        about:
          'Where archaeologists have dated remains by carbon-14 (p3k14c), calibrated and counted by square and 250 years: where dates were measured, not how many people lived. Pick a place to see how one was dated.',
        spans: ['years'],
        reach: 'From 10,550 BCE (12,500 years before 1950) to 1950.',
      },
      {
        id: 'genomes',
        label: 'Ancient genomes',
        about:
          'Dated ancient DNA from the Allen Ancient DNA Resource (Reich lab), counted by region within 250 years.',
        spans: ['years'],
        reach: 'Genomes dated within the last 11,700 years, year by year.',
      },
      {
        id: 'humans',
        label: 'Humans',
        about:
          'Dated finds of our species and its relatives, with competing dates side by side, and dispersal models.',
        spans: ['ice'],
        reach: 'Finds of the last few hundred thousand years.',
        // The earliest Homo sapiens, Jebel Irhoud's 281–349 ka (Hublin et al. 2017), as the
        // milestone has it.
        arrive: { ma: 0.315, label: 'the earliest Homo sapiens' },
      },
    ],
  },
  {
    name: 'Earth and life',
    layers: [
      {
        id: 'rocks',
        label: 'Rocks at the surface',
        about:
          'How old the rocks at the surface are, from Macrostrat; pick a place to see its rock, then the Earth when it formed.',
        spans: ['years'],
        reach: 'Today’s surface, shown in the years.',
      },
      {
        id: 'plates',
        label: 'Plates',
        about: 'A second reconstruction’s continents, outlined over the first.',
        spans: DEEP,
        reach: 'Back to 1,800 million years ago.',
      },
      {
        id: 'fossils',
        label: 'Fossils',
        about:
          'Fossils of four groups of animals from the Paleobiology Database, where they lay then.',
        spans: ['all'],
        reach: 'Counted by 5 million years over the last 540 million.',
      },
      {
        id: 'impacts',
        label: 'Impact craters',
        about:
          'Craters and deposits left by asteroids and comets, from the Impact Earth Database; tap one for its details.',
        spans: ['years', 'ice', 'all'],
        reach: 'Where they lie today, or where the plates had them, back 540 million years.',
      },
      {
        id: 'volcanoes',
        label: 'Volcanic eruptions',
        about:
          'Eruptions dated near the year shown, sized by explosivity, from the Smithsonian’s Global Volcanism Program; tap one for its details.',
        spans: ['years'],
        reach: 'Eruptions of the last 11,700 years.',
      },
    ],
  },
  {
    name: 'Climate and air',
    layers: [
      {
        id: 'temperature',
        label: 'Temperature',
        about: 'The surface coloured by its temperature, model by model.',
        spans: ['all', 'eons'],
        reach: 'Maps every 5 million years, back 540 million years.',
      },
      {
        id: 'sealevel',
        label: 'Sea level',
        about: 'Sea level through time, as each reconstruction has it, on a chart.',
        spans: DEEP,
        reach: 'Reconstructions in deep time.',
      },
      {
        id: 'air',
        label: 'Air',
        about:
          'Carbon dioxide and methane from the ice cores; carbon dioxide and oxygen from proxies.',
        spans: ['ice', 'all'],
        reach: 'Ice cores over 800,000 years; proxies over 540 million years.',
      },
      {
        id: 'radiocarbon',
        label: 'Carbon-14 in the air',
        about:
          'How much radiocarbon the air held each year, under the years’ slider: its sudden spikes and its plateaus, and why a radiocarbon date is a range.',
        spans: ['years'],
        reach: 'The calibration curves reach back 55,000 years, to 1950.',
      },
      {
        id: 'carbonMade',
        label: 'Carbon-14 made in the sky',
        about:
          'Where cosmic rays make carbon-14, high in the air: most over the poles, where Earth’s magnetic field shields least. Try another field or Sun, and follow it into living things.',
        spans: ['years', 'ice'],
        reach: `${CARBON_LIMIT} Drawn on the Years and Ice ages spans, for the last 50,000 years.`,
      },
    ],
  },
  {
    name: 'Sky and events',
    layers: [
      {
        id: 'solar',
        label: 'Eclipse shadows',
        about: 'The Moon’s shadow and path on Earth, for a solar eclipse.',
        spans: ['years'],
        reach: 'With a solar eclipse picked, in the years.',
      },
      {
        id: 'lunar',
        label: 'Moon in Earth’s shadow',
        about: 'Where on Earth an eclipsed Moon was up, for a lunar eclipse.',
        spans: ['years'],
        reach: 'With a lunar eclipse picked, in the years.',
      },
      {
        id: 'orbits',
        label: 'Planets’ orbits',
        about:
          'The paths of Earth and the five bright planets around the Sun, drawn when the view is far out or on the Sun or a planet.',
        spans: ['years'],
        reach: 'In the years, seen from far out.',
      },
      {
        id: 'spacecraft',
        label: 'Spacecraft',
        about:
          'Every craft sent beyond Earth orbit since 1959, where it was at the moment shown, flying as the time plays; a tap on its name for its story.',
        spans: ['years'],
        reach: 'In the years, from Luna 1 in January 1959 to today.',
      },
      {
        id: 'asteroids',
        label: 'Asteroid belt',
        about:
          'The main belt’s asteroids at least 100 km across, some two hundred, going round the Sun between Mars and Jupiter; the largest named, a tap on a name for its card.',
        spans: ['years'],
        reach: 'In the years: where each is, closely from 1600 to 2500, roughly beyond.',
      },
    ],
  },
];

/** The spans' names, joined as a reader would say them. */
function spanList(spans: readonly Span[]): string {
  const names = spans.map((span) => SPAN_LABELS[span]);
  const last = names.pop();
  return names.length === 0 ? (last ?? '') : `${names.join(', ')} and ${last ?? ''}`;
}

/** What a layer says on a span it does not draw on: where it does, and how far it reaches. */
export function elsewhereNote(choice: LayerChoice): string {
  const where =
    choice.spans.length === 1
      ? `the ${spanList(choice.spans)} span`
      : `the ${spanList(choice.spans)} spans`;
  return `Nothing here: drawn on ${where}. ${choice.reach}`;
}

interface BorderSpan {
  readonly name: string;
  /** First and last astronomical years with borders. */
  readonly from: number;
  readonly to: number;
}

/** Cliopatria's latest year. Its borders then stand for the years since, up to the present. */
export const CLIOPATRIA_LATEST = 2024;

/** The years each source of borders covers: Cliopatria 3400 BCE–2024, its files' reach. */
const BORDER_SPANS: Readonly<Record<'cliopatria' | 'ohm', BorderSpan>> = {
  cliopatria: { name: 'Cliopatria', from: -3399, to: CLIOPATRIA_LATEST },
  ohm: { name: 'OpenHistoricalMap', from: -4000, to: 2099 },
};

/** The year whose Cliopatria borders show in `year`: its own, or 2024's from then to `present`. */
export function cliopatriaYear(year: number, present: number): number {
  return year > CLIOPATRIA_LATEST && year <= present ? CLIOPATRIA_LATEST : year;
}

function sourcesOf(borders: BorderSource, present: number): readonly BorderSpan[] {
  // Cliopatria's latest borders carry on to the present.
  const cliopatria = {
    ...BORDER_SPANS.cliopatria,
    to: Math.max(BORDER_SPANS.cliopatria.to, present),
  };
  if (borders === 'both') return [cliopatria, BORDER_SPANS.ohm];
  return borders === 'ohm' ? [BORDER_SPANS.ohm] : [cliopatria];
}

/** What a layer says at `year`, a year in `present`, when it has nothing to draw there or draws
 * another year's; null when it draws its own. */
export function layerNote(
  layer: Layer,
  year: number,
  borders: BorderSource,
  present: number,
): string | null {
  if (layer !== 'empires') return null;
  const spans = sourcesOf(borders, present);
  const earliest = spans.reduce((first, span) => (span.from < first.from ? span : first));
  if (year < earliest.from) {
    return `Nothing to draw yet: ${earliest.name} begins in ${formatYear(astronomicalYear(earliest.from))}.`;
  }
  const latest = spans.reduce((last, span) => (span.to > last.to ? span : last));
  if (year > latest.to) {
    const end = latest === BORDER_SPANS.ohm ? latest.to : CLIOPATRIA_LATEST;
    return `Nothing to draw: ${latest.name} ends in ${formatYear(astronomicalYear(end))}.`;
  }
  if (borders !== 'ohm' && cliopatriaYear(year, present) !== year) {
    return `Borders as of ${formatYear(astronomicalYear(CLIOPATRIA_LATEST))}, Cliopatria’s latest year.`;
  }
  return null;
}
