// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, type ViewState } from '../../state/viewState';
import type { Capabilities } from '../feature';
import { createFormation, formationEvent, opensFormation } from '.';

const YEAR = 365.25 * 86_400;
const MYR = 1e6 * YEAR;

describe('the aeons begin with Earth and the Moon forming (#1218)', () => {
  it('opens as deep time starts playing from before the impact, unless less motion is asked', () => {
    expect(opensFormation(false, true, 4568, 'early', false)).toBe(true);
    expect(opensFormation(false, true, 4520, 'early', false)).toBe(true);
    // After the impact as dated, not before it in another model.
    expect(opensFormation(false, true, 4500, 'early', false)).toBe(false);
    expect(opensFormation(false, true, 4400, 'young', false)).toBe(true);
    // Only as play starts, not as it goes on or while paused.
    expect(opensFormation(true, true, 4568, 'early', false)).toBe(false);
    expect(opensFormation(false, false, 4568, 'early', false)).toBe(false);
    expect(opensFormation(false, true, null, 'early', false)).toBe(false);
    expect(opensFormation(false, true, 4568, 'early', true)).toBe(false);
  });

  it('watches the event once each time play starts', () => {
    let playing = false;
    const watch = vi.fn();
    const formation = createFormation(
      {
        ownTime: { watch, arrive: vi.fn() },
        timeline: { playing: () => playing } as unknown as Capabilities['timeline'],
      },
      () => false,
    );
    const at = (ma: number): ViewState => ({
      ...defaultViewState(new Date('2026-01-01T00:00:00Z')),
      ma,
    });
    formation.show(at(4568));
    playing = true;
    formation.show(at(4567.9));
    formation.show(at(4567.8));
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenCalledWith(expect.objectContaining({ key: 'formation' }), 4567.9);
    playing = false;
    formation.show(at(4500));
    playing = true;
    formation.show(at(4499));
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('dates the clock by the impact model, and maps its moments onto deep time', () => {
    const early = formationEvent('early');
    const young = formationEvent('young');
    expect(early.scale.positionAt(0)).toBeLessThan(young.scale.positionAt(0));
    expect(early.deep?.maAt(0)).toBe(4510);
    expect(young.deep?.maAt(1.5 * MYR)).toBeCloseTo(4348.5);
    expect(early.deep?.secondsAt(4511)).toBeCloseTo(-MYR, -3);
  });

  it('marks the globe while it plays', () => {
    const on = document.createElement('div');
    const tools = { strikes: { on }, layer: vi.fn() } as unknown as Parameters<
      ReturnType<typeof formationEvent>['play']
    >[0];
    const played = formationEvent('intermediate').play(tools);
    expect(on.dataset['formationClock']).toBe('intermediate');
    played.at(0);
    played.end();
    expect(on.dataset['formationClock']).toBeUndefined();
  });
});
