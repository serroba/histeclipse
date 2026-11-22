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
  type HumanSite,
  type HumanSpecies,
  type HumansShown,
} from '../../data/humanClaims';
import { loadHumanRoutes, routeCard, routesAt } from '../../data/humanRoutes';
import { episodeCard, episodesAt, loadHumanAdmixture, traitCard } from '../../data/humanAdmixture';
import { genomeRows, loadHumanGenomes } from '../../data/humanGenomes';
import { loadIceAgeGenomes } from '../../data/iceAgeGenomes';
import { loadHumanSpecies, speciesCard } from '../../data/humanSpecies';
import { loadPictures } from '../../data/pictures';
import { DISPERSAL_SCENARIOS, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent, RelatedStep } from '../../ui/markerCard';
import { destinationNear, fromAFind } from '../../explore/related';
import { reportAll } from '../../state/loadOnce';
import { feature } from '../feature';
import { createDispersal, type DispersalShown } from './dispersal';
import { iceAgeDna } from './iceAgeDna';
import { note } from './humansNote';
import { humanSiteLayer } from './humanSiteLayer';
import { lazy } from './lazy';
import { routeLayer } from './routeLayer';

/** Whether a find shows, with every find, one species' or only those with DNA shown. */
function shows(only: HumansShown, site: HumanSite): boolean {
  if (only === 'all') return true;
  return only === 'dna' ? site.hasDna === true : site.species === only;
}

