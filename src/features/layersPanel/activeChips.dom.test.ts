// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { activeLayers } from '../../state/activeLayers';
import { parseViewState } from '../../state/url';
import { createActiveChips } from './activeChips';

const at = (query: string) => parseViewState(query, new Date('2026-11-15T00:00:00Z')).state;
const deep = at('ma=100&scale=all&layers=humans,plates');

describe('the chips of the layers on', () => {
  it('Given none, Then the row is hidden', () => {
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn() });
    chips.render([]);
    expect(chips.root.hidden).toBe(true);
  });

  it('Given layers on, one on another span, Then each can be turned off, and that one says why and offers where it draws', () => {
    const onRemove = vi.fn();
    const onGoTo = vi.fn();
    const chips = createActiveChips({ onRemove, onGoTo });
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

  it('Given the ozone hole in 1995, Then its chip says so in words, and goes to 1996', () => {
    const onGoTo = vi.fn();
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo });
    chips.render(activeLayers(at('t=1995-10-01T12:00Z&layers=ozone')));
    const ozone = chips.root.querySelector('[data-layer="ozone"]');
    expect(ozone?.getAttribute('data-coverage')).toBe('gap');
    expect(ozone?.textContent).toContain('none in 1995 CE');
    ozone?.querySelector<HTMLButtonElement>('.active-go')?.click();
    expect(onGoTo).toHaveBeenCalledWith({ span: 'years', year: 1996, label: '1996 CE' });
  });

  it('Given the same layers again, Then the chips are kept, not rebuilt', () => {
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn() });
    chips.render(activeLayers(deep));
    const first = chips.root.querySelector('li');
    chips.render(activeLayers(deep));
    expect(chips.root.querySelector('li')).toBe(first);
  });
});
