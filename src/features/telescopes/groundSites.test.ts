import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { loadTelescopes, type Telescope, type Telescopes } from '../../data/telescopes';
import { defaultViewState } from '../../state/viewState';
import { goToSite, heldSite } from './groundSites';

const raw = readFileSync('public/data/telescopes.json', 'utf8');
const record: Telescopes = await loadTelescopes('t.json', () => Promise.resolve(new Response(raw)));
const named = (id: string): Telescope => {
  const found = record.telescopes.find((telescope) => telescope.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
};

describe('going to a telescope on the ground (#864)', () => {
  it('Given the view naming one, Then it and those beside it; naming a craft or nothing, none', () => {
    expect(
      heldSite(record, 'subaru')
        ?.near.map(({ id }) => id)
        .sort(),
    ).toEqual(['keck', 'subaru']);
    expect(heldSite(record, 'd01093')).toBeNull();
    expect(heldSite(record, null)).toBeNull();
    expect(heldSite(record, 'webb')).toBeNull();
  });

  it('Given its card, Then a step there for one on the ground with a model; none for one in space or unmodelled', () => {
    const change = vi.fn();
    const step = goToSite(named('fast'), { change });
    step.action?.run();
    const update = change.mock.calls[0]?.[0] as (state: ReturnType<typeof defaultViewState>) => {
      craft: string | null;
      focus: string;
    };
    const at = update(defaultViewState(new Date('2026-01-01T00:00:00Z')));
    expect(at.craft).toBe('fast');
    expect(at.focus).toBe('earth');
    expect(goToSite(named('hubble'), { change })).toEqual({});
    expect(goToSite({ ...named('fast'), id: 'not-modelled' }, { change })).toEqual({});
  });
});
