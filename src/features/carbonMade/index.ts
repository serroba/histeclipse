/**
 * Where cosmic rays make carbon-14 (#269), as a part of the page: a glow over the globe on the
 * spans and years radiocarbon reaches, for the field and Sun picked in its card, the field at
 * the moment shown loaded with the layer (GGF100k), and what the Layers panel says of it.
 */

import { dipoleAt, loadDipole, type DipoleSeries } from '../../data/dipoleMoment';
import { DATABLE_YEARS } from '../../data/radiocarbonProduction';
import type { Globe } from '../../globe/scene';
import { CARBON_LIMIT } from '../../state/layerCatalog';
import type { ViewState } from '../../state/viewState';
import { createCarbonMadeCard, glowOf, THEN_ID, THEN_UNKNOWN, thenField } from './carbonMadeCard';
import { errorMessage } from '../../util/errors';
import type { PartContext } from '../part';

/** What the glow asks of the rest of the page. */
export interface CarbonMadeContext extends PartContext {
  readonly globe: Pick<Globe, 'setC14Glow'>;
  /** Play the shower under a field's dipole. */
  watchShower(dipole: number, fromSun: boolean): void;
  /** Say it again in the Layers panel: the field, or the card's choice, changed. */
  refresh(): void;
}

export interface CarbonMadePart {
  readonly dialog: HTMLElement;
  /** The glow, as the moment and the layers have it. */
  readonly show: (state: ViewState) => void;
  /** What the Layers panel says under the layer, if anything. */
  readonly said: () => string | null;
  /** The Layers panel's way to the card, while the layer is on. */
  readonly action: () => { readonly label: string; readonly run: () => void } | null;
}

export function mountCarbonMade(context: CarbonMadeContext): CarbonMadePart {
  const { base, fetchJson, store, globe } = context;
  // Where cosmic rays make carbon-14 (#269): a glow over the globe, for the field and Sun picked
  // in its card.
  const carbonMadeCard = createCarbonMadeCard(
    () => {
      showCarbonMade(store.get());
      context.refresh();
    },
    (made, fromSun) => {
      context.watchShower(made.field.dipole, fromSun);
    },
  );
  let carbonMadeSaid: string | null = null;
  let carbonMadeAction: { readonly label: string; readonly run: () => void } | null = null;

  // The dipole's strength through the years radiocarbon reaches (GGF100k), loaded with the layer.
  let dipole: DipoleSeries | null = null;
  let dipoleAsked = false;

  /** The field at the moment shown, or null until it loads or beyond its reach. */
  function fieldThen(state: ViewState): ReturnType<typeof thenField> | null {
    if (dipole === null) {
      if (!dipoleAsked) {
        dipoleAsked = true;
        loadDipole(`${base}data/dipole.json`, fetchJson).then(
          (loaded) => {
            dipole = loaded;
            showCarbonMade(store.get());
            context.refresh();
          },
          (error: unknown) => {
            dipoleAsked = false;
            context.notify(`Could not load the field's strength: ${errorMessage(error)}`);
          },
        );
      }
      return null;
    }
    // Thousands of years before 1950, as the model counts.
    const ka = state.ma === null ? (1950 - state.time.date.year) / 1000 : state.ma * 1000;
    const strength = dipoleAt(dipole, ka);
    return strength === null ? null : thenField(strength);
  }

  /** The glow, on the spans and years radiocarbon reaches; what the layer says, and its card. */
  function showCarbonMade(state: ViewState): void {
    const layerOn = state.layers.has('carbonMade') && state.mode === 'globe';
    const span = state.ma === null ? 'years' : state.deepScale;
    const here = span === 'years' || span === 'ice';
    const reached = state.ma === null || state.ma * 1e6 <= DATABLE_YEARS;
    carbonMadeAction =
      layerOn && here
        ? {
            label: 'How is it made?',
            run: () => {
              carbonMadeCard.open();
            },
          }
        : null;
    if (!layerOn || !here || !reached) {
      carbonMadeSaid = layerOn && here ? CARBON_LIMIT : null;
      globe.setC14Glow(null);
      return;
    }
    carbonMadeCard.setThen(fieldThen(state));
    const made = carbonMadeCard.current();
    globe.setC14Glow(glowOf(made));
    const sun = made.sun.label.toLowerCase();
    if (made.field.id !== THEN_ID) {
      carbonMadeSaid =
        state.ma === null
          ? `${made.field.label} field, ${sun}: most is made over the poles.`
          : `Drawn for the field picked (${made.field.label.toLowerCase()}), not that of the moment shown.`;
      return;
    }
    const strength = made.field.dipole.toFixed(1);
    carbonMadeSaid =
      made.field !== THEN_UNKNOWN
        ? made.field.dipole < 4
          ? `The field at the moment shown is weak, ${strength} × 10²² A m² (GGF100k; today’s is 7.8): more is made, and nearer the equator. Other models put this low far lower (Korte et al. 2019).`
          : `The field at the moment shown, ${strength} × 10²² A m² (GGF100k), ${sun}: most is made over the poles.`
        : `The field at the moment shown is not known yet; today’s is drawn, ${sun}.`;
  }

  return {
    dialog: carbonMadeCard.dialog,
    show: showCarbonMade,
    said: () => carbonMadeSaid,
    action: () => carbonMadeAction,
  };
}
