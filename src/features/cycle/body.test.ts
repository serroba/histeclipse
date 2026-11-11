import { describe, expect, it } from 'vitest';

import { defaultViewState, type ViewState } from '../../state/viewState';
import { cycleBody } from './body';

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const at = (focus: ViewState['focus'], more: Partial<ViewState> = {}): ViewState => ({
  ...base,
  focus,
  ...more,
});

describe('cycleBody', () => {
  it("follows a planet's cycle, or the Sun's year, away from Earth in the years", () => {
    expect(cycleBody(at('mars'))).toBe('mars');
    expect(cycleBody(at('sun'))).toBe('sun');
  });

  it("follows a moon's planet", () => {
    expect(cycleBody(at('phobos'))).toBe('mars');
    expect(cycleBody(at('titan'))).toBe('saturn');
  });

  it('follows none on Earth or the Moon, in deep time, in the sky, or with an eclipse open', () => {
    expect(cycleBody(at('earth'))).toBeNull();
    expect(cycleBody(at('moon'))).toBeNull();
    expect(cycleBody(at('mars', { ma: 100 }))).toBeNull();
    expect(cycleBody(at('mars', { mode: 'sky' }))).toBeNull();
    expect(
      cycleBody(
        at('mars', { selection: { kind: 'solar', id: 1 } as unknown as ViewState['selection'] }),
      ),
    ).toBeNull();
  });
});
