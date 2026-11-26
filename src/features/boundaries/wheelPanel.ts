/**
 * Beside the globe while the Planetary boundaries layer is on (#434): the nine boundaries as a
 * flat wheel, how many the assessment shown finds crossed, and a list of the nine to pick one
 * by. A boundary picked says where each of its variables stood, and offers the layers that draw
 * it on the globe; turning one on is a layer toggle, which never moves time. The table of every
 * value is in the layer's Why and the boundaries' story.
 */

import type { LayerFactory } from '../../globe/layerHost';
import type { BoundaryId, Status } from '../../data/planetaryBoundaries';
import type { Layer } from '../../state/viewState';
import { element } from '../../ui/dom';
import { joinGlobePanels } from '../../ui/globePanels';
import { WHEEL_SIZE, type Wheel } from './wheelModel';
import './wheelPanel.css';

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

export const STATUS_WORDS: Readonly<Record<Status, string>> = {
  within: 'within its boundary',
  transgressed: 'crossed',
  strongly: 'crossed, into high risk',
};

/** A boundary picked: where it stands, and the layers that draw it. */
export interface BoundaryDetail {
  readonly id: BoundaryId;
  readonly name: string;
  readonly status: string;
  readonly summary: string | null;
  /** Each variable's value, as the report writes it. */
  readonly values: readonly string[];
  readonly layers: readonly { readonly id: Layer; readonly label: string; readonly on: boolean }[];
}

export interface BoundariesView {
  readonly wheel: Wheel;
  /** The assessment drawn, and how many it finds crossed. */
  readonly heading: string;
  /** Whether the other assessment can be shown beside it, and whether it is. */
  readonly compare: { readonly offered: boolean; readonly on: boolean; readonly label: string };
  readonly picked: BoundaryDetail | null;
}

/** What the reader does in the panel. */
export interface BoundariesActions {
  pick(id: BoundaryId | null): void;
  compare(on: boolean): void;
  turnOn(layer: Layer): void;
}

function wheelDrawn(wheel: Wheel, picked: BoundaryId | null, actions: BoundariesActions) {
  const root = svg('svg', {
    viewBox: `0 0 ${String(WHEEL_SIZE)} ${String(WHEEL_SIZE)}`,
    class: 'boundaries-wheel',
    'aria-hidden': 'true',
  });
  const middle = String(WHEEL_SIZE / 2);
  const ring = (radius: number, kind: string) =>
    svg('circle', {
      cx: middle,
      cy: middle,
      r: radius.toFixed(2),
      class: `boundaries-ring ${kind}`,
    });
  root.append(ring(wheel.rings.boundary, 'is-safe-area'));
  for (const boundary of wheel.boundaries) {
    const group = svg('g', {
      class: `boundaries-sector${boundary.id === picked ? ' is-picked' : ''}`,
      'data-boundary': boundary.id,
    });
    const title = svg('title', {});
    title.textContent = boundary.name;
    group.append(title, svg('path', { d: boundary.sector, class: 'boundaries-hit' }));
    for (const part of boundary.parts) {
      group.append(
        svg('path', {
          d: part.d,
          class: `boundaries-part is-${part.zone}${part.faded ? ' is-faded' : ''}`,
        }),
      );
    }
    for (const bar of boundary.bars) group.append(svg('path', { d: bar, class: 'boundaries-bar' }));
    group.addEventListener('click', () => {
      actions.pick(boundary.id === picked ? null : boundary.id);
    });
    root.append(group);
  }
  root.append(
    ring(wheel.rings.reference, 'is-reference'),
    ring(wheel.rings.boundary, 'is-boundary'),
    ring(wheel.rings.highRisk, 'is-high-risk'),
  );
  return root;
}

function namesList(wheel: Wheel, picked: BoundaryId | null, actions: BoundariesActions) {
  return element(
    'ul',
    { class: 'boundaries-names' },
    ...wheel.boundaries.map((boundary) => {
      const button = element(
        'button',
        {
          type: 'button',
          class: `boundaries-name is-${boundary.status ?? 'none'}`,
          'aria-pressed': String(boundary.id === picked),
          'data-boundary': boundary.id,
        },
        boundary.name,
      );
      button.addEventListener('click', () => {
        actions.pick(boundary.id === picked ? null : boundary.id);
      });
      return element('li', {}, button);
    }),
  );
}

function detailOf(picked: BoundaryDetail, actions: BoundariesActions): HTMLElement {
  const offers = picked.layers.map((layer) => {
    const button = element(
      'button',
      { type: 'button', class: 'boundaries-layer', 'data-layer': layer.id },
      layer.on ? `${layer.label}: on` : `Show ${layer.label}`,
    );
    button.disabled = layer.on;
    button.addEventListener('click', () => {
      actions.turnOn(layer.id);
    });
    return button;
  });
  return element(
    'div',
    { class: 'boundaries-detail', 'data-testid': 'boundaries-detail' },
    element('p', { class: 'boundaries-detail-name' }, `${picked.name}: ${picked.status}`),
    ...(picked.summary === null ? [] : [element('p', {}, picked.summary)]),
    element(
      'ul',
      { class: 'boundaries-values' },
      ...picked.values.map((v) => element('li', {}, v)),
    ),
    offers.length === 0
      ? element('p', { class: 'boundaries-none' }, 'No layer draws this boundary on the globe yet.')
      : element('p', { class: 'boundaries-offers' }, ...offers),
  );
}

/** The panel, made with what the reader's choices do; null takes it away. */
export function boundariesPanel(actions: BoundariesActions): LayerFactory<BoundariesView | null> {
  return (host) => {
    const heading = element('p', { class: 'boundaries-heading', 'aria-live': 'polite' });
    const drawing = element('div', { class: 'boundaries-drawing' });
    const names = element('div', {});
    const box = element('input', { type: 'checkbox', class: 'boundaries-compare-box' });
    const compareText = element('span', {});
    box.addEventListener('change', () => {
      actions.compare(box.checked);
    });
    const compare = element('label', { class: 'boundaries-compare' }, box, compareText);
    const detail = element('div', {});
    const root = element(
      'section',
      { class: 'boundaries-panel', 'aria-label': 'Planetary boundaries', hidden: '' },
      heading,
      drawing,
      compare,
      names,
      detail,
      element(
        'p',
        { class: 'boundaries-credit' },
        'Planetary Health Check 2026, Table 7.1; Richardson et al. (2023). Rings: the boundary (green) and the high-risk line (orange); eased past it, not to scale.',
      ),
    );
    joinGlobePanels(host.container, root, 0);
    let drawnFor: BoundariesView | null = null;
    return {
      update(view) {
        root.hidden = view === null;
        if (view === null || view === drawnFor) return;
        drawnFor = view;
        heading.textContent = view.heading;
        const picked = view.picked?.id ?? null;
        drawing.replaceChildren(wheelDrawn(view.wheel, picked, actions));
        names.replaceChildren(namesList(view.wheel, picked, actions));
        compare.hidden = !view.compare.offered;
        box.checked = view.compare.on;
        compareText.textContent = view.compare.label;
        detail.replaceChildren(...(view.picked === null ? [] : [detailOf(view.picked, actions)]));
      },
    };
  };
}
