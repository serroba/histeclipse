/**
 * The layers on, as the chips beside Layers show them (#728): each by name, whether it draws on
 * the span shown, and if not, how far its data reaches and where it does draw. Turning a layer
 * on or off never moves time or the camera; going to where it draws is a choice of its own.
 */

import { LAYER_GROUPS, type LayerChoice } from './layerCatalog';
import { LAYERS, SPAN_LABELS, type Layer, type Span, type ViewState } from './viewState';

export interface ActiveLayer {
  readonly layer: Layer;
  readonly label: string;
  /** Whether it draws on the span shown. */
  readonly draws: boolean;
  /** How far its data reaches, said where it does not draw. */
  readonly reach: string;
  /** Where it draws, where it does not here: a span, a moment of its own there, and in words. */
  readonly goTo: { readonly span: Span; readonly ma?: number; readonly label: string } | null;
}

const CHOICES: ReadonlyMap<Layer, LayerChoice> = new Map(
  LAYER_GROUPS.flatMap((group) => group.layers.map((choice) => [choice.id, choice] as const)),
);

/** The span a view shows. */
export function spanShown(state: Pick<ViewState, 'ma' | 'deepScale'>): Span {
  return state.ma === null ? 'years' : state.deepScale;
}

/** The layers on, in the catalogue's order, each with whether it draws here. */
export function activeLayers(state: Pick<ViewState, 'layers' | 'ma' | 'deepScale'>): ActiveLayer[] {
  const span = spanShown(state);
  return LAYERS.filter((layer) => state.layers.has(layer)).flatMap((layer) => {
    const choice = CHOICES.get(layer);
    if (choice === undefined) return [];
    const draws = choice.spans.includes(span);
    const to = choice.spans[0];
    const goTo =
      draws || to === undefined
        ? null
        : {
            span: to,
            ...(choice.arrive === undefined ? {} : { ma: choice.arrive.ma }),
            label: choice.arrive?.label ?? SPAN_LABELS[to],
          };
    return [{ layer, label: choice.label, draws, reach: choice.reach, goTo }];
  });
}
