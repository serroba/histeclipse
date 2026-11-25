/**
 * The hypotheses' rail (#1158): at the globe's left, mirroring the layers' rail at its right, a
 * round button for each question the sketch asks at the moment (how fast Earth grew (#1219), the
 * Moon-forming impact, where
 * the water came from, how much land, how far a snowball's ice reached), each tagged with the
 * answer chosen. A tap opens a small sheet beside it with every answer and its source; picking
 * one closes it, as Escape or a tap elsewhere do, the focus back on its button. The sketch's
 * note in the bar's details keeps the full wording.
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
} from '../../deepTime/sketch';
import { GROWTH_CHOICES, GROWTH_MODELS } from '../../deepTime/growth';
import { THEIA_CHOICES, THEIA_MODELS } from '../../deepTime/theia';
import { element } from '../../ui/dom';
import { layerIcon, spanIcon, uiIcon } from '../../ui/icons';
import './hypothesisRail.css';

/** An answer to a question, as the rail offers it: its words, a short tag and its source. */
interface HypothesisOption {
  readonly value: string;
  readonly label: string;
  readonly tag: string;
  readonly source: string;
}

interface Question {
  readonly title: string;
  readonly icon: () => SVGSVGElement;
  readonly options: readonly HypothesisOption[];
}

/** The words before a label's colon: "Hard snowball" of "Hard snowball: frozen over". */
const before = (label: string): string => label.replace(/:.*$/, '');
/** The first word after it: "Dhuime" of "Steady growth: Dhuime et al. 2012". */
const after = (label: string): string => label.replace(/^[^:]*:\s*/, '').replace(/ .*$/, '');

/** Each question's answers, in the sketch's order. */
export const QUESTIONS: Readonly<Record<SketchQuestion, Question>> = {
  growth: {
    title: 'How fast Earth grew',
    icon: () => layerIcon('rocks', 20),
    options: GROWTH_MODELS.map((model) => ({
      value: model,
      label: GROWTH_CHOICES[model].label,
      tag: before(GROWTH_CHOICES[model].label),
      source: GROWTH_CHOICES[model].source,
    })),
  },
  impact: {
    title: 'Moon-forming impact',
    icon: () => layerIcon('impacts', 20),
    options: IMPACT_MODELS.map((model) => ({
      value: model,
      label: IMPACTS[model].label,
      tag: IMPACTS[model].ma.toLocaleString('en'),
      source: IMPACTS[model].source,
    })),
  },
  theia: {
    title: 'How the impact went',
    icon: () => uiIcon('lunar', 20),
    options: THEIA_MODELS.map((model) => ({
      value: model,
      label: THEIA_CHOICES[model].label,
      tag: before(THEIA_CHOICES[model].label),
      source: THEIA_CHOICES[model].source,
    })),
  },
  water: {
    title: 'Where the water came from',
    icon: () => layerIcon('sealevel', 20),
    options: WATER_MODELS.map((model) => ({
      value: model,
      label: WATER_CHOICES[model].label,
      tag: model === 'delivered' ? 'Delivered' : 'Own rock',
      source: WATER_CHOICES[model].source,
    })),
  },
  land: {
    title: 'How much land',
    icon: () => layerIcon('plates', 20),
    options: LAND_MODELS.map((model) => ({
      value: model,
      label: LAND_CHOICES[model].label,
      tag: after(LAND_CHOICES[model].label),
      source: LAND_CHOICES[model].source,
    })),
  },
  snowball: {
    title: 'Snowball ice',
    icon: () => spanIcon('ice', 20),
    options: SNOWBALL_MODELS.map((model) => ({
      value: model,
      label: SNOWBALL_CHOICES[model].label,
      tag: before(SNOWBALL_CHOICES[model].label),
      source: SNOWBALL_CHOICES[model].source,
    })),
  },
};

const ORDER: readonly SketchQuestion[] = ['growth', 'impact', 'theia', 'water', 'land', 'snowball'];

