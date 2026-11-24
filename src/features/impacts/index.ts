/**
 * Impact craters and deposits as a feature (#380, #474, #909): loaded the first time the layer
 * is turned on, in either time; drawn where they lay at the moment shown; struck as deep time
 * runs past them; a crater's card, and a play of it.
 */

import {
  greatImpacts,
  loadImpacts,
  impactsAt,
  impactsText,
  placeThen,
  type Impact,
  type Impacts,
  type ImpactsMode,
} from '../../data/impacts';
import { impactLayer } from './impactLayer';
import type { PlayedImpact, PlayingImpact } from '../../globe/heldStrikes';
import { playKeys } from '../../ui/playKeys';
import { illustrationKeys } from './illustrationKeys';
import { heldStrikes } from '../../globe/heldStrikes';
import { createStrikeClock, type StrikeClock } from './strikeClock';
import { strikePhasesOf, type StrikePhase } from './strikePhases';
import type { ViewState } from '../../state/viewState';
import { IMPACTS_CHIP, impactsChip, type ImpactsView } from './chip';
import type { RelatedStep } from '../../ui/markerCard';
import { whenItStruck } from '../../explore/related';
import { loadPictures, pictureFor, type Pictures } from '../../data/pictures';
import { errorMessage } from '../../util/errors';
import { loadOnce } from '../../state/loadOnce';
import { feature, RESTING, type FeatureContext, type FeatureInstance } from '../feature';
import {
  impactCard,
  impactPlay,
  impactsOn,
  impactsScale,
  pickedImpact,
  placeMaFor,
  sinceYear,
  strikePlaces,
  strikesToPlay,
  struckList,
  type ImpactPlay,
} from './view';

const NEEDS = ['cards', 'timeline', 'deepTime', 'strikes', 'overPage'] as const;
/** How long a strike is followed, ms: longer than the longest plays, on a slow device too. */
const FOLLOW_MS = 30_000;
type ImpactsContext = FeatureContext<(typeof NEEDS)[number]>;

/** From a crater (#731): the Earth when it struck, facing where the plates had it. */
function struckFrom(
  data: Impacts,
  impact: Impact,
  shownMa: number | null,
  deepTime: ImpactsContext['deepTime'],
): RelatedStep[] {
  const step = whenItStruck(impact.olderMa, impact.youngerMa, shownMa);
  const where = step === null ? null : placeThen(data, impact, step.ma);
  if (step === null || where === null) return [];
  return [
    {
      label: step.label,
      explain: step.explain,
      run: () => {
        deepTime.goTo(step.ma, 'impacts', where);
      },
    },
  ];
}

