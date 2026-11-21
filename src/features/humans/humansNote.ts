/**
 * What the Humans note says in the deep-time bar: the story to play, the dispersal model to
 * shade, the finds marked by species, the routes argued for, and the claims side by side.
 */

import {
  HUMAN_SPECIES,
  SPECIES_NAMES,
  type ClaimLine,
  type HumanSpecies,
  type HumansView,
} from '../../data/humanClaims';
import type { RouteShown } from '../../data/humanRoutes';
import type { DeepNoteBlock, DeepNotePart } from '../../ui/deepChips';
import { dispersalText, type DispersalShown } from './dispersal';

const MODELS = [
  { value: 'off', label: 'Off' },
  { value: 'a', label: 'Early exit from Africa' },
  { value: 'b', label: 'Late exit from Africa' },
] as const;

function claim(line: ClaimLine): { class: string; parts: DeepNotePart[] } {
  return {
    class: line.reached ? 'is-reached' : 'is-later',
    parts: [`${line.text} `, { text: line.citation, href: `https://doi.org/${line.doi}` }],
  };
}

/**
 * The species marked, in order of their arrival, each with its count, a way to its card, and a
 * way to show only it (#1047), or all again.
 */
function legend(
  view: HumansView,
  only: HumanSpecies | 'all',
  about: (species: HumanSpecies) => void,
  pickOnly: (species: HumanSpecies | 'all') => void,
): DeepNoteBlock[] {
  const shown = HUMAN_SPECIES.flatMap((species) => {
    const count = view.sites.filter((site) => site.species === species).length;
    return count === 0 ? [] : [{ species, count }];
  });
  const showingOnly: DeepNoteBlock[] =
    only === 'all'
      ? []
      : [
          {
            class: 'humans-only',
            paragraph: [
              `Showing only ${SPECIES_NAMES[only]}. `,
              {
                text: 'Show all species',
                run: () => {
                  pickOnly('all');
                },
              },
            ],
          },
        ];
  if (shown.length === 0) return showingOnly;
  return [
    ...showingOnly,
    {
      list: shown.map(({ species, count }) => ({
        class: `humans-legend is-${species}${only === species ? ' is-only' : ''}`,
        parts: [
          {
            text: SPECIES_NAMES[species],
            run: () => {
              about(species);
            },
          },
          ` ${String(count)} ${count === 1 ? 'find' : 'finds'} `,
          only === species
            ? {
                text: 'Show all',
                run: () => {
                  pickOnly('all');
                },
              }
            : {
                text: 'Only these',
                run: () => {
                  pickOnly(species);
                },
              },
        ],
      })),
    },
  ];
}

/** The routes argued for at the moment, each a way to its card, with whose argument it is. */
function routeList(routes: readonly RouteShown[], open: (id: string) => void): DeepNoteBlock[] {
  if (routes.length === 0) return [];
  return [
    {
      paragraph: [
        'Routes argued for then, each after one study, drawn approximately; rivals share a colour:',
      ],
    },
    {
      list: routes.map((route) => ({
        class: `humans-route is-route-${String(route.colour % 4)}${route.dashed ? ' is-dashed' : ''}`,
        parts: [
          {
            text: route.label,
            run: () => {
              open(route.id);
            },
          },
          ` ${route.citation}; ${String(route.weighed.for)} studies for, ${String(route.weighed.against)} against`,
        ],
      })),
    },
  ];
}

/** Interbreeding (#1047): the episodes reached, and what living people carry, each to its card. */
function mixing(
  mixes: {
    readonly episodes: readonly { id: string; title: string; estimates: number }[];
    readonly traits: readonly { id: string; title: string }[];
  } | null,
  open: (pick: string) => void,
): DeepNoteBlock[] {
  if (mixes === null || (mixes.episodes.length === 0 && mixes.traits.length === 0)) return [];
  const button = (pick: string, text: string) => ({
    text,
    run: () => {
      open(pick);
    },
  });
  return [
    {
      class: 'humans-question',
      paragraph: ['Interbreeding, as DNA shows it (inferred, with each estimate’s paper):'],
    },
    {
      list: mixes.episodes.map((episode) => ({
        class: 'humans-mixing',
        parts: [
          button(`mix-${episode.id}`, episode.title),
          ` ${String(episode.estimates)} ${episode.estimates === 1 ? 'estimate' : 'estimates'}`,
        ],
      })),
    },
    ...(mixes.traits.length === 0
      ? []
      : [
          {
            paragraph: [
              'What it left in living people: ',
              ...mixes.traits.flatMap((trait, index) => [
                ...(index === 0 ? [] : [' · ']),
                button(`trait-${trait.id}`, trait.title),
              ]),
            ],
          },
        ]),
  ];
}

/** The ice-age DNA sites (#1059): how many places and people, by then. */
function dnaLine(dna: { readonly places: number; readonly people: number }): DeepNoteBlock[] {
  if (dna.places === 0) return [];
  return [
    {
      list: [
        {
          class: 'humans-legend is-dna',
          parts: [
            `Ancient DNA of our species: ${String(dna.people)} ${dna.people === 1 ? 'person' : 'people'} at ${String(dna.places)} ${dna.places === 1 ? 'place' : 'places'}, from the Allen Ancient DNA Resource. Tap one for who they were.`,
          ],
        },
      ],
    },
  ];
}

/** The note: the model to shade, then the finds marked by species, the routes and the claims. */
export function note(
  view: HumansView,
  routes: readonly RouteShown[],
  model: DispersalShown,
  pick: (value: string) => void,
  open: {
    species: (species: HumanSpecies) => void;
    route: (id: string) => void;
    only: (species: HumanSpecies | 'all') => void;
    pick: (id: string) => void;
  },
  only: HumanSpecies | 'all',
  mixes: Parameters<typeof mixing>[0],
  story: () => void,
  dna: Parameters<typeof dnaLine>[0] = { places: 0, people: 0 },
): DeepNoteBlock[] {
  return [
    {
      class: 'humans-story',
      paragraph: [
        { text: '▶ Play the human story', run: story },
        ' From the earliest Homo sapiens, 315,000 years ago, to the end of the ice age: finds appear as they are dated, routes as they are argued, with a dispersal model’s front.',
      ],
    },
    {
      class: 'dispersal-row',
      paragraph: [
        {
          choose: {
            label: 'Model',
            name: 'Dispersal model',
            options: MODELS,
            value: model.scenario,
            pick,
          },
        },
        ' ',
        { text: dispersalText(model), testId: 'dispersal-words' },
      ],
    },
    {
      paragraph: [
        `Humans: ${String(only === 'all' ? view.sites.length : view.sites.filter((site) => site.species === only).length)} dated finds marked, each from its date on while its species is still found, as its source reports it; disputed ones in italics. Hand-picked, not complete. Tap a species for what it was.`,
      ],
    },
    ...legend(view, only, open.species, open.only),
    ...dnaLine(dna),
    ...routeList(routes, open.route),
    ...mixing(mixes, open.pick),
    ...view.questions.flatMap(({ title, claims }) => [
      { class: 'humans-question', paragraph: [title] },
      { list: claims.map(claim) },
    ]),
    ...(view.others.length > 0 ? [{ list: view.others.map(claim) }] : []),
  ];
}
