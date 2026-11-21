/**
 * Humans in the ice ages on the feature contract (#380): dated finds of our species and its
 * relatives, each from its date on, a name to tap on the globe; their chip and note in the
 * deep-time bar, with the claims about them side by side where they are disputed, and a dispersal
 * model to shade; each find's card, with its picture once it loads and its species' place on the
 * tree of life; and each species' own card (#1034), from a find's.
 */

import {
  claimCard,
  HUMAN_SPECIES,
  humansAt,
  loadHumanClaims,
  SPECIES_NAMES,
  type ClaimLine,
  type HumanClaims,
  type HumanSpecies,
  type HumansView,
} from '../../data/humanClaims';
import { loadHumanSpecies, speciesCard, type HumanSpeciesData } from '../../data/humanSpecies';
import { loadPictures, type Pictures } from '../../data/pictures';
import { DISPERSAL_SCENARIOS } from '../../state/viewState';
import type { DeepNoteBlock, DeepNotePart } from '../../ui/deepChips';
import type { MarkerCardContent, RelatedStep } from '../../ui/markerCard';
import { destinationNear, fromAFind } from '../../explore/related';
import { errorMessage } from '../../util/errors';
import { feature } from '../feature';
import { createDispersal, dispersalText, type DispersalShown } from './dispersal';
import { humanSiteLayer } from './humanSiteLayer';

/** A species' card is picked as `human:species-<id>`. */
const SPECIES_PICK = 'species-';

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

/** The species marked, in order of their arrival, each with its count and a way to its card. */
function legend(view: HumansView, about: (species: HumanSpecies) => void): DeepNoteBlock[] {
  const shown = HUMAN_SPECIES.flatMap((species) => {
    const count = view.sites.filter((site) => site.species === species).length;
    return count === 0 ? [] : [{ species, count }];
  });
  if (shown.length === 0) return [];
  return [
    {
      list: shown.map(({ species, count }) => ({
        class: `humans-legend is-${species}`,
        parts: [
          {
            text: SPECIES_NAMES[species],
            run: () => {
              about(species);
            },
          },
          ` ${String(count)} ${count === 1 ? 'find' : 'finds'}`,
        ],
      })),
    },
  ];
}

/** The note: the model to shade, then the finds marked by species and the claims reached. */
function note(
  view: HumansView,
  model: DispersalShown,
  pick: (value: string) => void,
  about: (species: HumanSpecies) => void,
): DeepNoteBlock[] {
  return [
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
        `Humans: ${String(view.sites.length)} dated finds marked, each from its date on, as its source reports it; disputed ones in italics. Hand-picked, not complete. Tap a species for what it was.`,
      ],
    },
    ...legend(view, about),
    ...view.questions.flatMap(({ title, claims }) => [
      { class: 'humans-question', paragraph: [title] },
      { list: claims.map(claim) },
    ]),
    ...(view.others.length > 0 ? [{ list: view.others.map(claim) }] : []),
  ];
}

