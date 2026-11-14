/**
 * Deep time's ice-age notes (#605): the ice ages' Earth (its ice sheets, their outlines, how far
 * the plates have moved, and the sea ice with its model to pick) and the coast (the sea level it
 * follows, and whose). Taken out of the bar (`deepTimeBar.ts`) unchanged.
 */

import { SEA_ICE_MODELS, type SeaIceModel } from '../data/seaIce';
import type { IceOutlines } from '../data/iceOutlines';
import { COAST_SOURCES, type CoastSource } from '../deepTime/coastline';
import {
  COAST_LABELS,
  coastlineText,
  type CoastlineView,
  iceText,
  type IceView,
  SEA_ICE_LABELS,
  seaIceText,
  type SeaIceView,
} from './deepBarModel';
import { element } from './dom';
import { iceOutlineText } from './iceOutlineText';

/** What the notes show at the moment. */
export interface DeepIceView {
  readonly ice: IceView;
  readonly iceOutlines: IceOutlines | null;
  readonly plateMotion: string | null;
  readonly seaIce: SeaIceView | null;
  readonly coastline: CoastlineView | null;
}

export interface DeepIceNotes {
  readonly ice: HTMLElement;
  readonly coast: HTMLElement;
  render(iceShown: boolean, view: DeepIceView): void;
}

/** The notes' pickers: whose sea ice, and whose sea level the coast follows. */
function pickers(): { seaIcePicker: HTMLSelectElement; coastPicker: HTMLSelectElement } {
  const seaIcePicker = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Ice-age sea ice from' },
    ...SEA_ICE_MODELS.map((model) => element('option', { value: model }, SEA_ICE_LABELS[model])),
  );
  const coastPicker = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Coastline follows' },
    ...COAST_SOURCES.map((source) => element('option', { value: source }, COAST_LABELS[source])),
  );
  return { seaIcePicker, coastPicker };
}

export function createDeepIceNotes(options: {
  /** The books beside the notes. */
  readonly iceWhy: HTMLElement;
  readonly coastWhy: HTMLElement;
  onSeaIce(model: SeaIceModel): void;
  onCoast(coast: CoastSource): void;
}): DeepIceNotes {
  const coastText = element('span', { 'data-testid': 'coastline' });
  const iceLine = element('p', { 'data-testid': 'ice-sheets' });
  const outlineLine = element('p', { 'data-testid': 'ice-outlines', hidden: '' });
  const motionLine = element('p', { 'data-testid': 'plate-motion', hidden: '' });
  const seaIceWords = element('span', { 'data-testid': 'sea-ice' });
  const { seaIcePicker, coastPicker } = pickers();
  const ice = element(
    'div',
    { class: 'deep-note', hidden: '', 'data-testid': 'ice-note' },
    element(
      'p',
      {},
      options.iceWhy,
      ' ',
      'The last 2.6 million years: today’s land and sea floor, with the coast drawn at the sea level of the time. Sea floor laid dry is sandy; ice sheets are white. The continents are drawn where they are today (how far they have moved is below), and the temperature maps, of land only, are 2,000 years apart.',
    ),
    iceLine,
    outlineLine,
    motionLine,
    element(
      'p',
      {},
      seaIceWords,
      ' ',
      element('label', {}, 'Ice-age model ', seaIcePicker),
      ' Three climate models (PMIP4) differ; pick one.',
    ),
  );
  const coast = element(
    'p',
    { class: 'deep-note', hidden: '', 'data-testid': 'coast-note' },
    options.coastWhy,
    ' ',
    coastText,
    ' ',
    element('label', {}, 'Follow ', coastPicker),
    ' Drawn on NOAA’s present-day depths (ETOPO1); each source is measured from its own present day.',
  );
  seaIcePicker.addEventListener('change', () => {
    const model = SEA_ICE_MODELS.find((option) => option === seaIcePicker.value);
    if (model !== undefined) options.onSeaIce(model);
  });
  coastPicker.addEventListener('change', () => {
    const source = COAST_SOURCES.find((option) => option === coastPicker.value);
    if (source !== undefined) options.onCoast(source);
  });
  return {
    ice,
    coast,
    render(iceShown, view) {
      ice.hidden = !iceShown;
      iceLine.textContent = iceText(view.ice);
      motionLine.hidden = view.plateMotion === null;
      motionLine.textContent = view.plateMotion ?? '';
      const outlines = iceOutlineText(view.iceOutlines);
      outlineLine.hidden = outlines === null;
      outlineLine.textContent = outlines ?? '';
      if (view.seaIce !== null) {
        seaIceWords.textContent = seaIceText(view.seaIce);
        seaIcePicker.value = view.seaIce.model;
      }
      coast.hidden = view.coastline === null;
      if (view.coastline !== null) {
        coastText.textContent = coastlineText(view.coastline);
        coastPicker.value = view.coastline.coast;
      }
    },
  };
}
