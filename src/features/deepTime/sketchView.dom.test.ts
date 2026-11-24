// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_WATER_MODEL, WATER_STRIKE_LIST } from '../../deepTime/sketch';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { QUESTIONS, createHypothesisRail } from './hypothesisRail';
import { createSketchView } from './sketchView';

const BASE: ViewState = defaultViewState(new Date('2026-06-15T12:00:00Z'));

describe('the hypotheses’ rail (#1158)', () => {
  it('offers each question’s answers with a short tag and a source', () => {
    expect(QUESTIONS.impact.options.map((option) => option.tag)).toEqual([
      '4,510',
      '4,425',
      '4,350',
    ]);
    expect(QUESTIONS.water.options.map((option) => option.tag)).toEqual(['Own rock', 'Delivered']);
    expect(QUESTIONS.land.options[0]?.tag).toBe('Dhuime');
    expect(QUESTIONS.snowball.options[0]?.tag).toBe('Hard snowball');
    for (const question of Object.values(QUESTIONS)) {
      for (const option of question.options) expect(option.source).not.toBe('');
    }
  });

  it('Given the questions a moment asks, Then a button each, tagged; a pick reports and closes', () => {
    const onSketch = vi.fn();
    const rail = createHypothesisRail(onSketch);
    document.body.append(rail.root);
    const choices = {
      impact: 'early',
      land: 'dhuime',
      snowball: 'hard',
      water: 'delivered',
    } as const;
    rail.render({
      sketch: {
        kind: 'magma',
        land: 0,
        iceEdge: 90,
        reconstructed: false,
        questions: ['impact', 'water'],
        episode: null,
      },
      choices,
    });
    expect(rail.root.hidden).toBe(false);
    const shown = [...rail.root.querySelectorAll<HTMLButtonElement>('.hypo-button')].filter(
      (button) => button.hidden !== true,
    );
    expect(shown.map((button) => button.dataset['question'])).toEqual(['impact', 'water']);
    const [impact] = shown;
    expect(impact?.textContent).toBe('4,510');
    expect(impact?.getAttribute('aria-label')).toBe(
      'Moon-forming impact: Early: 4,510 million years ago',
    );
    impact?.click();
    const sheet = rail.root.querySelector<HTMLElement>('.hypo-sheet');
    expect(sheet?.hidden).toBe(false);
    expect(impact?.getAttribute('aria-expanded')).toBe('true');
    const options = [...(sheet?.querySelectorAll<HTMLButtonElement>('.hypo-option') ?? [])];
    expect(options.map((option) => option.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    options[2]?.click();
    expect(onSketch).toHaveBeenCalledWith({ impact: 'young' });
    expect(sheet?.hidden).toBe(true);
    expect(document.activeElement).toBe(impact);
  });

  it('Given an open sheet, Then Escape or a tap elsewhere closes it; no questions hides the rail', () => {
    const rail = createHypothesisRail(vi.fn());
    document.body.append(rail.root);
    const choices = {
      impact: 'early',
      land: 'dhuime',
      snowball: 'hard',
      water: 'delivered',
    } as const;
    const sketch = {
      kind: 'ocean',
      land: 0.1,
      iceEdge: 90,
      reconstructed: false,
      questions: ['land'],
      episode: null,
    } as const;
    rail.render({ sketch, choices });
    const land = rail.root.querySelector<HTMLButtonElement>('[data-question="land"]');
    const sheet = rail.root.querySelector<HTMLElement>('.hypo-sheet');
    land?.click();
    rail.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(sheet?.hidden).toBe(true);
    land?.click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(sheet?.hidden).toBe(true);
    rail.render(null);
    expect(rail.root.hidden).toBe(true);
  });
});

describe('the hypotheses’ rail, its edges', () => {
  const choices = {
    impact: 'early',
    land: 'dhuime',
    snowball: 'hard',
    water: 'delivered',
  } as const;
  const asking = (questions: readonly ('impact' | 'land' | 'water' | 'snowball')[]) => ({
    sketch: {
      kind: 'ocean' as const,
      land: 0.1,
      iceEdge: 90,
      reconstructed: false,
      questions,
      episode: null,
    },
    choices,
  });

  it('Given no moment yet, Then a tap opens nothing; tapping the open question again closes it', () => {
    const rail = createHypothesisRail(vi.fn());
    document.body.append(rail.root);
    const sheet = rail.root.querySelector<HTMLElement>('.hypo-sheet');
    const land = rail.root.querySelector<HTMLButtonElement>('[data-question="land"]');
    land?.click();
    expect(sheet?.hidden).toBe(true);
    rail.render(asking(['land']));
    land?.click();
    expect(sheet?.hidden).toBe(false);
    land?.click();
    expect(sheet?.hidden).toBe(true);
  });

  it('Given its question no longer asked, Then the open sheet closes; a tap inside keeps it', () => {
    const rail = createHypothesisRail(vi.fn());
    document.body.append(rail.root);
    const sheet = rail.root.querySelector<HTMLElement>('.hypo-sheet');
    rail.render(asking(['land', 'snowball']));
    rail.root.querySelector<HTMLButtonElement>('[data-question="land"]')?.click();
    sheet?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(sheet?.hidden).toBe(false);
    rail.render(asking(['snowball']));
    expect(sheet?.hidden).toBe(true);
    rail.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(sheet?.hidden).toBe(true);
  });

  it('Given an answer it does not know, Then its tag is empty rather than wrong', () => {
    const rail = createHypothesisRail(vi.fn());
    rail.render({ ...asking(['land']), choices: { ...choices, land: 'unknown' as never } });
    const land = rail.root.querySelector<HTMLButtonElement>('[data-question="land"]');
    expect(land?.textContent).toBe('');
    expect(land?.getAttribute('aria-label')).toBe('How much land: ');
  });
});

describe('deep time’s sketch', () => {
  it('draws the sketch before the maps, with its questions, and none after or outside deep time', () => {
    const globe = { setSketch: vi.fn(), playImpact: vi.fn() };
    const view = createSketchView(globe, vi.fn(), false);
    const before = view.show(BASE, { ma: 4550, uncharted: true, reconstructed: false }, false);
    expect(before?.sketch.kind).toBe('magma');
    expect(before?.choices.water).toBe(DEFAULT_WATER_MODEL);
    expect(globe.setSketch).toHaveBeenLastCalledWith(before?.sketch);
    expect(view.root.hidden).toBe(false);
    expect(view.show(BASE, { ma: 300, uncharted: false, reconstructed: true }, false)).toBeNull();
    expect(globe.setSketch).toHaveBeenLastCalledWith(null);
    expect(view.show(BASE, null, false)).toBeNull();
    expect(view.root.hidden).toBe(true);
  });

  it('plays the delivered water’s impactors as play passes them, delivered being the default', () => {
    const [strike] = WATER_STRIKE_LIST;
    if (strike === undefined) throw new Error('no strikes');
    const falling = {
      moveTo: vi.fn(),
      held: () => false,
      hold: vi.fn(),
      step: vi.fn(),
      at: vi.fn(),
      end: vi.fn(),
      playing: () => true,
    };
    const globe = { setSketch: vi.fn(), playImpact: vi.fn(() => falling) };
    let paused = false;
    const view = createSketchView(globe, vi.fn(), false, () => paused);
    const looking: ViewState = {
      ...BASE,
      camera: { ...BASE.camera, target: { latitude: strike.lat, longitude: strike.lon } },
    };
    view.show(looking, { ma: strike.ma + 0.01, uncharted: true, reconstructed: false }, true);
    view.show(looking, { ma: strike.ma - 0.01, uncharted: true, reconstructed: false }, true);
    expect(globe.playImpact).toHaveBeenCalledTimes(1);
    // The reader pauses: the one falling holds still (#807).
    paused = true;
    view.show(looking, { ma: strike.ma - 0.01, uncharted: true, reconstructed: false }, false);
    expect(falling.hold).toHaveBeenCalledWith(true);
  });
});
