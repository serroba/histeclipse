import { describe, expect, it } from 'vitest';

import { formationScale } from '../../deepTime/formationClock';
import { SOURCES } from '../../sources/registry';
import { phaseAt } from '../ownTime';
import { formationPhases } from './phases';

const YEAR = 365.25 * 86_400;
const MYR = 1e6 * YEAR;

describe('the formation clock’s phases (#1218)', () => {
  const early = formationPhases(4510);

  it('runs in order, from the first solids to the Moon’s crust', () => {
    const froms = early.map((each) => each.from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));
    expect(early[0]?.id).toBe('first-solids');
    expect(early.at(-1)?.id).toBe('moon-crust');
  });

  it('starts within the clock, whichever date the impact is given', () => {
    for (const impactMa of [4510, 4425, 4350]) {
      const scale = formationScale(impactMa);
      const phases = formationPhases(impactMa);
      expect(phaseAt(phases, scale.secondsAt(0))?.id).toBe('first-solids');
      expect(phaseAt(phases, scale.secondsAt(scale.end))?.id).toBe('moon-crust');
    }
  });

  it('times the phases before the impact from the first solids', () => {
    const young = formationPhases(4350);
    const embryos = (phases: typeof early): number =>
      phases.find((each) => each.id === 'embryos')?.from ?? NaN;
    expect(embryos(early)).toBeCloseTo((1 - 57.3) * MYR, -6);
    expect(embryos(young)).toBeCloseTo((1 - 217.3) * MYR, -6);
    expect(phaseAt(early, -3600)?.id).toBe('theia');
    expect(phaseAt(early, 0)?.id).toBe('impact');
    expect(phaseAt(early, 1.5 * MYR)?.id).toBe('first-ocean');
  });

  it('cites registered sources, each side of what is argued', () => {
    const names = new Set(Object.values(SOURCES).map((source) => source.name));
    for (const each of early) {
      expect(each.sources.length).toBeGreaterThan(0);
      for (const source of each.sources) expect(names).toContain(source.name);
    }
    const argued = early.filter((each) => each.title.includes('argued'));
    expect(argued.map((each) => each.id)).toEqual([
      'earth-grows',
      'impact',
      'moon-gathers',
      'moon-crust',
    ]);
    for (const each of argued) expect(each.sources.length).toBeGreaterThan(1);
  });

  it('says how Theia comes in as the scenario chosen has it, on its paper’s say-so (#1220)', () => {
    const theia = (model: 'canonical' | 'halfEarths' | 'fastSpin') =>
      formationPhases(4510, model).find((each) => each.id === 'theia');
    expect(theia('canonical')?.text).toContain('size of Mars');
    expect(theia('halfEarths')?.text).toContain('as large as the proto-Earth');
    expect(theia('fastSpin')?.sources[0]?.name).toBe('Ćuk & Stewart 2012');
  });
});