export const humansFeature = feature({
  id: 'humans',
  needs: ['cards', 'anchors', 'tree', 'settledLand'],
  picks: 'human',
  deepChip: { label: 'Humans', why: 'humans' },
  // Shown in deep time, by the deep-time view: nothing to watch besides.
  watches: () => [],
  mount(context) {
    const sitesOnGlobe = context.globe.addLayer(humanSiteLayer);
    const dispersal = createDispersal(context);
    let claims: HumanClaims | null = null;
    let loading = false;
    let pictures: Pictures | null = null;
    let picturesLoading = false;
    let shown: string | null = null;
    let dispersalOn = false;

    function pickModel(value: string): void {
      const dispersalPicked = DISPERSAL_SCENARIOS.find((scenario) => scenario === value);
      if (dispersalPicked !== undefined)
        context.change((state) => ({ ...state, dispersal: dispersalPicked }));
    }

    let species: HumanSpeciesData | null = null;
    let speciesLoading = false;

    /** Its place on the tree of life: the species where the tree has it, else the genus. */
    function onTheTree(id: HumanSpecies): { label: string; run: () => void } {
      return {
        label: 'Its species on the tree of life',
        run: () => {
          context.tree.openTree((tree) => {
            const genus = tree.name.indexOf('Homo');
            return tree.ours.humans[id] ?? (genus < 0 ? undefined : genus);
          });
        },
      };
    }

    /** A card by what was picked: a find, or a species. */
    function cardFor(id: string): MarkerCardContent | null {
      if (id.startsWith(SPECIES_PICK)) {
        const which = HUMAN_SPECIES.find((each) => `${SPECIES_PICK}${each}` === id);
        const card =
          which === undefined || species === null ? null : speciesCard(species, which, pictures);
        return card === null || which === undefined ? null : { ...card, action: onTheTree(which) };
      }
      const find = claims?.claims.find((each) => each.id === id);
      const card = claims === null ? null : claimCard(claims, id, pictures);
      if (card === null || find === undefined) return null;
      return {
        ...card,
        action: onTheTree(find.species),
        related: [aboutSpecies(find.species), ...findSteps(find.place)],
      };
    }

    /** From a find to its species' own card. */
    function aboutSpecies(id: HumanSpecies): RelatedStep {
      return {
        label: `About ${SPECIES_NAMES[id]}`,
        explain: 'When and where it lived, its body and tools, and what is argued over',
        run: () => {
          show(`${SPECIES_PICK}${id}`);
        },
      };
    }

    /** Shows what was picked, now if it can, or once what it needs has loaded. */
    function show(id: string): void {
      shown = id;
      const card = cardFor(id);
      if (card !== null) context.cards.show(card);
      const again = (): void => {
        const now = shown === null ? null : cardFor(shown);
        // Again with what loaded, if its card is still open, or for the first time.
        if (now !== null && (card === null || context.cards.open())) context.cards.show(now);
      };
      if (pictures === null && !picturesLoading) {
        picturesLoading = true;
        loadPictures(`${context.base}data/humans/pictures.json`, context.fetchJson).then(
          (loaded) => {
            pictures = loaded;
            again();
          },
          (error: unknown) => {
            picturesLoading = false;
            context.notify(`Could not load the finds’ pictures: ${errorMessage(error)}`);
          },
        );
      }
      if (species === null && !speciesLoading && id.startsWith(SPECIES_PICK)) {
        speciesLoading = true;
        loadHumanSpecies(`${context.base}data/humans/species.json`, context.fetchJson).then(
          (loaded) => {
            species = loaded;
            again();
          },
          (error: unknown) => {
            speciesLoading = false;
            context.notify(`Could not load the human species: ${errorMessage(error)}`);
          },
        );
      }
    }

    /** From a find (#731): the dispersal models, and ancient DNA where it was found. */
    function findSteps(place: { latitude: number; longitude: number } | null): RelatedStep[] {
      const { spread, dna } = fromAFind(dispersalOn);
      const near = place === null ? null : destinationNear('ancient-dna', place);
      return [
        ...(spread === null
          ? []
          : [
              {
                ...spread,
                run: () => {
                  context.change((state) => ({ ...state, dispersal: 'a' }));
                },
              },
            ]),
        ...(near === null
          ? []
          : [
              {
                ...dna,
                run: () => {
                  context.anchors.open(near);
                },
              },
            ]),
      ];
    }

    return {
      // Our species on the tree of life, from the layer's row in the Layers panel.
      action: () => ({
        label: 'Our species on the tree of life',
        run: () => {
          context.tree.openTree((tree) => tree.ours.humans['sapiens']);
        },
      }),
      deep(state, moment) {
        dispersalOn = state.dispersal !== 'off';
        // People are a matter of the last few hundred thousand years: the ice-age scale's.
        const on = state.deepScale === 'ice' && state.layers.has('humans');
        if (moment === null || !on) {
          sitesOnGlobe.update(null);
          dispersal.show(null, 0);
          return moment === null
            ? null
            : { offered: moment.scale === 'ice', on: false, note: null };
        }
        const offered = moment.scale === 'ice';
        const model = dispersal.show(state.dispersal, moment.ma);
        if (claims === null) {
          if (!loading) {
            loading = true;
            loadHumanClaims(`${context.base}data/humans/claims.json`, context.fetchJson).then(
              (loaded) => {
                claims = loaded;
                context.refresh();
              },
              (error: unknown) => {
                loading = false;
                context.notify(`Could not load the human finds: ${errorMessage(error)}`);
              },
            );
          }
          return { offered, on: true, note: [{ paragraph: ['Humans: loading…'] }] };
        }
        const view = humansAt(claims, moment.ma * 1000);
        sitesOnGlobe.update(view.sites);
        return {
          offered,
          on: true,
          note: note(view, model, pickModel, (id) => {
            show(`${SPECIES_PICK}${id}`);
          }),
        };
      },
      pick(id) {
        if (id.startsWith(SPECIES_PICK) || cardFor(id) !== null) show(id);
      },
      unpick() {
        shown = null;
      },
    };
  },
});
