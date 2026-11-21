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
  type HumanClaims,
  type HumanSpecies,
} from '../../data/humanClaims';
import { loadHumanRoutes, routeCard, routesAt, type HumanRoutes } from '../../data/humanRoutes';
import { loadHumanSpecies, speciesCard, type HumanSpeciesData } from '../../data/humanSpecies';
import { loadPictures, type Pictures } from '../../data/pictures';
import { DISPERSAL_SCENARIOS, withLayer } from '../../state/viewState';
import type { MarkerCardContent, RelatedStep } from '../../ui/markerCard';
import { destinationNear, fromAFind } from '../../explore/related';
import { errorMessage } from '../../util/errors';
import { feature } from '../feature';
import { createDispersal } from './dispersal';
import { note } from './humansNote';
import { humanSiteLayer } from './humanSiteLayer';
import { routeLayer } from './routeLayer';

/** A species' card is picked as `human:species-<id>`. */
const SPECIES_PICK = 'species-';
/** A route's card is picked as `human:route-<id>`. */
const ROUTE_PICK = 'route-';

/**
 * The human story (#177): from the earliest Homo sapiens (Jebel Irhoud, about 315,000 years ago)
 * to the end of the ice age, at 10,000 years a second, about half a minute, facing Africa and
 * south-west Asia, where it starts.
 */
const STORY = {
  fromMa: 0.315,
  maPerSecond: 0.01,
  camera: { target: { latitude: 12, longitude: 40 }, distance: 3.4 },
} as const;

export const humansFeature = feature({
  id: 'humans',
  needs: ['cards', 'anchors', 'tree', 'settledLand', 'deepTime'],
  picks: 'human',
  deepChip: { label: 'Humans', why: 'humans' },
  // Shown in deep time, by the deep-time view: nothing to watch besides.
  watches: () => [],
  mount(context) {
    const sitesOnGlobe = context.globe.addLayer(humanSiteLayer);
    const routesOnGlobe = context.globe.addLayer(routeLayer);
    let routes: HumanRoutes | null = null;
    let routesLoading = false;
    const dispersal = createDispersal(context);
    let claims: HumanClaims | null = null;
    let loading = false;
    let pictures: Pictures | null = null;
    let picturesLoading = false;
    let shown: string | null = null;
    let dispersalOn = false;

    /** Plays the human story: Humans and a dispersal model on, facing Africa, from 315 ka. */
    function playStory(): void {
      context.change((state) => ({
        ...state,
        layers: withLayer(state.layers, 'humans', true),
        dispersal: state.dispersal === 'off' ? 'a' : state.dispersal,
        camera: STORY.camera,
      }));
      context.deepTime.play(STORY.fromMa, 'ice', STORY.maPerSecond);
    }

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
      if (id.startsWith(ROUTE_PICK)) {
        return routes === null ? null : routeCard(routes, id.slice(ROUTE_PICK.length));
      }
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
          routesOnGlobe.update(null);
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
        if (routes === null && !routesLoading) {
          routesLoading = true;
          loadHumanRoutes(`${context.base}data/humans/routes.json`, context.fetchJson).then(
            (loaded) => {
              routes = loaded;
              context.refresh();
            },
            (error: unknown) => {
              routesLoading = false;
              context.notify(`Could not load the routes: ${errorMessage(error)}`);
            },
          );
        }
        const view = humansAt(claims, moment.ma * 1000);
        const routesNow = routes === null ? [] : routesAt(routes, moment.ma * 1000);
        sitesOnGlobe.update(view.sites);
        routesOnGlobe.update(routesNow);
        return {
          offered,
          on: true,
          note: note(
            view,
            routesNow,
            model,
            pickModel,
            {
              species: (id) => {
                show(`${SPECIES_PICK}${id}`);
              },
              route: (id) => {
                show(`${ROUTE_PICK}${id}`);
              },
            },
            playStory,
          ),
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
