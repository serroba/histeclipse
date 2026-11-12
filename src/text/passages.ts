/**
 * The site's texts as passages anchored to places and times (#390): the ground the contextual
 * text, word search and search by meaning all stand on (#391, #392, #393).
 *
 * A passage is a piece of text with its sources; an anchor ties it to a body, and where it has
 * them, a point on that body and a span of years. Each anchor carries the view that shows it, as
 * part of a link (`focus=moon&cam=0.67,23.47,1.80&…`), so opening a passage's place is opening a
 * link, read by the same parser as every other (`state/url.ts`). A passage may have many anchors:
 * a record naming an eclipse and a city, a reading disputed between two dates.
 *
 * The passages are written once into `public/data/passages.json` (`passages.build.test.ts`), the
 * one file every reader of them loads, and the one the pipeline embeds for search by meaning.
 */

import * as v from 'valibot';

import type { Craft } from '../data/spacecraft';
import { craftCard } from '../data/craftCard';
import type { FamousEclipse } from '../data/famousEclipses';
import { MOON_NAMES } from '../globe/moonLook';
import type { MoonName } from '../astro/moonOrbits';
import type { LayerChoice } from '../state/layerCatalog';
import { BODIES, LAST_GLACIAL_MAXIMUM_MA, type Body, type Span } from '../state/viewState';
import type { MoonFacts } from './moonFacts';
import type { Why, WhyId } from '../sources/registry';
import { getJson, type Fetch } from '../data/fetchJson';

const PASSAGE_KINDS = ['why', 'moon', 'eclipse', 'landing'] as const;
export type PassageKind = (typeof PASSAGE_KINDS)[number];

const AnchorSchema = v.strictObject({
  body: v.picklist(BODIES),
  /** Latitude and longitude on the body, degrees; on the Moon, selenographic. */
  at: v.optional(
    v.tuple([
      v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
      v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    ]),
  ),
  /** The years it covers, astronomical (0 is 1 BCE; deep time in millions of years before). */
  when: v.optional(v.tuple([v.number(), v.number()])),
  /** The view that shows it: part of a link's query, laid over the view the reader has. */
  view: v.string(),
});
export type Anchor = v.InferOutput<typeof AnchorSchema>;

const PassageSchema = v.strictObject({
  id: v.pipe(v.string(), v.regex(/^[a-z]+:[A-Za-z0-9-]+$/)),
  kind: v.picklist(PASSAGE_KINDS),
  title: v.pipe(v.string(), v.minLength(1)),
  text: v.pipe(v.string(), v.minLength(1)),
  /** The registry's keys for its sources (`sources/registry.ts`). */
  sources: v.array(v.string()),
  /** Its source in words, where the registry does not hold it (a tablet, a chronicle). */
  cite: v.optional(v.string()),
  anchors: v.array(AnchorSchema),
});
export type Passage = v.InferOutput<typeof PassageSchema>;

const PassagesSchema = v.pipe(
  v.strictObject({ schemaVersion: v.literal(1), passages: v.array(PassageSchema) }),
  v.check(
    (document) => new Set(document.passages.map((p) => p.id)).size === document.passages.length,
    'passage ids must be unique',
  ),
);
export type Passages = v.InferOutput<typeof PassagesSchema>;

export async function loadPassages(url: string, fetchJson: Fetch): Promise<Passages> {
  return getJson(fetchJson, url, PassagesSchema);
}

/**
 * The passages, asked for once and shared (by search, and by what is written about here); a
 * failed load is asked for again next time.
 */
export function cachedPassages(url: string, fetchJson: Fetch): () => Promise<readonly Passage[]> {
  let loading: Promise<readonly Passage[]> | null = null;
  return () => {
    loading ??= loadPassages(url, fetchJson).then(
      (loaded) => loaded.passages,
      (error: unknown) => {
        loading = null;
        throw error;
      },
    );
    return loading;
  };
}

/** Where each deep span opens: the last glacial maximum, 540 million years ago, Earth's birth. */
const SPAN_VIEWS: Readonly<Record<Exclude<Span, 'years'>, string>> = {
  ice: `ma=${String(LAST_GLACIAL_MAXIMUM_MA)}&scale=ice`,
  all: 'ma=540&scale=all',
  eons: 'ma=4000&scale=eons',
};

/** The views the whys that are not a layer's show. */
const WHY_SHOWS: Readonly<Partial<Record<WhyId, string>>> = {
  sky: 'mode=sky',
  sun: 'focus=sun',
  moons: 'focus=saturn',
  eclipses: 'layers=lunar,solar',
  'empires-cliopatria': 'layers=empires',
  'empires-ohm': 'layers=empires&borders=ohm',
  'ice-surface': SPAN_VIEWS.ice,
  'deep-surface': SPAN_VIEWS.all,
  'deep-evidence': SPAN_VIEWS.all,
};

