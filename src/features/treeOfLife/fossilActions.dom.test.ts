// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { fossilActions } from './fossilActions';

describe('the tree of life’s ways from a fossil genus (#309)', () => {
  it('offers where it was found and its line through time, each asking for its genus', () => {
    const onFossil = vi.fn();
    const [actions] = fossilActions({ genus: 'Tyrannosaurus', group: 'dinosaurs' }, onFossil);
    const buttons = [...(actions?.querySelectorAll('button') ?? [])];
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Where Tyrannosaurus was found',
      'Tyrannosaurus through time',
    ]);
    buttons.forEach((button) => {
      button.click();
    });
    expect(onFossil.mock.calls).toEqual([
      ['globe', 'dinosaurs', 'Tyrannosaurus'],
      ['time', 'dinosaurs', 'Tyrannosaurus'],
    ]);
  });

  it('offers nothing for a taxon that is not a fossil genus', () => {
    expect(fossilActions(null, vi.fn())).toEqual([]);
  });
});
