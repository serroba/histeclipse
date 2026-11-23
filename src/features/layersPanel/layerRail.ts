/**
 * The layers on the zoom rail (#1156): a round icon for each layer the span shown offers, in the
 * Layers panel's groups and order, pressed while on; a tap turns it on or off, never moving time
 * or the camera. A layer on that draws nothing here (loading, failed, a year it has none for) is
 * marked, and says why with its name. Those the rail has buttons of its own for (the planets'
 * orbits, the spacecraft, the asteroids) are left to them. Last, All layers opens the panel.
 */

import { LAYER_GROUPS } from '../../state/layerCatalog';
import type { ActiveLayer } from '../../state/activeLayers';
import type { Layer, Span } from '../../state/viewState';
import { element } from '../../ui/dom';
import { layerIcon, uiIcon } from '../../ui/icons';
import './layerRail.css';

/** On the rail already, each with a button of its own (zoomRailIcons.ts). */
const ON_THE_RAIL: ReadonlySet<Layer> = new Set(['orbits', 'spacecraft', 'asteroids']);

/** The layers `span` offers on the rail, by the panel's groups, empty groups left out. */
export function railGroups(span: Span): readonly (readonly { id: Layer; label: string }[])[] {
  return LAYER_GROUPS.map((group) =>
    group.layers
      .filter((choice) => choice.spans.includes(span) && !ON_THE_RAIL.has(choice.id))
      .map((choice) => ({ id: choice.id, label: choice.label })),
  ).filter((group) => group.length > 0);
}

/**
 * The rail's order for `span`: the layers on first, as a group of their own, then the rest by the
 * panel's groups. Set as the span is shown, and kept while layers are turned on and off there,
 * so an icon never moves from under the finger that turned it.
 */
export function railOrder(
  span: Span,
  on: ReadonlySet<Layer>,
): readonly (readonly { id: Layer; label: string }[])[] {
  const groups = railGroups(span);
  const first = groups.flat().filter((each) => on.has(each.id));
  const rest = groups
    .map((group) => group.filter((each) => !on.has(each.id)))
    .filter((group) => group.length > 0);
  return first.length === 0 ? rest : [first, ...rest];
}

export interface LayerRailHandlers {
  /** A layer turned on or off from its icon. */
  readonly onLayer: (layer: Layer, on: boolean) => void;
  /** Open the Layers panel, the focus to come back to `opener`. */
  readonly onAll: (opener: HTMLElement) => void;
}

export interface LayerRail {
  readonly root: HTMLElement;
  /** Whether the rail shows, and the span shown offers any layer here. */
  readonly offered: () => boolean;
  /** The span shown, the layers on and how each stands; hidden where layers are not offered. */
  render(
    span: Span,
    on: ReadonlySet<Layer>,
    active: readonly ActiveLayer[],
    visible?: boolean,
  ): void;
}

export function createLayerRail(handlers: LayerRailHandlers): LayerRail {
  const buttons = new Map<Layer, HTMLButtonElement>();
  const button = (id: Layer, label: string): HTMLButtonElement => {
    const made =
      buttons.get(id) ??
      element(
        'button',
        {
          type: 'button',
          class: 'zoom-step rail-layer',
          'data-layer': id,
          'data-name': label,
          'aria-label': label,
        },
        layerIcon(id, 18),
      );
    if (!buttons.has(id)) {
      made.addEventListener('click', () => {
        handlers.onLayer(id, made.getAttribute('aria-pressed') !== 'true');
      });
      buttons.set(id, made);
    }
    return made;
  };
  const all = element(
    'button',
    { type: 'button', class: 'zoom-step rail-layer rail-all', 'aria-label': 'All layers' },
    uiIcon('layers'),
  );
  all.addEventListener('click', () => {
    handlers.onAll(all);
  });
  const list = element('div', { class: 'rail-layer-list' });
  const root = element(
    'div',
    { class: 'rail-layers', role: 'group', 'aria-label': 'Layers here' },
    list,
    all,
  );
  let shownSpan: Span | null = null;
  return {
    root,
    offered: () => root.hidden !== true && list.childElementCount > 0,
    render(span, on, active, visible = true) {
      root.hidden = !visible;
      if (span !== shownSpan) {
        shownSpan = span;
        list.replaceChildren(
          ...railOrder(span, on).map((group) =>
            element(
              'div',
              { class: 'rail-layer-group' },
              ...group.map((each) => button(each.id, each.label)),
            ),
          ),
        );
      }
      const states = new Map(active.map((each) => [each.layer, each]));
      for (const [id, made] of buttons) {
        const state = states.get(id);
        made.setAttribute('aria-pressed', String(on.has(id)));
        const name = made.dataset['name'] ?? id;
        if (state === undefined || state.draws) {
          delete made.dataset['coverage'];
          made.title = name;
          made.setAttribute('aria-label', name);
          continue;
        }
        made.dataset['coverage'] = state.coverage;
        const why = state.why ?? state.reach;
        made.title = `${name}: ${why}`;
        made.setAttribute('aria-label', `${name}: ${why}`);
      }
    },
  };
}
