/**
 * A strike watched in its own time (#1173, #1191): Chicxulub on its log clock, the strike
 * driven by it and the ground round the crater with it (#1175, #1176). Made where the crater
 * lay at the moment shown, by Impacts from its crater and by Extinctions from the
 * end-Cretaceous.
 */

import { STRIKE_SCALE } from '../../deepTime/strikeClock';
import type { OwnTimeEvent } from '../ownTime';
import { strikeGroundLayer } from './strikeGroundLayer';
import type { EventPhase } from '../ownTime';
import type { ImpactPlay } from './view';

export function strikeEvent(spec: ImpactPlay, phases: readonly EventPhase[]): OwnTimeEvent {
  return {
    key: spec.key,
    title: `${spec.key}, in its own time`,
    phases,
    scale: STRIKE_SCALE,
    offer: `Watch ${spec.key} in its own time`,
    play(tools) {
      const playing = tools.strikes.playImpact({ ...spec, driven: true });
      const ground = tools.layer(strikeGroundLayer);
      tools.strikes.on.dataset['strikeClock'] = spec.key;
      return {
        at(seconds) {
          playing.at(seconds);
          ground.update({ place: spec.place, seconds, worldwide: spec.worldwide });
        },
        end() {
          playing.end();
          ground.update(null);
          delete tools.strikes.on.dataset['strikeClock'];
        },
      };
    },
  };
}
