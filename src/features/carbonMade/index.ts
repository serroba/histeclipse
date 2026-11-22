/**
 * Where cosmic rays make carbon-14 (#269), as a feature (#380, #909): a glow over the globe on
 * the spans and years radiocarbon reaches, for the field and Sun picked in its card, the field
 * at the moment shown loaded with the layer (GGF100k), and what the Layers panel says of it.
 */

import { dipoleAt, loadDipole, type DipoleSeries } from '../../data/dipoleMoment';
import { DATABLE_YEARS } from '../../data/radiocarbonProduction';
import { CARBON_LIMIT } from '../../state/layerCatalog';
import type { ViewState } from '../../state/viewState';
import { loadOnce } from '../layerLoad';
import { feature, type LayerAction } from '../feature';
import { createCarbonMadeCard, glowOf, thenField } from './carbonMadeCard';
import { carbonMadeNote } from './said';

/** Thousands of years before 1950, as the field's model counts. */
function kaOf(state: ViewState): number {
  return state.ma === null ? (1950 - state.time.date.year) / 1000 : state.ma * 1000;
}

/** Whether the layer is on where it draws: the globe, on the years or the ice ages' span. */
function drawnHere(state: ViewState): boolean {
  const span = state.ma === null ? 'years' : state.deepScale;
  return (
    state.layers.has('carbonMade') && state.mode === 'globe' && (span === 'years' || span === 'ice')
  );
}

export const carbonMadeFeature = feature({
  id: 'carbonMade',
  needs: ['carbonGlow', 'shower', 'overPage'],
  watches: (state) => [state.layers, state.mode, state.ma, state.deepScale],
  mount(context) {
    const { base, fetchJson } = context;
    // What the glow was last drawn for: drawn again only when that, or the card's choice, changes.
    let drawnFor: string | null = null;
    const again = (): void => {
      drawnFor = null;
      context.refresh();
    };
    const card = createCarbonMadeCard(again, (made, fromSun) => {
      context.shower.watch(made.field.dipole, fromSun);
    });
    context.overPage.add(card.dialog);
    const action: LayerAction = {
      label: 'How is it made?',
      run: () => {
        card.open();
      },
    };
    let said: string | null = null;
    let offered: LayerAction | null = null;

    // The dipole's strength through the years radiocarbon reaches (GGF100k), loaded with the layer.
    const dipoleLoad = loadOnce<DipoleSeries>({
      fetch: () => loadDipole(`${base}data/dipole.json`, fetchJson),
      what: "the field's strength",
      context,
    });
    let here = false;

    /** The field at the moment shown, or null until it loads or beyond its reach. */
    function fieldThen(state: ViewState): ReturnType<typeof thenField> | null {
      const dipole = dipoleLoad.value();
      if (dipole === null) {
        dipoleLoad.want();
        return null;
      }
      const strength = dipoleAt(dipole, kaOf(state));
      return strength === null ? null : thenField(strength);
    }

    return {
      /** The glow, on the spans and years radiocarbon reaches; what the layer says, and its card. */
      show(state) {
        here = drawnHere(state);
        const reached = state.ma === null || state.ma * 1e6 <= DATABLE_YEARS;
        offered = here ? action : null;
        if (!here || !reached) {
          said = here ? CARBON_LIMIT : null;
          drawnFor = null;
          context.carbonGlow.setC14Glow(null);
          return;
        }
        // The same year or moment of deep time, on the same span: nothing to draw again.
        const now = `${String(state.ma)}|${String(state.time.date.year)}`;
        if (now === drawnFor) return;
        card.setThen(fieldThen(state));
        const made = card.current();
        context.carbonGlow.setC14Glow(glowOf(made));
        said = carbonMadeNote(made, state.ma !== null);
        // Still loading: the field of the moment has yet to be drawn.
        drawnFor = dipoleLoad.value() === null ? null : now;
      },
      said: () => said,
      action: () => offered,
      load: () => dipoleLoad.report(here),
    };
  },
});
