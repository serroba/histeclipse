/**
 * Humans in the ice ages on the feature contract (#380): dated finds of our species and its
 * relatives, each from its date on, a name to tap on the globe; their chip and note in the
 * deep-time bar, with the claims about them side by side where they are disputed, and a dispersal
 * model to shade; each find's card, with its picture once it loads and its species' place on the
 * tree of life.
 */

import {
  claimCard,
  humansAt,
  loadHumanClaims,
  type ClaimLine,
  type HumanClaims,
  type HumansView,
} from '../../data/humanClaims';
import { loadPictures, type Pictures } from '../../data/pictures';
import { DISPERSAL_SCENARIOS } from '../../state/viewState';
import type { DeepNoteBlock, DeepNotePart } from '../../ui/deepChips';
import type { MarkerCardContent } from '../../ui/markerCard';
import { errorMessage } from '../../util/errors';
import type { Feature } from '../feature';
import { createDispersal, dispersalText, type DispersalShown } from './dispersal';
import { humanSiteLayer } from './humanSiteLayer';

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

/** The note: the model to shade, then the finds marked and the claims reached. */
function note(
  view: HumansView,
  model: DispersalShown,
  pick: (value: string) => void,
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
        `Humans: ${String(view.sites.length)} dated finds marked, each from its date on, as its source reports it; disputed ones in italics. Hand-picked, not complete.`,
      ],
    },
    ...view.questions.flatMap(({ title, claims }) => [
      { class: 'humans-question', paragraph: [title] },
      { list: claims.map(claim) },
    ]),
    ...(view.others.length > 0 ? [{ list: view.others.map(claim) }] : []),
  ];
}

export const humansFeature: Feature = {
  id: 'humans',
  picks: 'human',
  deepChip: { label: 'Humans', icon: 'humans', why: 'humans' },
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

    function pickModel(value: string): void {
      const dispersalPicked = DISPERSAL_SCENARIOS.find((scenario) => scenario === value);
      if (dispersalPicked !== undefined)
        context.change((state) => ({ ...state, dispersal: dispersalPicked }));
    }

    /** A find's card, with a way to its species' place on the tree of life. */
    function cardFor(id: string): MarkerCardContent | null {
      if (claims === null) return null;
      const card = claimCard(claims, id, pictures);
      if (card === null) return null;
      const species = claims.claims.find((each) => each.id === id)?.species;
      return species === undefined
        ? card
        : {
            ...card,
            action: {
              label: 'Its species on the tree of life',
              run: () => {
                context.openTree((tree) => tree.ours.humans[species]);
              },
            },
          };
    }

    return {
      deep(state, moment) {
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
        return { offered, on: true, note: note(view, model, pickModel) };
      },
      pick(id) {
        const card = cardFor(id);
        if (card === null) return;
        shown = id;
        context.showCard(card);
        if (pictures !== null || picturesLoading) return;
        picturesLoading = true;
        loadPictures(`${context.base}data/humans/pictures.json`, context.fetchJson).then(
          (loaded) => {
            pictures = loaded;
            // Its picture, if its card is still the one open.
            const again = shown === null ? null : cardFor(shown);
            if (context.cardOpen() && again !== null) context.showCard(again);
          },
          (error: unknown) => {
            picturesLoading = false;
            context.notify(`Could not load the finds’ pictures: ${errorMessage(error)}`);
          },
        );
      },
      unpick() {
        shown = null;
      },
    };
  },
};