/** A species' card is picked as `human:species-<id>`. */
const SPECIES_PICK = 'species-';
/** Interbreeding's episodes and traits are picked as `human:mix-<id>` and `human:trait-<id>`. */
const MIX_PICK = 'mix-';
const TRAIT_PICK = 'trait-';
/** A route's card is picked as `human:route-<id>`. */
const ROUTE_PICK = 'route-';
/** An ice-age DNA site's card (#1059) is picked as `human:dna-<place>`. */
const DNA_PICK = 'dna-';

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
    const dispersal = createDispersal(context);
    let shown: string | null = null;
    // Whether what was picked had no card yet: shown once what it needs has loaded.
    let waiting = false;
    let dispersalOn = false;
    let storyStarting = false;
    let layerOn = false;

    /** A data file of the layer's, loaded once when first asked for (#1047). */
    function data<T>(
      file: string,
      what: string,
      load: (url: string, fetchJson: typeof context.fetchJson) => Promise<T>,
      arrived: () => void,
    ) {
      return lazy({
        fetch: () => load(`${context.base}data/humans/${file}`, context.fetchJson),
        what,
        context: {
          notify: (message) => {
            context.notify(message);
          },
          refresh: arrived,
        },
      });
    }
    const refresh = () => {
      context.refresh();
    };
    const claims = data('claims.json', 'the human finds', loadHumanClaims, refresh);
    const routes = data('routes.json', 'the routes', loadHumanRoutes, refresh);
    const admixture = data('admixture.json', 'the interbreeding', loadHumanAdmixture, refresh);
    const pictures = data('pictures.json', 'the finds’ pictures', loadPictures, reshow);
    // Its finds' DNA marks them on the globe (#1059) as well as on their cards.
    const genomes = data('genomes.json', 'the ancient DNA', loadHumanGenomes, () => {
      refresh();
      reshow();
    });
    const species = data('species.json', 'the human species', loadHumanSpecies, reshow);
    const dna = iceAgeDna(data('aadr-ice-age.json', 'the ice-age DNA', loadIceAgeGenomes, refresh));

    /** Plays the human story: Humans and a dispersal model on, facing Africa, from 315 ka. */
    function playStory(): void {
      context.change((state) => ({
        ...state,
        story: 'off',
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

    /** An interbreeding episode's card, leading to the finds whose DNA shows it. */
    function mixCardFor(episode: string): MarkerCardContent | null {
      const card = admixture.value === null ? null : episodeCard(admixture.value, episode);
      if (card === null) return null;
      const { finds, ...content } = card;
      const related = finds.flatMap((find): RelatedStep[] => {
        const claim = claims.value?.claims.find((each) => each.id === find);
        if (claim === undefined || claim.place === null) return [];
        return [
          {
            label: claim.place.name,
            explain: 'Its card: what was found there, and its DNA',
            run: () => {
              show(find);
            },
          },
        ];
      });
      return { ...content, related };
    }

    /** A species' card, with its place on the tree of life. */
    function speciesCardFor(id: string): MarkerCardContent | null {
      const which = HUMAN_SPECIES.find((each) => each === id);
      if (which === undefined || species.value === null) return null;
      const card = speciesCard(species.value, which, pictures.value);
      return card === null ? null : { ...card, action: onTheTree(which) };
    }

    /** A find's card, with the DNA read there once it has loaded, and where to go next. */
    function findCardFor(id: string): MarkerCardContent | null {
      const find = claims.value?.claims.find((each) => each.id === id);
      const card = claims.value === null ? null : claimCard(claims.value, id, pictures.value);
      if (card === null || find === undefined) return null;
      const dna = genomes.value === null ? { facts: [], links: [] } : genomeRows(genomes.value, id);
      const links = [...card.links, ...dna.links].filter(
        (link, index, all) => all.findIndex((each) => each.href === link.href) === index,
      );
      return {
        ...card,
        facts: [...card.facts, ...dna.facts],
        links,
        action: onTheTree(find.species),
        related: [aboutSpecies(find.species), ...findSteps(find.place)],
      };
    }

    /** What each kind of pick opens, by its prefix; a find's id has none. */
    const CARDS: readonly (readonly [string, (id: string) => MarkerCardContent | null])[] = [
      [MIX_PICK, mixCardFor],
      [TRAIT_PICK, (id) => (admixture.value === null ? null : traitCard(admixture.value, id))],
      [ROUTE_PICK, (id) => (routes.value === null ? null : routeCard(routes.value, id))],
      [SPECIES_PICK, speciesCardFor],
      [DNA_PICK, (id) => dna.card(id)],
    ];

    /** A card by what was picked: a find, a species, a route, or interbreeding. */
    function cardFor(id: string): MarkerCardContent | null {
      const kind = CARDS.find(([prefix]) => id.startsWith(prefix));
      return kind === undefined ? findCardFor(id) : kind[1](id.slice(kind[0].length));
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

    /** The card shown again with what has loaded, if it is still open, or for the first time. */
    function reshow(): void {
      const now = shown === null ? null : cardFor(shown);
      if (now === null || (!waiting && !context.cards.open())) return;
      waiting = false;
      context.cards.show(now);
    }

    /** Shows what was picked, now if it can, or once what it needs has loaded. */
    function show(id: string): void {
      shown = id;
      const card = cardFor(id);
      waiting = card === null;
      if (card !== null) context.cards.show(card);
      pictures.ask();
      if (id.startsWith(SPECIES_PICK)) species.ask();
      else genomes.ask();
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

    /** A link asked for the story (#177): play it once, after this drawing, which ends the ask. */
    function storyAsked(state: ViewState): void {
      if (state.story !== 'humans' || storyStarting) return;
      storyStarting = true;
      queueMicrotask(() => {
        storyStarting = false;
        playStory();
      });
    }

    /** The note's interbreeding: the episodes reached, and what living people carry. */
    function mixesAt(ka: number) {
      const loaded = admixture.value;
      if (loaded === null) return null;
      return {
        episodes: episodesAt(loaded, ka).map((episode) => ({
          id: episode.id,
          title: episode.title,
          estimates: episode.estimates.length,
        })),
        traits: loaded.traits,
      };
    }

    /** The finds, those whose DNA has been read marked so (#1059), once it has loaded. */
    function withDna(sites: readonly HumanSite[]): readonly HumanSite[] {
      genomes.ask();
      const read =
        genomes.value === null ? null : new Set(genomes.value.genomes.map((g) => g.site));
      return read === null
        ? sites
        : sites.map((site) => (read.has(site.id) ? { ...site, hasDna: true } : site));
    }

    /** What the layer draws and says at `ka` thousand years ago, its finds loaded. */
    function drawn(state: ViewState, ka: number, model: DispersalShown, finds: HumanClaims) {
      routes.ask();
      admixture.ask();
      const view = humansAt(finds, ka);
      const routesNow = routes.value === null ? [] : routesAt(routes.value, ka);
      // One species only, if the reader asked (#1047).
      const only = state.humanSpecies;
      const ancient = dna.at(ka, only);
      const marked = withDna(view.sites);
      sitesOnGlobe.update([
        ...marked.filter((site) => shows(only, site)),
        // After the finds, so where names crowd the finds keep theirs.
        ...ancient.sites,
      ]);
      routesOnGlobe.update(routesNow);
      return note(
        { ...view, sites: marked },
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
          only: (picked) => {
            context.change((now) => ({ ...now, humanSpecies: picked }));
          },
          pick: show,
        },
        only,
        mixesAt(ka),
        playStory,
        { places: ancient.sites.length, people: ancient.people },
      );
    }

    return {
      // Our species on the tree of life, from the layer's row in the Layers panel.
      action: () => ({
        label: 'Our species on the tree of life',
        run: () => {
          context.tree.openTree((tree) => tree.ours.humans['sapiens']);
        },
      }),
      load: () => reportAll(layerOn, [claims, routes, admixture, genomes, dispersal]),
      deep(state, moment) {
        storyAsked(state);
        dispersalOn = state.dispersal !== 'off';
        // People are a matter of the last few hundred thousand years: the ice-age scale's.
        const on = state.deepScale === 'ice' && state.layers.has('humans');
        layerOn = on && moment !== null;
        if (moment === null || !on) {
          sitesOnGlobe.update(null);
          routesOnGlobe.update(null);
          dispersal.show(null, 0);
          return moment === null
            ? null
            : { offered: moment.scale === 'ice', on: false, note: null };
        }
        const offered = moment.scale === 'ice';
        const model = dispersal.show(state.dispersal, moment.ma, moment.maPerSecond);
        claims.ask();
        if (claims.value === null) {
          const failed = claims.report(true)?.state === 'failed';
          return {
            offered,
            on: true,
            note: [{ paragraph: [failed ? 'Humans: could not load.' : 'Humans: loading…'] }],
          };
        }
        return { offered, on: true, note: drawn(state, moment.ma * 1000, model, claims.value) };
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
