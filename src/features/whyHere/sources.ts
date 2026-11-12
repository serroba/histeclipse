/**
 * The Sources list in the "why" sheet (#451): the whys of what is on screen now, drawn again
 * only when that changes.
 */

import type { WhyId } from '../../sources/registry';
import { onScreen } from '../../state/whysOnScreen';
import { LAYER_GROUPS } from '../../state/layerCatalog';
import type { ViewState } from '../../state/viewState';
import { element } from '../../ui/dom';
import type { WhySheet } from '../../ui/whySheet';

// The layers drawn on each span, as the Layers panel has them.
const LAYER_SPANS = new Map(
  LAYER_GROUPS.flatMap((group) => group.layers.map((layer) => [layer.id, layer.spans] as const)),
);

/** The whys of what is on screen: the mode, the span, the body, the layers, an eclipse. */
function whysOnScreen(state: ViewState): WhyId[] {
  return onScreen({
    mode: state.mode,
    span: state.ma === null ? 'years' : state.deepScale,
    focus: state.focus,
    layers: state.layers,
    borders: state.borders,
    eclipse: state.selection !== null,
    drawsOn: (layer, span) => LAYER_SPANS.get(layer)?.includes(span) ?? false,
  });
}

export function createSourcesList(why: Pick<WhySheet, 'renderOnScreen'>): {
  readonly list: HTMLElement;
  readonly show: (state: ViewState) => void;
} {
  const list = element('ul', { class: 'why-list', 'data-testid': 'sources-list' });
  let shown = '';
  return {
    list,
    show(state) {
      const ids = whysOnScreen(state);
      const key = ids.join(' ');
      if (key === shown) return;
      shown = key;
      why.renderOnScreen(list, ids);
    },
  };
}
