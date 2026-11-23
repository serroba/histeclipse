// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { activeLayers } from '../../state/activeLayers';
import { parseViewState } from '../../state/url';
import { createActiveChips } from './activeChips';

const at = (query: string) => parseViewState(query, new Date('2026-11-15T00:00:00Z')).state;
const deep = at('ma=100&scale=all&layers=humans,plates');

describe('the chips of the layers on', () => {
  it('Given none, Then the row is hidden', () => {
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn(), onList: vi.fn() });
    chips.render([]);
    expect(chips.root.hidden).toBe(true);
  });

  it('Given layers on, one on another span, Then each can be turned off, and that one says why and offers where it draws', () => {
    const onRemove = vi.fn();
    const onGoTo = vi.fn();
    const chips = createActiveChips({ onRemove, onGoTo, onList: vi.fn() });
    chips.render(activeLayers(deep));
    expect(chips.root.hidden).toBe(false);
    const humans = chips.root.querySelector('[data-layer="humans"]');
    expect(humans?.getAttribute('data-draws')).toBe('false');
    expect(humans?.getAttribute('data-coverage')).toBe('other-span');
    expect(humans?.querySelector('.active-why')?.textContent).toBe('on Ice ages');
    expect(chips.root.querySelector('[data-layer="plates"] .active-go')).toBeNull();
    expect(chips.root.querySelector('[data-layer="plates"] .active-why')).toBeNull();
    humans?.querySelector<HTMLButtonElement>('.active-go')?.click();
    expect(onGoTo).toHaveBeenCalledWith({
      span: 'ice',
      ma: 0.315,
      label: 'the earliest Homo sapiens',
    });
    chips.root.querySelector<HTMLButtonElement>('[aria-label="Turn off Plates"]')?.click();
    expect(onRemove).toHaveBeenCalledWith('plates');
  });

  it('Given Plates saying how well the two maps agree, Then its chip says it in a few words, and in full on hover (#1159)', () => {
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn(), onList: vi.fn() });
    const brief = { short: '82% agree', full: 'Turned 59° east; 82% of the land lies inside.' };
    chips.render(activeLayers(deep, [], [['plates', brief]]));
    const plates = chips.root.querySelector('[data-layer="plates"]');
    expect(plates?.querySelector('.active-brief')?.textContent).toBe('82% agree');
    expect(plates?.getAttribute('title')).toBe(`Plates: ${brief.full}`);
  });

  it('Given the ozone hole in 1977, Then its chip says so in words, and goes to 1979, past the next year without', () => {
    const onGoTo = vi.fn();
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo, onList: vi.fn() });
    chips.render(activeLayers(at('t=1977-10-01T12:00Z&layers=ozone')));
    const ozone = chips.root.querySelector('[data-layer="ozone"]');
    expect(ozone?.getAttribute('data-coverage')).toBe('gap');
    expect(ozone?.textContent).toContain('none in 1977 CE');
    ozone?.querySelector<HTMLButtonElement>('.active-go')?.click();
    expect(onGoTo).toHaveBeenCalledWith({ span: 'years', year: 1979, label: '1979 CE' });
  });

  it('Given a layer that could not load, Then its chip says so and tries again; one loading is busy', () => {
    const retry = vi.fn();
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn(), onList: vi.fn() });
    const now = at('t=2006-10-01T12:00Z&layers=ozone');
    chips.render(activeLayers(now, new Map([['ozone', { state: 'failed', retry }]])));
    const failed = chips.root.querySelector('[data-layer="ozone"]');
    expect(failed?.getAttribute('data-coverage')).toBe('failed');
    expect(failed?.querySelector('.active-why')?.textContent).toBe('could not load');
    failed?.querySelector<HTMLButtonElement>('[aria-label="The ozone hole: try again"]')?.click();
    expect(retry).toHaveBeenCalledOnce();
    chips.render(activeLayers(now, new Map([['ozone', { state: 'loading' }]])));
    const loading = chips.root.querySelector('[data-layer="ozone"]');
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(loading?.textContent).toContain('loading…');
    chips.render(activeLayers(now));
    expect(chips.root.querySelector('[data-layer="ozone"]')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('Given the same layers again, Then the chips are kept, not rebuilt', () => {
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn(), onList: vi.fn() });
    chips.render(activeLayers(deep));
    const first = chips.root.querySelector('li');
    chips.render(activeLayers(deep));
    expect(chips.root.querySelector('li')).toBe(first);
  });

  it('Given a layer with a list, Then its chip opens the list (#850)', () => {
    const onList = vi.fn();
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn(), onList });
    chips.render(activeLayers(at('t=2026-01-01T00:00Z&layers=telescopes,volcanoes')));
    const list = chips.root.querySelector<HTMLButtonElement>(
      '[data-layer="telescopes"] [aria-label="Telescopes: the list"]',
    );
    expect(list?.textContent).toBe('List');
    list?.click();
    expect(onList).toHaveBeenCalledWith('telescopes');
    expect(
      chips.root.querySelector('[data-layer="volcanoes"] [aria-label$="the list"]'),
    ).toBeNull();
  });
});
