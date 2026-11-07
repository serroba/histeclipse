/**
 * Optional layers on the globe, switched on and off like Windy's, from one panel for all of
 * time: grouped by what they show, each saying when the moment shown lies outside its data. A
 * layer that draws on other spans is greyed, says which, and offers to go there; it can still be
 * turned on, and draws once the span is one of its own. The panel does not block the globe: the
 * reader can change the date with it open and watch the layers change.
 */

import { elsewhereNote, LAYER_GROUPS, layerNote } from '../state/layerCatalog';
import {
  BORDER_SOURCES,
  SPAN_LABELS,
  type BorderSource,
  type Layer,
  type Span,
} from '../state/viewState';
import { element } from './dom';
import { uiIcon, type UiIcon } from './icons';

export interface LayersView {
  readonly layers: ReadonlySet<Layer>;
  readonly borders: BorderSource;
  /** Astronomical year shown. */
  readonly year: number;
  /** The present year, up to which Cliopatria's latest borders carry on. */
  readonly present: number;
  /** The span of time shown, which decides the layers that draw. */
  readonly span: Span;
  /** Whether the panel applies to the view: the globe. */
  readonly visible: boolean;
  /** What a layer says about what it draws now, where that depends on loaded data. */
  readonly said?: ReadonlyMap<Layer, string>;
  /** A step a layer offers from what it shows, such as going to the time a rock formed. */
  readonly actions?: ReadonlyMap<Layer, { readonly label: string; readonly run: () => void }>;
}

export interface LayersPanel {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
  render(view: LayersView): void;
}

/** Each layer's icon, beside its name. */
const LAYER_ICONS: Readonly<Record<Layer, UiIcon>> = {
  empires: 'empires',
  ways: 'ways',
  periods: 'periods',
  genomes: 'genomes',
  humans: 'humans',
  rocks: 'rocks',
  plates: 'plates',
  fossils: 'fossils',
  impacts: 'impacts',
  volcanoes: 'volcanoes',
  temperature: 'temperature',
  sealevel: 'seaLevel',
  air: 'air',
  radiocarbon: 'radiocarbon',
  solar: 'solar',
  lunar: 'lunar',
  orbits: 'orbits',
};

const SOURCE_LABELS: Readonly<Record<BorderSource, string>> = {
  cliopatria: 'Cliopatria',
  ohm: 'OpenHistoricalMap',
  both: 'Both: compare',
};