/** The whys as passages: what each shows and how, anchored to the view that shows it. */
export function whyPassages(
  whys: Readonly<Record<WhyId, Why>>,
  layers: readonly LayerChoice[],
): Passage[] {
  const byLayer = new Map<string, LayerChoice>(layers.map((layer) => [layer.id, layer]));
  return (Object.entries(whys) as [WhyId, Why][]).map(([id, why]) => {
    const layer = byLayer.get(id);
    const span = layer?.spans[0];
    const deep =
      layer === undefined || span === undefined || span === 'years'
        ? ''
        : layer.arrive === undefined
          ? `&${SPAN_VIEWS[span]}`
          : `&ma=${String(layer.arrive.ma)}&scale=${span}`;
    const shows = layer === undefined ? WHY_SHOWS[id] : `layers=${id}${deep}`;
    const view = [shows, `why=${id}`].filter((part) => part !== undefined).join('&');
    return {
      id: `why:${id}`,
      kind: 'why',
      title: why.title,
      text: [why.what, why.how, why.others].filter((part) => part !== undefined).join(' '),
      sources: [...why.sources],
      anchors: [{ body: 'earth', view }],
    };
  });
}

/** Each moon's story, anchored to the moon. */
export function moonPassages(facts: Readonly<Record<MoonName, MoonFacts>>): Passage[] {
  return (Object.entries(facts) as [MoonName, MoonFacts][]).map(([moon, fact]) => ({
    id: `moon:${moon}`,
    kind: 'moon',
    title: MOON_NAMES[moon],
    text: `${fact.about} Found by ${fact.found}.`,
    sources: [...fact.sources],
    anchors: [{ body: moon, view: `focus=${moon}` }],
  }));
}

/** A date's astronomical year: "-1222-03-05" is 1223 BCE. */
function yearOf(date: string): number {
  return Number(/^-?\d+/.exec(date)?.[0]);
}

/** The famous eclipses: each record, anchored to its day and, where known, its place. */
export function eclipsePassages(eclipses: readonly FamousEclipse[]): Passage[] {
  return eclipses.map((eclipse) => {
    const year = yearOf(eclipse.date);
    const place = eclipse.place;
    const shown = `t=${eclipse.date}&sel=${eclipse.kind}:${eclipse.date}&layers=lunar,solar`;
    const view =
      place === undefined
        ? shown
        : `${shown}&loc=${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}` +
          `&cam=${place.latitude.toFixed(4)},${place.longitude.toFixed(4)},3.00`;
    return {
      id: `eclipse:${eclipse.id}`,
      kind: 'eclipse',
      title: eclipse.title,
      text: [eclipse.summary, eclipse.debateNote].filter((part) => part !== undefined).join(' '),
      sources: [],
      cite: eclipse.source,
      anchors: [
        {
          body: 'earth',
          ...(place === undefined ? {} : { at: [place.latitude, place.longitude] as const }),
          when: [year, year],
          view,
        },
      ],
    };
  });
}

/** GCAT's worlds as the site's bodies; landings elsewhere (an asteroid, a comet) are left out. */
const WORLDS: Readonly<Record<string, Body>> = {
  Luna: 'moon',
  Mercury: 'mercury',
  Venus: 'venus',
  Mars: 'mars',
  Titan: 'titan',
};

/** A day GCAT is sure of, as a link writes it: "1969-07-20T20:17". */
const SURE_DAY = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2})?$/;

/** Each craft that came down where the site can show, anchored to where and when. */
export function landingPassages(craft: readonly Craft[]): Passage[] {
  return craft.flatMap((one) => {
    const landing = one.landing;
    const body = landing === undefined ? undefined : WORLDS[landing.world];
    if (landing === undefined || body === undefined || landing.lat === null) return [];
    if (landing.lon === null) return [];
    // GCAT writes some longitudes from 0 to 360°, or west past −180°; links take −180 to 180°.
    const lon = ((((landing.lon + 180) % 360) + 360) % 360) - 180;
    const card = craftCard(one, true);
    const day = landing.date === null ? null : SURE_DAY.exec(landing.date);
    const year = landing.date === null ? null : yearOf(landing.date);
    const at = `${landing.lat.toFixed(4)},${lon.toFixed(4)}`;
    const time = day === null ? '' : `&t=${day[1] ?? ''}${day[2] ?? 'T12:00'}Z`;
    return [
      {
        id: `landing:${one.id.toLowerCase()}`,
        kind: 'landing',
        title: card.title === one.name ? card.title : `${card.title}: ${one.name}`,
        text: card.facts
          .filter(([fact]) => fact !== 'Path')
          .map(([fact, value]) => `${fact}: ${value}.`)
          .join(' '),
        sources: ['gcat', 'nssdcaChronology'],
        anchors: [
          {
            body,
            at: [landing.lat, lon] as const,
            ...(year === null ? {} : { when: [year, year] as const }),
            view: `focus=${body}&cam=${at},1.80&layers=spacecraft${time}`,
          },
        ],
      },
    ];
  });
}