function mountImpacts(context: ImpactsContext): FeatureInstance {
  const globe = context.strikes;
  const onGlobe = context.globe.addLayer(impactLayer);
  // The view last shown: what a crater tapped is read against.
  let latest: ViewState | null = null;
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let impacts: Impacts | null = null;
  let said: string | null = null;
  let mode: ImpactsMode = 'around';
  // Where deep time was in the frame before, while it plays.
  let strikeFrom: number | null = null;
  // The craters' photos (#1088), loaded the first time a card opens; the crater last tapped.
  let pictures: Pictures | null = null;
  let picturesAsked = false;
  let picked: Impact | null = null;
  // The strikes still playing, by crater, and until when (ms): they follow their crater as the
  // plates carry it, deep time running on while they play.
  const following = new Map<string, { readonly playing: PlayingImpact; readonly until: number }>();
  function follow(name: string, playing: PlayingImpact): void {
    following.set(name, { playing, until: performance.now() + FOLLOW_MS });
  }
  // The strikes as deep time runs, held with it as the reader pauses; and the card's
  // illustration last played, which the shared keys pause and step (#807).
  const struck = heldStrikes();
  let illustration: PlayedImpact | null = null;
  playKeys.add(
    illustrationKeys(
      () => illustration,
      () => context.timeline.playing(),
    ),
  );

  // The craters, loaded the first time the layer is on (#762).
  const load = loadOnce<Impacts>({
    fetch: () => loadImpacts(`${context.base}data/impacts.json`, context.fetchJson),
    what: 'the impact craters',
    context,
  });
  let loadOn = false;

  function show(state: ViewState): ImpactsView {
    latest = state;
    const { ma } = state;
    const scale = impactsScale(state, context.timeline.oldest());
    const on = impactsOn(state, scale);
    loadOn = on;
    if (!on || (context.timeline.travelling() && ma === null)) {
      said = on ? RESTING : null;
      onGlobe.update(null);
      return { on: false };
    }
    impacts = load.value();
    if (impacts === null) {
      load.want();
      said =
        load.status() === 'failed'
          ? 'Could not load the impact craters.'
          : 'Loading the impact craters…';
      return { on: true, text: null, mode };
    }
    if (ma === null) {
      const marks = impactsAt(impacts, sinceYear(state), true);
      onGlobe.update(marks);
      said = impactsText(impacts, marks, null);
      return { on: true, text: said, mode };
    }
    const placeMa = placeMaFor(scale, ma);
    const marks = impactsAt(impacts, ma, false, placeMa, mode);
    onGlobe.update(marks);
    strikeAsItPasses(state, impacts, ma, placeMa);
    followStrikes(impacts, placeMa);
    said = null;
    return { on: true, text: impactsText(impacts, marks, ma, mode), mode };
  }

  // As deep time plays, each crater strikes when the time passes it (#242, #314): several at
  // once, only on the side of the globe in view, and never for a reader who asks for less motion.
  function strikeAsItPasses(state: ViewState, data: Impacts, ma: number, placeMa: number): void {
    const from = strikeFrom;
    const playing = context.timeline.playing();
    struck.sync(context.timeline.paused());
    strikeFrom = playing ? ma : null;
    if (from === null || !playing || lessMotion.matches || state.focus !== 'earth') return;
    for (const { impact, place } of strikesToPlay(data, from, ma, placeMa, state.camera.target)) {
      globe.on.dataset['strikes'] = struckList(globe.on.dataset['strikes'], impact.name);
      const spec = impactPlay(impact.name, place, impact.diameterKm ?? 0);
      follow(impact.name, struck.add(globe.playImpact(spec)));
    }
  }

  /** Carry each strike still playing to where the plates have its crater now. */
  function followStrikes(data: Impacts, placeMa: number): void {
    const now = performance.now();
    for (const [name, { until }] of following) if (now > until) following.delete(name);
    if (following.size === 0) return;
    for (const { impact, place } of strikePlaces(data, following.keys(), placeMa)) {
      following.get(impact.name)?.playing.moveTo(place);
    }
  }

  /** A crater's card, with its photo and Wikipedia page once they have come (#1088). */
  function showCard(data: Impacts, impact: Impact): void {
    const shownMa = latest?.ma ?? null;
    const card = impactCard(data, impact, shownMa ?? 0, play);
    const photo = pictureFor(pictures, String(impact.id), `The ${impact.name} impact structure`);
    context.cards.show({
      ...card,
      ...(photo.image === undefined ? {} : { image: photo.image }),
      links: [...card.links, ...photo.links],
      related: struckFrom(data, impact, shownMa, context.deepTime),
    });
  }

  /** Load the photos once; the card still open shows its photo when they come. */
  function askPictures(): void {
    if (picturesAsked) return;
    picturesAsked = true;
    loadPictures(`${context.base}data/impact-pictures.json`, context.fetchJson).then(
      (loaded) => {
        pictures = loaded;
        if (impacts !== null && picked !== null && context.cards.open()) showCard(impacts, picked);
      },
      (error: unknown) => {
        picturesAsked = false;
        context.notify(`Could not load the craters’ photos: ${errorMessage(error)}`);
      },
    );
  }

  /** Play an impact at its place: turn the globe to it, come in close, and let it fall. */
  function play(spec: ImpactPlay): void {
    context.change((state) =>
      state.focus === 'earth' ? state : { ...state, focus: 'earth', on: null, view: 'free' },
    );
    globe.flyTo(spec.place);
    // How far out the view is now, read as the view is: no nearer than it already is. One that
    // reached the whole globe is watched from further out, its front crossing the globe (#1167).
    let distance = spec.worldwide > 0.5 ? 3.4 : 2.2;
    context.change((state) => {
      distance = spec.worldwide > 0.5 ? distance : Math.min(state.camera.distance, distance);
      return state;
    });
    globe.zoomTo(distance);
    const phases = strikePhasesOf(spec.key);
    // Once the globe has turned to it: in its own time, where the clock tells it (#1173).
    window.setTimeout(() => {
      if (phases === null) {
        illustration = globe.playImpact(spec);
        follow(spec.key, illustration);
        return;
      }
      openClock(spec, phases);
    }, 1000);
  }

  // The strike clock (#1173), made the first time a strike is watched in its own time, and the
  // strike it drives.
  let clock: StrikeClock | null = null;
  function openClock(spec: ImpactPlay, phases: readonly StrikePhase[]): void {
    // One at a time: closing the last ends its strike.
    clock?.close();
    clock?.root.remove();
    const playing = globe.playImpact({ ...spec, driven: true });
    follow(spec.key, playing);
    globe.on.dataset['strikeClock'] = spec.key;
    clock = createStrikeClock({
      title: `${spec.key}, in its own time`,
      phases,
      onMoment(seconds) {
        playing.at(seconds);
      },
      onClose() {
        playing.end();
        delete globe.on.dataset['strikeClock'];
      },
    });
    context.overPage.add(clock.root);
    clock.open();
  }

  return {
    show(state) {
      show(state);
    },
    // Its chip in deep time's bar, drawing the craters for the view.
    deep: (state, moment) =>
      moment === null
        ? null
        : impactsChip(show(state), moment.scale, (next) => {
            mode = next;
            context.refresh();
          }),
    said: () => said,
    load: () => load.report(loadOn),
    // Play eases near the great impacts while the layer is on (#1077).
    finds: (state) =>
      impacts === null || !state.layers.has('impacts') ? [] : greatImpacts(impacts),
    pick(id) {
      const impact = pickedImpact(impacts, `impact:${id}`);
      if (impacts === null || impact === undefined) return;
      picked = impact;
      showCard(impacts, impact);
      askPictures();
    },
    unpick() {
      picked = null;
    },
    // What the Layers panel offers under the layer: the craters' paths through time, in 3D.
    action: () => ({
      label: 'Their paths through time, in 3D',
      run: () => {
        context.change((state) => ({ ...state, craters: 'all' }));
      },
    }),
  };
}

export const impactsFeature = feature({
  id: 'impacts',
  needs: NEEDS,
  watches: (state) => [state.layers, state.mode, state.ma, state.deepScale, state.focus],
  picks: 'impact',
  deepChip: IMPACTS_CHIP,
  // After the others' chips in deep time's bar, as it was.
  deepChipOrder: 1,
  mount: mountImpacts,
});
