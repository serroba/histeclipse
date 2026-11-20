/**
 * A wave as a sound (#831), played only when asked: the wave's own pitch and loudness, rising to
 * the merger and any ringing after, made into a tone. GW150914 as it was, a fifth of a second low
 * in the bass, is hard to hear; so it is slowed 10 times and raised two octaves (four times the
 * pitch). GW170817's last fifth of a second, from 250 Hz to over 1 kHz, is slowed and kept at
 * its own pitch (#990). The stage says which.
 */

import type { Waveform } from './strain';

/** How many times slower it is played. */
export const SOUND_SLOWED = 10;
/** Points a second in the tone's curves. */
const STEPS_PER_SECOND = 200;

export interface ToneCurves {
  /** How long it plays, s. */
  readonly seconds: number;
  /** Its pitch, Hz, and loudness, 0 to 1, at even steps over that time. */
  readonly pitch: Float32Array;
  readonly loudness: Float32Array;
}

/** The tone's pitch and loudness through time, from the wave, `raised` times higher. */
export function toneCurves(wave: Waveform, raised: number): ToneCurves {
  const seconds = (wave.end - wave.start) * SOUND_SLOWED;
  const count = Math.max(2, Math.round(seconds * STEPS_PER_SECOND));
  const pitch = new Float32Array(count);
  const loudness = new Float32Array(count);
  let heard = 0;
  for (let index = 0; index < count; index += 1) {
    const t = wave.start + ((wave.end - wave.start) * index) / (count - 1);
    const { plus, cross } = wave.at(t);
    const hertz = wave.frequency(t);
    // Where its pitch cannot be read, the last one heard holds, so the tone does not drop out.
    if (hertz > 0) heard = hertz;
    pitch[index] = (heard > 0 ? heard : 35) * raised;
    loudness[index] = wave.peak > 0 ? Math.hypot(plus, cross) / wave.peak : 0;
  }
  return { seconds, pitch, loudness };
}

/** What the sound asks of Web Audio: a context, or a stand-in in the tests. */
export interface ToneContext {
  readonly currentTime: number;
  readonly destination: AudioNode;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  close(): Promise<void>;
}

/** Play the tone once; gives back how to stop it early. */
export function playTone(context: ToneContext, curves: ToneCurves): () => void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + 0.05;
  oscillator.type = 'sine';
  oscillator.frequency.setValueCurveAtTime(curves.pitch, start, curves.seconds);
  gain.gain.setValueCurveAtTime(
    curves.loudness.map((value) => value * 0.5),
    start,
    curves.seconds,
  );
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + curves.seconds);
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    oscillator.disconnect();
    gain.disconnect();
    void context.close();
  };
  oscillator.addEventListener('ended', stop);
  return stop;
}