export function createLayersPanel(
  onLayer: (layer: Layer, on: boolean) => void,
  onSource: (source: BorderSource) => void,
  /** Go to a span a layer draws on, at a moment of the layer's own if it has one. */
  onSpan: (span: Span, ma?: number) => void,
  /** The book that says where a layer comes from, beside its name. */
  why?: (layer: Layer, label: string) => HTMLElement,
): LayersPanel {
  const button = element(
    'button',
    {
      type: 'button',
      class: 'layers-open',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      'aria-controls': 'layers-panel',
    },
    uiIcon('layers'),
    element('span', { class: 'icon-label' }, 'Layers'),
  );
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const source = element(
    'select',
    { class: 'borders-select', 'aria-label': 'Borders from' },
    ...BORDER_SOURCES.map((option) => element('option', { value: option }, SOURCE_LABELS[option])),
  );
  source.addEventListener('change', () => {
    const picked = BORDER_SOURCES.find((option) => option === source.value);
    if (picked !== undefined) onSource(picked);
  });

  const boxes = new Map<Layer, HTMLInputElement>();
  const notes = new Map<Layer, HTMLElement>();
  const actionButtons = new Map<Layer, HTMLButtonElement>();
  const runs = new Map<Layer, () => void>();
  const items = new Map<Layer, HTMLElement>();
  const wheres = new Map<Layer, HTMLElement>();
  const choices = new Map(
    LAYER_GROUPS.flatMap((group) => group.layers.map((layer) => [layer.id, layer] as const)),
  );
  const groups = LAYER_GROUPS.map((group) =>
    element(
      'fieldset',
      { class: 'layers-group' },
      element('legend', {}, group.name),
      ...group.layers.map((layer) => {
        const box = element('input', { type: 'checkbox', class: 'layer-box' });
        box.addEventListener('change', () => {
          onLayer(layer.id, box.checked);
        });
        boxes.set(layer.id, box);
        const note = element('p', {
          class: 'layer-note',
          'data-testid': `layer-note-${layer.id}`,
          hidden: '',
        });
        notes.set(layer.id, note);
        const action = element('button', { type: 'button', class: 'layer-action', hidden: '' });
        action.addEventListener('click', () => {
          runs.get(layer.id)?.();
        });
        actionButtons.set(layer.id, action);
        // Where a layer that draws elsewhere does draw, as on the switch: a tap turns it on there.
        const [first] = layer.spans;
        const where = element(
          'button',
          {
            type: 'button',
            class: 'layer-where',
            hidden: '',
            'aria-label': `Show ${layer.label} on ${layer.spans.map((span) => SPAN_LABELS[span]).join(' or ')}`,
            title:
              layer.arrive === undefined
                ? `Turn on and go to ${first === undefined ? '' : SPAN_LABELS[first]}`
                : `Turn on and go to ${layer.arrive.label}`,
          },
          layer.spans.map((span) => SPAN_LABELS[span]).join(' · '),
          ' ›',
        );
        where.addEventListener('click', () => {
          if (first === undefined) return;
          onLayer(layer.id, true);
          onSpan(first, layer.arrive?.ma);
        });
        wheres.set(layer.id, where);
        const item = element(
          'div',
          { class: 'layer-item' },
          element(
            'div',
            { class: 'layer-row' },
            element(
              'label',
              { class: 'layer-label' },
              box,
              uiIcon(LAYER_ICONS[layer.id], 16),
              element('span', { class: 'layer-name' }, layer.label),
            ),
            ...(why === undefined ? [] : [why(layer.id, layer.label)]),
            where,
          ),
          element('p', { class: 'layer-about' }, layer.about),
          ...(layer.id === 'empires' ? [source] : []),
          note,
          action,
        );
        items.set(layer.id, item);
        return item;
      }),
    ),
  );

  const dialog = element(
    'dialog',
    { id: 'layers-panel', class: 'famous-dialog layers-dialog', 'aria-labelledby': 'layers-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'layers-title' }, 'Layers'),
      close,
    ),
    ...groups,
  );

  function shut(): void {
    if (dialog.open) dialog.close();
  }
  button.addEventListener('click', () => {
    // Not modal: the globe and the date stay in reach while layers are chosen.
    if (dialog.open) shut();
    else dialog.show();
    button.setAttribute('aria-expanded', String(dialog.open));
  });
  close.addEventListener('click', shut);
  dialog.addEventListener('close', () => {
    button.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') shut();
  });

  return {
    button,
    dialog,
    render({ layers, borders, year, present, span, visible, said, actions }) {
      runs.clear();
      const here = (layer: Layer): boolean => choices.get(layer)?.spans.includes(span) ?? true;
      for (const [layer, action] of actionButtons) {
        const choice = choices.get(layer);
        const to = choice?.spans[0];
        // On a span the layer does not draw on, the way to one it does.
        const offered = !layers.has(layer)
          ? undefined
          : here(layer) || to === undefined
            ? actions?.get(layer)
            : {
                label: `Go to ${choice?.arrive?.label ?? SPAN_LABELS[to]}`,
                run: () => {
                  onSpan(to, choice?.arrive?.ma);
                },
              };
        action.hidden = offered === undefined;
        action.textContent = offered?.label ?? '';
        if (offered !== undefined) runs.set(layer, offered.run);
      }
      button.hidden = !visible;
      if (!visible) shut();
      for (const [layer, box] of boxes) {
        box.checked = layers.has(layer);
        const elsewhere = !here(layer);
        items.get(layer)?.classList.toggle('is-elsewhere', elsewhere);
        const where = wheres.get(layer);
        if (where !== undefined) where.hidden = !elsewhere;
        const note = notes.get(layer);
        const choice = choices.get(layer);
        if (note === undefined || choice === undefined) continue;
        const text = !layers.has(layer)
          ? null
          : elsewhere
            ? elsewhereNote(choice)
            : (said?.get(layer) ?? layerNote(layer, year, borders, present));
        note.hidden = text === null;
        note.textContent = text ?? '';
      }
      source.hidden = !layers.has('empires') || !here('empires');
      source.value = borders;
    },
  };
}
