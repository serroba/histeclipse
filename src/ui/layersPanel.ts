/**
 * Optional layers on the globe, switched on and off like Windy's, from one panel: grouped by
 * what they show, each saying when the moment shown lies outside its data. The panel does not
 * block the globe: the reader can change the date with it open and watch the layers change.
 */

import { HISTORY_LAYER_GROUPS, layerNote } from '../state/layerCatalog';
import { BORDER_SOURCES, type BorderSource, type Layer } from '../state/viewState';
import { element } from './dom';

export interface LayersView {
  readonly layers: ReadonlySet<Layer>;
  readonly borders: BorderSource;
  /** Astronomical year shown. */
  readonly year: number;
  /** The present year, up to which Cliopatria's latest borders carry on. */
  readonly present: number;
  /** Whether the panel applies to the view: historical time on the globe. */
  readonly visible: boolean;
  /** What a layer says about what it draws now, where that depends on loaded data. */
  readonly said?: ReadonlyMap<Layer, string>;
}

export interface LayersPanel {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
  render(view: LayersView): void;
}

const SOURCE_LABELS: Readonly<Record<BorderSource, string>> = {
  cliopatria: 'Cliopatria',
  ohm: 'OpenHistoricalMap',
  both: 'Both: compare',
};

export function createLayersPanel(
  onLayer: (layer: Layer, on: boolean) => void,
  onSource: (source: BorderSource) => void,
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
    'Layers',
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
  const groups = HISTORY_LAYER_GROUPS.map((group) =>
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
        return element(
          'div',
          { class: 'layer-item' },
          element(
            'label',
            { class: 'layer-label' },
            box,
            element('span', { class: 'layer-name' }, layer.label),
          ),
          element('p', { class: 'layer-about' }, layer.about),
          ...(layer.id === 'empires' ? [source] : []),
          note,
        );
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
    render({ layers, borders, year, present, visible, said }) {
      button.hidden = !visible;
      if (!visible) shut();
      for (const [layer, box] of boxes) {
        box.checked = layers.has(layer);
        const note = notes.get(layer);
        if (note === undefined) continue;
        const text = layers.has(layer)
          ? (said?.get(layer) ?? layerNote(layer, year, borders, present))
          : null;
        note.hidden = text === null;
        note.textContent = text ?? '';
      }
      source.hidden = !layers.has('empires');
      source.value = borders;
    },
  };
}
