/**
 * Deep time's sketch, before the surface maps reach: the globe's sketch of the hypotheses chosen
 * (#605), the questions at the globe's left with their answers (#1158), and the delivered water's
 * icy impactors as play passes them (#1142). Where the plates reach, their continents are the
 * land, Plates on or not (#1149); beyond, land of invented shape.
 */

import { sketchAt, type Sketch, type SketchChoices } from '../../deepTime/sketch';
import type { Globe } from '../../globe/globe';
import type { ViewState } from '../../state/viewState';
import { createHypothesisRail } from './hypothesisRail';
import { createWaterStrikes } from './waterStrikes';

/** The moment shown in deep time, as the sketch needs it. */
interface SketchMoment {
  readonly ma: number;
  /** Before the elevation maps reach. */
  readonly uncharted: boolean;
  /** Where a reconstruction's continents reach. */
  readonly reconstructed: boolean;
}

export interface SketchView {
  readonly root: HTMLElement;
  /** The moment (null outside deep time), and whether time plays: the sketch drawn, if any. */
  show(
    state: ViewState,
    moment: SketchMoment | null,
    playing: boolean,
  ): { readonly sketch: Sketch; readonly choices: SketchChoices } | null;
}

export function createSketchView(
  globe: Pick<Globe, 'setSketch' | 'playImpact'>,
  onSketch: (choice: Partial<SketchChoices>) => void,
  lessMotion: boolean,
): SketchView {
  const rail = createHypothesisRail(onSketch);
  const strikes = createWaterStrikes((spec) => {
    globe.playImpact(spec);
  }, lessMotion);
  return {
    root: rail.root,
    show(state, moment, playing) {
      strikes.show(state, moment?.ma ?? null, playing);
      const { impact, land, snowball, water } = state;
      const choices = { impact, land, snowball, water };
      const sketch =
        moment?.uncharted === true ? sketchAt(moment.ma, choices, moment.reconstructed) : null;
      globe.setSketch(sketch);
      const view = sketch === null ? null : { sketch, choices };
      rail.render(view);
      return view;
    },
  };
}
