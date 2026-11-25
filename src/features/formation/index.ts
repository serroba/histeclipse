/**
 * Earth and the Moon forming, as the aeons begin (#1218): when deep time starts playing from
 * before the giant impact, the formation clock opens at that moment, on the shared own-time
 * service. It carries deep time's moment along, so the sketched globe goes from molten to the
 * first ocean as the clock passes it, and at its end, or closed, hands back to deep time playing
 * on through the aeons. The impact's date is the reader's choice of model (`impact=`).
 *
 * Not a layer: made beside the own-time service, as the start of deep time itself. What the clock
 * draws comes with the disc and Earth growing (#1219) and the impact (#180).
 */

import { formationMa, formationScale, formationSeconds } from '../../deepTime/formationClock';
import { IMPACTS, type ImpactModel } from '../../deepTime/sketch';
import type { ViewState } from '../../state/viewState';
import type { Capabilities } from '../feature';
import type { OwnTimeEvent } from '../ownTime';
import { formationPhases } from './phases';

/** The formation clock's key, the one it is watched by. */
const FORMATION_KEY = 'formation';

/** Earth and the Moon forming, for an impact as `model` dates it. */
export function formationEvent(model: ImpactModel): OwnTimeEvent {
  const impactMa = IMPACTS[model].ma;
  return {
    key: FORMATION_KEY,
    title: 'Earth and the Moon forming, in their own time',
    phases: formationPhases(impactMa),
    scale: formationScale(impactMa),
    offer: 'Watch Earth and the Moon form',
    // Its zero, the impact: the header counts from it, not from where play started.
    ma: impactMa,
    deep: {
      maAt: (seconds) => formationMa(impactMa, seconds),
      secondsAt: (ma) => formationSeconds(impactMa, ma),
    },
    play(tools) {
      const on = tools.strikes.on;
      on.dataset['formationClock'] = model;
      return {
        at() {
          // Drawn in #1219 and #180; for now the sketched globe follows deep time's moment.
        },
        end() {
          delete on.dataset['formationClock'];
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
      if (opens && state.ma !== null) lent.ownTime.watch(formationEvent(state.impact), state.ma);
    },
  };
}
