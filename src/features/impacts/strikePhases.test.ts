import { describe, expect, it } from 'vitest';

import { CLOCK_END, secondsAt } from '../../deepTime/strikeClock';
import { phaseAt } from '../ownTime';
import { strikePhasesOf } from './strikePhases';

describe('what the strike clock says happened (#1173)', () => {
  const chicxulub = strikePhasesOf('Chicxulub') ?? [];

  it('has Chicxulub’s phases, in time order, from the approach to a million years on', () => {
    expect(chicxulub.length).toBeGreaterThan(10);
    const times = chicxulub.map((phase) => phase.from);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBeLessThan(0);
    expect(times.at(-1)).toBeLessThan(secondsAt(CLOCK_END));
    expect(new Set(chicxulub.map((phase) => phase.id)).size).toBe(chicxulub.length);
  });

  it('cites a study for each, with a link to it', () => {
    for (const phase of chicxulub) {
      expect(phase.sources.length, phase.id).toBeGreaterThan(0);
      for (const source of phase.sources) expect(source.url).toMatch(/^https:\/\/doi\.org\/10\./);
    }
  });

  it('says what was happening at a moment: the last phase begun by then', () => {
    expect(phaseAt(chicxulub, -5)?.id).toBe('approach');
    expect(phaseAt(chicxulub, 10)?.id).toBe('fireball');
    expect(phaseAt(chicxulub, 3 * 3600)?.id).toBe('ejecta');
    expect(phaseAt(chicxulub, 2 * 365.25 * 86_400)?.id).toBe('winter');
    expect(phaseAt(chicxulub, -60)).toBeUndefined();
  });

  it('has none for a crater not watched in its own time', () => {
    expect(strikePhasesOf('Ries')).toBeNull();
  });
});
