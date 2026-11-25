/**
 * Deep time's sketch note (#605): before the reconstructions reach, the globe sketches what
 * competing hypotheses say, and the reader picks whose: one line in view with a picker for each
 * question the moment asks, and what the sketch rests on folded away. Taken out of the bar
 * (`deepTimeBar.ts`) unchanged, so the bar is the slider, the track and its notes' places.
 */

import {
  IMPACT_MODELS,
  IMPACTS,
  LAND_CHOICES,
  LAND_MODELS,
  type Sketch,
  type SketchChoices,
  type SketchQuestion,
  SNOWBALL_CHOICES,
  SNOWBALL_MODELS,
  WATER_CHOICES,
  WATER_MODELS,
} from '../deepTime/sketch';
import { GROWTH_CHOICES, GROWTH_MODELS } from '../deepTime/growth';
import { sketchHeadline, sketchLines } from '../deepTime/sketchText';
import { element } from './dom';

const SKETCH_QUESTIONS: readonly SketchQuestion[] = [
  'growth',
  'impact',
  'water',
  'land',
  'snowball',
];

export interface DeepSketchNote {
  /** The note in view: the headline and the pickers. */
  readonly note: HTMLElement;
  /** What the sketch rests on, among the bar's folds. */
  readonly sources: HTMLElement;
  render(
    shown: boolean,
    sketch: { readonly sketch: Sketch; readonly choices: SketchChoices } | null,
    ma: number,
  ): void;
}

/** One picker per question a sketch can answer; only those the moment asks are shown. */
function sketchPickers(): Readonly<Record<SketchQuestion, HTMLSelectElement>> {
  return {
    growth: element(
      'select',
      { class: 'deep-coast', 'aria-label': 'How fast Earth grew' },
      ...GROWTH_MODELS.map((model) =>
        element('option', { value: model }, GROWTH_CHOICES[model].label),
      ),
    ),
    impact: element(
      'select',
      { class: 'deep-coast', 'aria-label': 'Moon-forming impact' },
      ...IMPACT_MODELS.map((model) => element('option', { value: model }, IMPACTS[model].label)),
    ),
    land: element(
      'select',
      { class: 'deep-coast', 'aria-label': 'How much land' },
      ...LAND_MODELS.map((model) => element('option', { value: model }, LAND_CHOICES[model].label)),
    ),
    water: element(
      'select',
      { class: 'deep-coast', 'aria-label': 'Where the water came from' },
      ...WATER_MODELS.map((model) =>
        element('option', { value: model }, WATER_CHOICES[model].label),
      ),
    ),
    snowball: element(
      'select',
      { class: 'deep-coast', 'aria-label': 'Snowball ice' },
      ...SNOWBALL_MODELS.map((model) =>
        element('option', { value: model }, SNOWBALL_CHOICES[model].label),
      ),
    ),
  };
}

export function createDeepSketchNote(
  onSketch: (choice: Partial<SketchChoices>) => void,
): DeepSketchNote {
  const pickers = sketchPickers();
  const row = (question: SketchQuestion, label: string): HTMLElement =>
    element('p', { hidden: '' }, element('label', {}, label, pickers[question]));
  const rows: Readonly<Record<SketchQuestion, HTMLElement>> = {
    growth: row('growth', 'How fast Earth grew '),
    impact: row('impact', 'Moon-forming impact '),
    water: row('water', 'Where the water came from '),
    land: row('land', 'How much land '),
    snowball: row('snowball', 'Snowball ice '),
  };
  // In view: one line and the pickers. What it rests on is folded, so a phone still sees the globe.
  const head = element('p', { 'data-testid': 'sketch-headline' });
  const note = element(
    'div',
    { class: 'deep-note', hidden: '', 'data-testid': 'sketch-note' },
    head,
    ...SKETCH_QUESTIONS.map((question) => rows[question]),
  );
  const words = element('div', {});
  const sources = element(
    'details',
    { class: 'deep-facts', hidden: '', 'data-testid': 'sketch-sources', name: 'deep-fold' },
    element('summary', {}, 'What the sketch rests on'),
    element(
      'div',
      { class: 'colour-key-body' },
      element(
        'p',
        {},
        'No surface map reaches before 540 million years ago, and the continent reconstruction stops at 1,800 million. Before that, and for snowball ice, the globe sketches what competing hypotheses say.',
      ),
      words,
    ),
  );
  pickers.growth.addEventListener('change', () => {
    const growth = GROWTH_MODELS.find((option) => option === pickers.growth.value);
    if (growth !== undefined) onSketch({ growth });
  });
  pickers.impact.addEventListener('change', () => {
    const impact = IMPACT_MODELS.find((option) => option === pickers.impact.value);
    if (impact !== undefined) onSketch({ impact });
  });
  pickers.land.addEventListener('change', () => {
    const land = LAND_MODELS.find((option) => option === pickers.land.value);
    if (land !== undefined) onSketch({ land });
  });
  pickers.water.addEventListener('change', () => {
    const water = WATER_MODELS.find((option) => option === pickers.water.value);
    if (water !== undefined) onSketch({ water });
  });
  pickers.snowball.addEventListener('change', () => {
    const snowball = SNOWBALL_MODELS.find((option) => option === pickers.snowball.value);
    if (snowball !== undefined) onSketch({ snowball });
  });
  return {
    note,
    sources,
    render(shown, view, ma) {
      note.hidden = !shown;
      sources.hidden = !shown;
      if (view === null) return;
      const { sketch, choices } = view;
      head.textContent = sketchHeadline(sketch);
      words.replaceChildren(
        ...sketchLines(sketch, choices, ma).map((line) => element('p', {}, line)),
      );
      for (const question of SKETCH_QUESTIONS) {
        rows[question].hidden = !sketch.questions.includes(question);
        pickers[question].value = choices[question];
      }
    },
  };
}
