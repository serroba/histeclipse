// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';

import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';

import {
  playTone,
  SOUND_NOTE,
  SOUND_RAISED,
  SOUND_SLOWED,
  toneCurves,
  type ToneContext,
} from './chirpSound';
import { GW150914_SCHEMA, measuredWave } from './measured';

const wave = measuredWave(
  v.parse(GW150914_SCHEMA, JSON.parse(readFileSync('public/data/gw150914.json', 'utf8'))),
);

describe('GW150914 as a sound (#831)', () => {
  const curves = toneCurves(wave);

  it('lasts ten times as long as the wave, about two seconds', () => {
    expect(curves.seconds).toBeCloseTo((wave.end - wave.start) * SOUND_SLOWED, 9);
    expect(curves.seconds).toBeGreaterThan(1.5);
    expect(curves.pitch.length).toBe(curves.loudness.length);
    expect(SOUND_NOTE).toContain('Slowed 10 times');
  });

  it('rises in pitch, raised four times, and is loudest at the merger', () => {
    const third = Math.round(curves.pitch.length / 3);
    const loudest = curves.loudness.indexOf(Math.max(...curves.loudness));
    expect(curves.pitch[third] ?? 0).toBeGreaterThan(30 * SOUND_RAISED);
    expect(curves.pitch[loudest] ?? 0).toBeGreaterThan(curves.pitch[third] ?? 0);
    expect(Math.max(...curves.loudness)).toBeCloseTo(1, 1);
    expect(Math.min(...curves.pitch)).toBeGreaterThan(0);
  });

  it('plays once through Web Audio, and lets it all go when it ends or is stopped', () => {
    const param = (): { setValueCurveAtTime: ReturnType<typeof vi.fn> } => ({
      setValueCurveAtTime: vi.fn(),
    });
    const listeners: (() => void)[] = [];
    const oscillator = {
      type: '',
      frequency: param(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: (_: string, run: () => void) => listeners.push(run),
    };
    const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
    const close = vi.fn(() => Promise.resolve());
    const context = {
      currentTime: 2,
      destination: {} as AudioNode,
      createOscillator: () => oscillator as unknown as OscillatorNode,
      createGain: () => gain as unknown as GainNode,
      close,
    } satisfies ToneContext;
    const stop = playTone(context, curves);
    expect(oscillator.frequency.setValueCurveAtTime).toHaveBeenCalledWith(
      curves.pitch,
      2.05,
      curves.seconds,
    );
    expect(oscillator.start).toHaveBeenCalledWith(2.05);
    expect(oscillator.stop).toHaveBeenCalledWith(2.05 + curves.seconds);
    for (const ended of listeners) ended();
    stop();
    expect(close).toHaveBeenCalledTimes(1);
    expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
  });
});
