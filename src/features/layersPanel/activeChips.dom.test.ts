// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { activeLayers } from '../../state/activeLayers';
import { createActiveChips } from './activeChips';

const view = { layers: new Set(['humans', 'plates'] as const), ma: 100, deepScale: 'all' as const };

describe('the chips of the layers on', () => {
  it('Given none, Then the row is hidden', () => {
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn() });
    chips.render([]);
    expect(chips.root.hidden).toBe(true);
  });

  it('Given layers on, one not drawing here, Then each can be turned off, and the other offers where it draws', () => {
    const onRemove = vi.fn();
    const onGoTo = vi.fn();
    const chips = createActiveChips({ onRemove, onGoTo });
    chips.render(activeLayers(view));
    expect(chips.root.hidden).toBe(false);
    const humans = chips.root.querySelector('[data-layer="humans"]');
    expect(humans?.getAttribute('data-draws')).toBe('false');
    expect(chips.root.querySelector('[data-layer="plates"] .active-go')).toBeNull();
    humans?.querySelector<HTMLButtonElement>('.active-go')?.click();
    expect(onGoTo).toHaveBeenCalledWith('ice', 0.315);
    chips.root.querySelector<HTMLButtonElement>('[aria-label="Turn off Plates"]')?.click();
    expect(onRemove).toHaveBeenCalledWith('plates');
  });

  it('Given the same layers again, Then the chips are kept, not rebuilt', () => {
    const chips = createActiveChips({ onRemove: vi.fn(), onGoTo: vi.fn() });
    chips.render(activeLayers(view));
    const first = chips.root.querySelector('li');
    chips.render(activeLayers(view));
    expect(chips.root.querySelector('li')).toBe(first);
  });
});
