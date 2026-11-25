/**
 * Earth and the Moon forming, as the aeons begin (#1218): when deep time starts playing from
 * before the giant impact, the formation clock opens at that moment, on the shared own-time
 * service. It carries deep time's moment along, so the sketched globe goes from molten to the
 * first ocean as the clock passes it, and at its end, or closed, hands back to deep time playing
 * on through the aeons. The impact's date is the reader's choice of model (`impact=`).
 *
 * Not a layer: made beside the own-time service, as the start of deep time itself. From Theia's
 * approach the clock draws the impact and the Moon gathering (#180); the disc and Earth growing
 * before it come with #1219.
 */

import {
  APPROACH,
  FIRST_SOLIDS_MA,
  formationMa,
  formationScale,
  formationSeconds,
} from '../../deepTime/formationClock';
import { IMPACTS, type ImpactModel } from '../../deepTime/sketch';
import { EARTH_AGE_MA, type ViewState } from '../../state/viewState';
import type { Capabilities } from '../feature';
import type { OwnTimeEvent } from '../ownTime';
import { DEFAULT_THEIA_MODEL, THEIA_CHOICES, type TheiaModel } from '../../deepTime/theia';
import { DEFAULT_GROWTH_MODEL, earthRadius, type GrowthModel } from '../../deepTime/growth';
import { discLayer } from './discLayer';
import { growthLayer } from './growthLayer';
import { impactLayer } from './impactLayer';
import { IMPACT_DISTANCE, IMPACT_VIEW, RECEDED, RECEDED_DISTANCE } from './impactModel';
import { formationPhases } from './phases';

/** The formation clock's key, the one it is watched by. */
const FORMATION_KEY = 'formation';

/** How far out the camera stands while Earth grows, Earth radii: room for it to fill. */
const GROWTH_DISTANCE = 7;

/** Seconds in a million years. */
const MYR = 1e6 * 365.25 * 86_400;

/**
 * Earth and the Moon forming, for an impact as `model` dates it, Earth growing before it as
 * `growth` has it (#1219).
 */
export function formationEvent(
  model: ImpactModel,
  growth: GrowthModel = DEFAULT_GROWTH_MODEL,
  theia: TheiaModel = DEFAULT_THEIA_MODEL,
): OwnTimeEvent {
  const impactMa = IMPACTS[model].ma;
  const { hit } = THEIA_CHOICES[theia];
  // Millions of years from the first solids to the impact.
  const before = FIRST_SOLIDS_MA - impactMa;
  return {
    key: FORMATION_KEY,
    title: 'Earth and the Moon forming, in their own time',
    phases: formationPhases(impactMa, theia),
    scale: formationScale(impactMa),
    offer: 'Watch Earth and the Moon form',
    drawn:
      'Illustration: Earth grows as the model on the rail has it, thinning the swarm round it, whose pieces are drawn far larger than they were; the impact goes as the scenario on the rail has it, its sizes, speed and distances from the papers, the paths, glow and turning invented. White is hottest; the Moon greys as it crusts.',
    // Its zero, the impact: the header counts from it, not from where play started.
    ma: impactMa,
    deep: {
      maAt: (seconds) => formationMa(impactMa, seconds),
      secondsAt: (ma) => formationSeconds(impactMa, ma),
    },
    play(tools) {
      const on = tools.strikes.on;
      on.dataset['formationClock'] = model;
      on.dataset['formationGrowth'] = growth;
      on.dataset['formationTheia'] = theia;
      const impact = tools.layer(impactLayer);
      const size = tools.layer(growthLayer);
      const disc = tools.layer(discLayer);
      // Drawn back once, as Theia comes in, to see the Moon's orbit whole.
      let framed = false;
      let standing: number | null = null;
      // Opened before it, stood back so Earth is seen to grow against a still frame (#1219).
      let opened = false;
      return {
        at(seconds) {
          if (!opened && seconds < -APPROACH) tools.strikes.zoomTo(GROWTH_DISTANCE);
          opened = true;
          const drawn = seconds >= -APPROACH;
          if (drawn && !framed) tools.strikes.flyTo(IMPACT_VIEW);
          framed ||= drawn;
          // Close enough to see the Moon gather; back again once it has drawn away.
          const distance = seconds < RECEDED ? IMPACT_DISTANCE : RECEDED_DISTANCE;
          if (drawn && distance !== standing) tools.strikes.zoomTo(distance);
          if (drawn) standing = distance;
          impact.update(drawn ? { seconds, hit } : null);
          // The proto-Earth's size until Theia strikes; whole after.
          const myr = before + seconds / MYR;
          size.update(seconds < 0 ? earthRadius(growth, myr, hit.protoEarth) : null);
          // The disc round it until Theia comes in.
          disc.update(drawn ? null : { myr, growth });
        },
        end() {
          impact.update(null);
          size.update(null);
          disc.update(null);
          delete on.dataset['formationClock'];
          delete on.dataset['formationGrowth'];
          delete on.dataset['formationTheia'];
        },
      };
    },
  };
}

/**
 * Whether the formation clock opens now: deep time has just started playing (it was not a moment
 * before), from before the impact as `model` dates it, and the reader has not asked for less
 * motion.
 */
export function opensFormation(
  was: boolean,
  playing: boolean,
  ma: number | null,
  model: ImpactModel,
  lessMotion: boolean,
): boolean {
  return !was && playing && !lessMotion && ma !== null && ma > IMPACTS[model].ma;
}

export interface Formation {
  /** Deep time's moment and playing, seen each time the features are shown. */
  show(state: ViewState): void;
  /**
   * Open the clock now, as a milestone's card asks (#1218): from the moment shown if it is before
   * the impact, else from the start, the first solids. Whether it opened: not outside deep time.
   */
  watch(state: ViewState): boolean;
}

export function createFormation(
  lent: Pick<Capabilities, 'ownTime' | 'timeline'>,
  lessMotion: () => boolean,
): Formation {
  // Whether deep time was playing when last seen.
  let was = false;
  return {
    show(state) {
      const playing = lent.timeline.playing();
      // Less motion is asked only as play starts.
      const opens =
        !was && playing && opensFormation(was, playing, state.ma, state.impact, lessMotion());
      was = playing;
      if (opens && state.ma !== null)
        lent.ownTime.watch(formationEvent(state.impact, state.growth, state.theia), state.ma);
    },
    watch(state) {
      if (state.ma === null) return false;
      const ma = state.ma > IMPACTS[state.impact].ma ? state.ma : EARTH_AGE_MA;
      lent.ownTime.watch(formationEvent(state.impact, state.growth, state.theia), ma);
      return true;
    },
  };
}
