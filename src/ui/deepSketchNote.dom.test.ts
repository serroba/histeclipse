// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { sketchAt, type SketchChoices } from '../deepTime/sketch';
import { createDeepSketchNote } from './deepSketchNote';

const CHOICES: SketchChoices = {
  growth: 'slow',
  impact: 'early',
  land: 'dhuime',
  snowball: 'hard',
  water: 'inherited',
};

describe('deep time’s sketch note', () => {
  it('Given a moment before the maps, Then its headline, the pickers its questions ask, and the sources', () => {
    const onSketch = vi.fn();
    const note = createDeepSketchNote(onSketch);
    const sketch = sketchAt(4400, CHOICES, false);
    expect(sketch.questions.length).toBeGreaterThan(0);
    note.render(true, { sketch, choices: CHOICES }, 4400);
    expect(note.note.hidden).toBe(false);
    expect(note.sources.hidden).toBe(false);
    expect(note.note.querySelector('[data-testid="sketch-headline"]')?.textContent).not.toBe('');
    const shown = [...note.note.querySelectorAll('select')].filter(
      (select) => select.closest('p')?.hidden === false,
    );
    expect(shown.map((select) => select.getAttribute('aria-label'))).toEqual(
      sketch.questions.map(
        (question) =>
          ({
            growth: 'How fast Earth grew',
            impact: 'Moon-forming impact',
            water: 'Where the water came from',
            land: 'How much land',
            snowball: 'Snowball ice',
          })[question],
      ),
    );
  });

  it('Given each picker changed, Then the choice is reported; an unknown value is not', () => {
    const onSketch = vi.fn();
    const note = createDeepSketchNote(onSketch);
    const [growth, impact, water, land, snowball] = [...note.note.querySelectorAll('select')];
    for (const [select, value] of [
      [growth, 'fast'],
      [impact, 'late'],
      [water, 'comets'],
      [land, 'early'],
      [snowball, 'slushball'],
    ] as const) {
      if (select === undefined) throw new Error('missing picker');
      select.value = select.options[1]?.value ?? value;
      select.dispatchEvent(new Event('change'));
    }
    expect(onSketch).toHaveBeenCalledTimes(5);
    expect(onSketch).toHaveBeenCalledWith({ water: 'delivered' });
    expect(onSketch).toHaveBeenCalledWith({ growth: 'fast' });
    const lone = document.createElement('option');
    lone.value = 'nonsense';
    impact?.append(lone);
    if (impact !== undefined) impact.value = 'nonsense';
    impact?.dispatchEvent(new Event('change'));
    land?.append(lone.cloneNode());
    if (land !== undefined) land.value = 'nonsense';
    land?.dispatchEvent(new Event('change'));
    snowball?.append(lone.cloneNode());
    if (snowball !== undefined) snowball.value = 'nonsense';
    snowball?.dispatchEvent(new Event('change'));
    water?.append(lone.cloneNode());
    if (water !== undefined) water.value = 'nonsense';
    water?.dispatchEvent(new Event('change'));
    growth?.append(lone.cloneNode());
    if (growth !== undefined) growth.value = 'nonsense';
    growth?.dispatchEvent(new Event('change'));
    expect(onSketch).toHaveBeenCalledTimes(5);
  });

  it('Given no sketch, Then it is hidden', () => {
    const note = createDeepSketchNote(vi.fn());
    note.render(false, null, 100);
    expect(note.note.hidden).toBe(true);
    expect(note.sources.hidden).toBe(true);
  });
});
