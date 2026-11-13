import { describe, expect, it, vi } from 'vitest';

import type { DeepChoice, DeepNoteBlock } from '../../ui/deepChips';
import { IMPACTS_CHIP, impactsChip } from './chip';

/** The choice in a note, if it has one. */
function choiceIn(note: readonly DeepNoteBlock[] | null): DeepChoice | undefined {
  for (const block of note ?? []) {
    if (typeof block === 'object' && 'choose' in block) return block.choose;
  }
  return undefined;
}

describe('the impacts’ chip', () => {
  it('turns the impacts layer on, its book labelled as before', () => {
    expect(IMPACTS_CHIP).toMatchObject({ layer: 'impacts', label: 'Impacts', why: 'impacts' });
    expect(IMPACTS_CHIP.whyLabel).toBe('Impact craters');
  });

  it('is offered on the 540 Myr and ice-age spans, not before the elevation maps', () => {
    const off = { on: false } as const;
    expect(impactsChip(off, 'all', vi.fn()).offered).toBe(true);
    expect(impactsChip(off, 'ice', vi.fn()).offered).toBe(true);
    expect(impactsChip(off, 'eons', vi.fn()).offered).toBe(false);
  });

  it('has no note while off', () => {
    expect(impactsChip({ on: false }, 'all', vi.fn())).toEqual({
      offered: true,
      on: false,
      note: null,
    });
  });

  it('says what is drawn, its sources, and that the craters are loading', () => {
    const loading = impactsChip({ on: true, text: null, mode: 'around' }, 'all', vi.fn());
    expect(loading.on).toBe(true);
    expect(loading.note).toContain('Impacts: loading…');
    const drawn = impactsChip({ on: true, text: '3 impacts', mode: 'around' }, 'all', vi.fn());
    expect(drawn.note).toContain('3 impacts');
    expect(drawn.note).toContainEqual({
      text: 'the Impact Earth Database',
      href: 'https://impact.uwo.ca',
    });
    expect(drawn.note).toContainEqual({
      text: 'GPlates Web Service',
      href: 'https://gws.gplates.org',
    });
  });

  it('offers each impact around its time or all that had struck, and passes a pick on', () => {
    const pick = vi.fn();
    const choice = choiceIn(
      impactsChip({ on: true, text: null, mode: 'struck' }, 'all', pick).note,
    );
    expect(choice?.value).toBe('struck');
    expect(choice?.name).toBe('Show impacts');
    expect(choice?.options).toEqual([
      { value: 'around', label: 'each around its time' },
      { value: 'struck', label: 'all that had struck by then' },
    ]);
    choice?.pick('around');
    expect(pick).toHaveBeenCalledWith('around');
    choice?.pick('sideways');
    expect(pick).toHaveBeenCalledTimes(1);
  });
});
