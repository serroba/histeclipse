/**
 * Routes people are argued to have taken (`public/data/humans/routes.json`, #177): each as one
 * published study argues it, drawn approximately after its text and figures, not a measured path.
 * Where routes compete they share a question, and are drawn side by side, so the reader can weigh
 * them.
 */

import * as v from 'valibot';

import type { GeoPoint } from '../core/geo';
import { getJson, type Fetch } from '../util/fetchJson';

const words = (most: number) => v.pipe(v.string(), v.minLength(1), v.maxLength(most));
const ka = v.pipe(v.number(), v.minValue(0));
const Source = v.strictObject({
  citation: words(120),
  doi: v.pipe(v.string(), v.regex(/^10\.\d{4,9}\/\S+$/)),
});
/** The kinds of evidence a route rests on, each read differently. */
const EVIDENCE_KINDS = [
  'genetic',
  'archaeological',
  'fossil',
  'environmental',
  'dating',
  'model',
] as const;
const KIND_NAMES: Readonly<Record<(typeof EVIDENCE_KINDS)[number], string>> = {
  genetic: 'Genetic evidence',
  archaeological: 'Archaeology',
  fossil: 'Fossils',
  environmental: 'Climate and land',
  dating: 'Dating',
  model: 'Models',
};
const Evidence = v.strictObject({
  kind: v.optional(v.picklist(EVIDENCE_KINDS)),
  text: words(260),
  source: Source,
});
type Evidence = v.InferOutput<typeof Evidence>;

const Point = v.tuple([
  v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
]);

const RoutesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    about: words(600),
    questions: v.array(
      v.strictObject({ id: v.pipe(v.string(), v.regex(/^[a-z-]+$/)), title: words(120) }),
    ),
    routes: v.array(
      v.pipe(
        v.strictObject({
          id: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
          question: v.optional(v.string()),
          /** A few words for the map. */
          label: words(40),
          /** When the study has people taking it, thousands of years ago: oldest, then youngest. */
          fromKa: ka,
          toKa: ka,
          /** The way, longitude and latitude, in the direction of travel. */
          path: v.pipe(v.array(Point), v.minLength(2)),
          says: words(320),
          source: Source,
          extraSources: v.optional(v.array(Source)),
          /** What bears it out, from as many lines as there are: each study, and what it found. */
          evidence: v.pipe(
            v.array(v.strictObject({ ...Evidence.entries, kind: v.picklist(EVIDENCE_KINDS) })),
            v.minLength(2),
          ),
          /** What tells against it or complicates it, each study and what it found. */
          against: v.pipe(v.array(Evidence), v.minLength(1)),
        }),
        v.check((route) => route.fromKa >= route.toKa, 'a span runs from oldest to youngest'),
      ),
    ),
  }),
  v.check(
    (data) =>
      data.routes.every(
        (route) =>
          route.question === undefined || data.questions.some((q) => q.id === route.question),
      ),
    'every question a route names is listed',
  ),
  v.check(
    (data) =>
      data.questions.every(
        (question) => data.routes.filter((route) => route.question === question.id).length > 1,
      ),
    'every question has rival routes',
  ),
);

export type HumanRoutes = v.InferOutput<typeof RoutesSchema>;
type Route = HumanRoutes['routes'][number];

export async function loadHumanRoutes(url: string, fetchJson: Fetch): Promise<HumanRoutes> {
  return getJson(fetchJson, url, RoutesSchema);
}

/** A route drawn on the globe: its way, a name at its middle, and whether it has rivals. */
export interface RouteShown {
  readonly id: string;
  readonly label: string;
  /** Whose argument it is. */
  readonly citation: string;
  /** How many studies bear it out, and how many tell against it. */
  readonly weighed: { readonly for: number; readonly against: number };
  /** Lon/lat pairs, unwrapped across the date line, so each step is the short way round. */
  readonly path: readonly (readonly [number, number])[];
  /** Where its name goes: the point halfway along its way. */
  readonly middle: GeoPoint;
  /** Its colour: one per question, so rivals share one; routes without rivals each their own. */
  readonly colour: number;
  /** Dashed: a rival after the first, so routes sharing a colour can be told apart. */
  readonly dashed: boolean;
}

