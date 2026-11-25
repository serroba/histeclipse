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
 * The passages are written once into `public/data/passages.json` (the texts feature's
 * `passages.build.test.ts`, which also gathers the features' own, #1210), the
 * one file every reader of them loads, and the one the pipeline embeds for search by meaning.
 */

import * as v from 'valibot';

import type { Craft } from '../data/spacecraft';
import { craftCard, writtenDate } from '../data/craftCard';
import { missions, missionView, type Mission } from '../data/spacecraftMission';
import type { FamousEclipse } from '../data/famousEclipses';
import { MOON_NAMES } from '../globe/moonLook';
import type { MoonName } from '../astro/moonOrbits';
import type { LayerChoice } from '../state/layerCatalog';
import { BODIES, LAST_GLACIAL_MAXIMUM_MA, type Body, type Span } from '../state/viewState';
import type { MoonFacts } from './moonFacts';
import type { Why, WhyId } from '../sources/registry';
import { getJson, type Fetch } from '../util/fetchJson';

const PASSAGE_KINDS = [
  'why',
  'moon',
  'eclipse',
  'mission',
  'story',
  'telescope',
  'extinction',
] as const;
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
  /** What it is, where it says more than its place: "Where Eagle came down". */
  label: v.optional(v.pipe(v.string(), v.minLength(1))),
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
  // The wave's story (#833), from its start, at the moment and over the place it was heard.
  gravitationalWaves: 'cam=30.5630,-90.7740,3.00&t=2015-09-14T09:50Z&wave=gw150914',
  neutronStarMerger: 'cam=30.5630,-90.7740,3.00&t=2017-08-17T12:41Z&wave=gw170817',
  'ice-surface': SPAN_VIEWS.ice,
  'deep-surface': SPAN_VIEWS.all,
  'deep-evidence': SPAN_VIEWS.all,
  // At the aeons' oldest moment, to be played from (#1218).
  formation: 'ma=4568&scale=eons',
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

/**
 * The stories the site plays, each a passage of its own so search finds the story itself, not
 * only how it is drawn (#842): GW150914, the first gravitational wave heard (#834), and
 * GW170817, the first from two neutron stars (#990).
 */
export function storyPassages(): Passage[] {
  return [
    {
      id: 'story:gw150914',
      kind: 'story',
      title: 'GW150914: LIGO hears the first gravitational wave',
      text: 'On 14 September 2015 at 09:50:45 UTC, the two LIGO detectors, at Livingston, Louisiana, and 6.9 ms later at Hanford, Washington, heard a gravitational wave for the first time, the first direct detection of gravitational waves: the chirp of two black holes, 36 and 29 times the Sun’s mass, spiralling together and merging into one of 62, 1.3 billion light-years away. Played as a story in four chapters: the black holes merging and their wave spiralling out through space; its journey to Earth, stretching and squeezing the planet as it passes; a ring of free masses showing what it does to space; and LIGO Livingston’s 4 km arms moved by the strain it measured, beside what both detectors recorded.',
      sources: ['abbott2016', 'gwoscGw150914'],
      anchors: [
        {
          body: 'earth',
          at: [30.563, -90.774],
          when: [2015, 2015],
          label: 'GW150914, heard at LIGO Livingston and Hanford',
          view: 'cam=30.5630,-90.7740,3.00&t=2015-09-14T09:50Z&wave=gw150914&chapter=source',
        },
      ],
    },
    {
      id: 'story:gw170817',
      kind: 'story',
      title: 'GW170817: two neutron stars merge, heard and then seen',
      text: 'On 17 August 2017 at 12:41:04 UTC, LIGO and Virgo heard two neutron stars, about 1.5 and 1.3 times the Sun’s mass and each some 24 km across, spiral together for about 100 s and merge, 130 million light-years away in the galaxy NGC 4993. A burst of gamma rays followed 1.7 s later, and a new light, the kilonova, was found 10.9 hours after: the first such merger also seen in light. Played as a story: the two stars orbiting ever faster, pulled out of round, and merging as their wave spirals out through space; a ring of free masses showing what it does to space; and LIGO Livingston’s arms moved by it.',
      sources: ['abbott2017Gw170817', 'abbott2017Multimessenger', 'gwoscGw170817'],
      anchors: [
        {
          body: 'earth',
          at: [30.563, -90.774],
          when: [2017, 2017],
          label: 'GW170817, heard at LIGO Livingston, Hanford and Virgo',
          view: 'cam=30.5630,-90.7740,3.00&t=2017-08-17T12:41Z&wave=gw170817&chapter=source',
        },
      ],
    },
  ];
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

/**
 * Where a launch's craft came down, where the site can show it, as places to open (#716): on
 * the body, at the site, that day, inside its mission, which the link follows. A lander and what
 * it carried down (Apollo's science packages) share a site: the lander's is kept.
 */
export function landingAnchors(sent: readonly Craft[], mission: string | null): Anchor[] {
  const landers = [...sent].sort((a, b) => Number(a.part) - Number(b.part));
  const seen = new Set<string>();
  return landers.flatMap((one) => {
    const landing = one.landing;
    const body = landing === undefined ? undefined : WORLDS[landing.world];
    if (landing === undefined || body === undefined || landing.lat === null) return [];
    if (landing.lon === null) return [];
    // GCAT writes some longitudes from 0 to 360°, or west past −180°; links take −180 to 180°.
    const lon = ((((landing.lon + 180) % 360) + 360) % 360) - 180;
    const day = landing.date === null ? null : SURE_DAY.exec(landing.date);
    const year = landing.date === null ? null : yearOf(landing.date);
    const at = `${landing.lat.toFixed(4)},${lon.toFixed(4)}`;
    const key = `${body} ${at} ${landing.date ?? ''}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const time = day === null ? '' : `&t=${day[1] ?? ''}${day[2] ?? 'T12:00'}Z`;
    const following = mission === null ? '' : `&mission=${mission}`;
    return [
      {
        body,
        at: [landing.lat, lon] as const,
        ...(year === null ? {} : { when: [year, year] as const }),
        label: `Where ${one.name} came down`,
        view: `focus=${body}&cam=${at},1.80&layers=spacecraft${following}${time}`,
      },
    ];
  });
}

/** The record's last date: where a mission still flying is followed to, so the file holds still. */
function recordEnd(craft: readonly Craft[]): number {
  let last = 0;
  for (const { phases } of craft) {
    for (const [, began, ended] of phases) {
      for (const when of [began, ended]) {
        if (when !== null)
          last = Math.max(
            last,
            Date.parse(`${when.replace('?', '').split('T')[0] ?? ''}T00:00:00Z`),
          );
      }
    }
  }
  return last / 86_400_000 + 2_440_587.5;
}

/** A UT JD as the astronomical year it falls in. */
function yearOfDay(jd: number): number {
  return new Date((jd - 2_440_587.5) * 86_400_000).getUTCFullYear();
}

/** A mission's text: its card, then its journey in order. */
function missionText(mission: Mission): string {
  const [first] = mission.craft;
  const card =
    first === undefined
      ? []
      : craftCard(first, true)
          .facts.filter(
            ([fact]) => fact !== 'Path' && (mission.craft.length < 2 || fact !== 'Craft'),
          )
          .map(([fact, value]) => `${fact}: ${value}.`);
  const journey = mission.chapters.map(
    ({ name, jd }) =>
      `${name}, ${writtenDate(new Date((jd - 2_440_587.5) * 86_400_000).toISOString().slice(0, 10))}`,
  );
  const crew =
    mission.craft.length > 1 ? [`Craft: ${mission.craft.map(({ name }) => name).join(', ')}.`] : [];
  return [...card, ...crew, `Journey: ${journey.join('; ')}.`].join(' ');
}

/**
 * Each mission beyond Earth orbit, by launch (#712): found by search, its link opening the
 * journey, framed on where it went and played from its start. About the Sun or about Earth,
 * across the years it flew; and where its craft came down, each a place to open inside it
 * (#716), so a search for Apollo finds the missions, not their parts.
 */
export function missionPassages(craft: readonly Craft[]): Passage[] {
  const byLaunch = new Map<string, Craft[]>();
  for (const one of craft)
    byLaunch.set(one.launchTag, [...(byLaunch.get(one.launchTag) ?? []), one]);
  return missions(craft, recordEnd(craft)).map((mission) => ({
    id: `mission:${mission.id}`,
    kind: 'mission',
    title: mission.title,
    text: missionText(mission),
    sources: ['gcat', 'nssdcaChronology'],
    anchors: [
      {
        body: mission.aboutEarth ? 'earth' : 'sun',
        when: [yearOfDay(mission.start), yearOfDay(mission.end)] as const,
        view: missionView(mission),
      },
      ...landingAnchors(byLaunch.get(mission.craft[0]?.launchTag ?? '') ?? [], mission.id),
    ],
  }));
}