export interface HypothesisRail {
  readonly root: HTMLElement;
  render(view: { readonly sketch: Sketch; readonly choices: SketchChoices } | null): void;
}

/** A question's button: its icon over the answer chosen, which `label` names in full. */
function questionButton(question: SketchQuestion): HTMLButtonElement {
  return element(
    'button',
    {
      type: 'button',
      class: 'hypo-button',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      'aria-controls': 'hypo-sheet',
      'data-question': question,
      hidden: '',
    },
    QUESTIONS[question].icon(),
    element('span', { class: 'hypo-tag' }),
  );
}

/** Tag `button` with the answer `value` chosen to `question`. */
function label(button: HTMLButtonElement, question: SketchQuestion, value: string): void {
  const option = QUESTIONS[question].options.find((each) => each.value === value);
  const tag = button.querySelector('.hypo-tag');
  if (tag !== null) tag.textContent = option?.tag ?? '';
  const words = `${QUESTIONS[question].title}: ${option?.label ?? ''}`;
  button.setAttribute('aria-label', words);
  button.title = words;
}

/** The answers to `question`, the one `chosen` pressed; `pick` is told the one picked. */
function answers(
  question: SketchQuestion,
  chosen: string,
  pick: (value: string) => void,
): HTMLElement[] {
  return QUESTIONS[question].options.map((option) => {
    const button = element(
      'button',
      { type: 'button', class: 'hypo-option', 'aria-pressed': String(option.value === chosen) },
      element('span', { class: 'hypo-option-label' }, option.label),
      element('span', { class: 'hypo-option-source' }, option.source),
    );
    button.addEventListener('click', () => {
      pick(option.value);
    });
    return button;
  });
}

export function createHypothesisRail(
  onSketch: (choice: Partial<SketchChoices>) => void,
): HypothesisRail {
  const sheetTitle = element('p', { class: 'hypo-title' });
  const sheetList = element('div', { class: 'hypo-options' });
  const sheet = element(
    'div',
    { class: 'hypo-sheet', role: 'dialog', hidden: '', id: 'hypo-sheet' },
    sheetTitle,
    sheetList,
  );
  let open: SketchQuestion | null = null;
  let choices: SketchChoices | null = null;
  const buttons = new Map(ORDER.map((question) => [question, questionButton(question)] as const));
  const root = element(
    'div',
    { class: 'hypothesis-rail', role: 'group', 'aria-label': 'Hypotheses', hidden: '' },
    ...buttons.values(),
    sheet,
  );

  function close(focus = false): void {
    const was = open === null ? undefined : buttons.get(open);
    open = null;
    sheet.hidden = true;
    for (const button of buttons.values()) button.setAttribute('aria-expanded', 'false');
    if (focus) was?.focus();
  }

  function show(question: SketchQuestion): void {
    const button = buttons.get(question);
    if (button === undefined || choices === null) return;
    open = question;
    const { title } = QUESTIONS[question];
    sheet.setAttribute('aria-label', title);
    sheetTitle.textContent = title;
    sheetList.replaceChildren(
      ...answers(question, choices[question], (value) => {
        onSketch({ [question]: value });
        close(true);
      }),
    );
    sheet.style.top = `${String(button.offsetTop)}px`;
    sheet.hidden = false;
    for (const [each, other] of buttons) {
      other.setAttribute('aria-expanded', String(each === question));
    }
    sheetList.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }

  for (const [question, button] of buttons) {
    button.addEventListener('click', () => {
      if (open === question) close();
      else show(question);
    });
  }
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open !== null) close(true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (open !== null && event.target instanceof Node && !root.contains(event.target)) close();
  });

  return {
    root,
    render(view) {
      choices = view?.choices ?? null;
      const asked = view?.sketch.questions ?? [];
      root.hidden = asked.length === 0;
      for (const [question, button] of buttons) {
        button.hidden = !asked.includes(question);
        if (view !== null) label(button, question, view.choices[question]);
      }
      if (open !== null && !asked.includes(open)) close();
    },
  };
}