/** Longitudes carried on past ±180°, so a way across the date line is drawn as one line. */
export function unwrapPath(
  path: readonly (readonly [number, number])[],
): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  for (const [lon, lat] of path) {
    const last = out.at(-1);
    const turns = last === undefined ? 0 : Math.round((last[0] - lon) / 360);
    out.push([lon + turns * 360, lat]);
  }
  return out;
}

/** The point halfway along a way, by its length on the map. */
function middleOf(path: readonly (readonly [number, number])[]): GeoPoint {
  const lengths = path.slice(1).map((point, i) => {
    const before = path[i] ?? point;
    return Math.hypot(point[0] - before[0], point[1] - before[1]);
  });
  let left = lengths.reduce((sum, each) => sum + each, 0) / 2;
  for (const [i, length] of lengths.entries()) {
    const [a, b] = [path[i], path[i + 1]];
    if (a !== undefined && b !== undefined && left <= length) {
      const t = length === 0 ? 0 : left / length;
      const lon = a[0] + (b[0] - a[0]) * t;
      return { latitude: a[1] + (b[1] - a[1]) * t, longitude: ((lon + 540) % 360) - 180 };
    }
    left -= length;
  }
  const [lon, lat] = path[0] ?? [0, 0];
  return { latitude: lat, longitude: lon };
}

/** The routes argued for at `shownKa` thousand years ago: each while people are said to take it. */
export function routesAt(data: HumanRoutes, shownKa: number): readonly RouteShown[] {
  const groups = [...new Set(data.routes.map((route) => route.question ?? `route:${route.id}`))];
  return data.routes.flatMap((route): RouteShown[] => {
    if (shownKa > route.fromKa || shownKa < route.toKa) return [];
    const group = route.question ?? `route:${route.id}`;
    const path = unwrapPath(route.path);
    return [
      {
        id: route.id,
        label: `${route.label}?`,
        citation: route.source.citation,
        weighed: { for: route.evidence.length, against: route.against.length },
        path,
        middle: middleOf(path),
        colour: groups.indexOf(group),
        dashed:
          data.routes.findIndex((each) => (each.question ?? `route:${each.id}`) === group) <
          data.routes.indexOf(route),
      },
    ];
  });
}

/** A span in thousands of years, as "75,000 to 45,000 years ago". */
const span = (route: Route) =>
  `${(route.fromKa * 1000).toLocaleString('en')} to ${(route.toKa * 1000).toLocaleString('en')} years ago`;

/** What a study found, with whose it is. */
const said = (item: Evidence): string => `${item.text} (${item.source.citation})`;

/** Each paper once, in the order first named. */
function once<T extends { readonly doi: string }>(sources: readonly T[]): T[] {
  return sources.filter(
    (source, index) => sources.findIndex((each) => each.doi === source.doi) === index,
  );
}

/** A route's card: what its study argues, when, its source, and its rivals. */
export function routeCard(
  data: HumanRoutes,
  id: string,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly note: string;
} | null {
  const route = data.routes.find((each) => each.id === id);
  if (route === undefined) return null;
  const question = data.questions.find((each) => each.id === route.question);
  const rivals = data.routes.filter(
    (each) => each.question !== undefined && each.question === route.question && each !== route,
  );
  return {
    title: route.label,
    facts: [
      ...(question === undefined ? [] : [['Question', question.title] as const]),
      ['Argued by', route.source.citation],
      ['The way', route.says],
      ['When', span(route)],
      ...route.evidence.map((item) => [KIND_NAMES[item.kind], said(item)] as const),
      ...route.against.map((item) => ['Against', said(item)] as const),
      ...(rivals.length === 0
        ? []
        : [
            [
              'Other answers',
              rivals.map((rival) => `${rival.label} (${rival.source.citation})`).join('; '),
            ] as const,
          ]),
    ],
    links: once([
      route.source,
      ...(route.extraSources ?? []),
      ...route.evidence.map((item) => item.source),
      ...route.against.map((item) => item.source),
      ...rivals.map((rival) => rival.source),
    ]).map((source) => ({ label: source.citation, href: `https://doi.org/${source.doi}` })),
    note: 'Drawn approximately, after the study’s text and figures: an argument, not a measured path.',
  };
}
