/**
 * How a gravitational wave moves free things (#829): the strain's two polarisations, h₊ and h×,
 * and the displacement they make, worked out exactly to first order in the transverse-traceless
 * gauge. A wave travelling along a unit direction n stretches and squeezes space across n only:
 * a free point at x moves by Δx = ½ h·x, where h = h₊ e₊ + h× e×, with e₊ = p⊗p − q⊗q and
 * e× = p⊗q + q⊗p for p, q at right angles to n and to each other. Along z, with p = x̂ and
 * q = ŷ, that is Δx = ½(h₊x + h×y), Δy = ½(h×x − h₊y), Δz = 0, h taken at t − z/c.
 *
 * And a model chirp: a Newtonian one for two black holes of GW150914's chirp mass (about 30 Suns),
 * rising in pitch and loudness to the merger, then the ringdown of the one black hole they make.
 * The ring plays the measured wave (`measured.ts`, #830); the model is what its tests play.
 *
 * Pure: no DOM, no three.js.
 */

export type Triple = readonly [number, number, number];

/** A wave's two polarisations at a moment. */
export interface Polarisations {
  readonly plus: number;
  readonly cross: number;
}

/** A wave's strain through time: seconds from the merger (its peak), negative before it. */
export interface Waveform {
  /** Where it starts and ends, s from the merger. */
  readonly start: number;
  readonly end: number;
  /** Its largest strain, either polarisation. */
  readonly peak: number;
  /** h₊ and h× at `t` s from the merger; zero outside start…end. */
  at(t: number): Polarisations;
  /** Its frequency at `t`, Hz: what the ear would hear. */
  frequency(t: number): number;
}

/** The displacement of a free point at (x, y) by a wave along z: ½(h₊x + h×y), ½(h×x − h₊y). */
export function displacementInPlane(h: Polarisations, x: number, y: number): [number, number] {
  return [0.5 * (h.plus * x + h.cross * y), 0.5 * (h.cross * x - h.plus * y)];
}

function dot(a: Triple, b: Triple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Triple, b: Triple): Triple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function unit(a: Triple): Triple {
  const length = Math.hypot(a[0], a[1], a[2]);
  if (length === 0) throw new Error('a wave needs a direction');
  return [a[0] / length, a[1] / length, a[2] / length];
}

/**
 * The two axes across a wave going along `direction`, as the polarisations are measured from:
 * p, then q = n × p. For a wave along z, x̂ and ŷ; otherwise p lies level (across z) if it can.
 */
export function waveAxes(direction: Triple): { readonly p: Triple; readonly q: Triple } {
  const n = unit(direction);
  const level = cross([0, 0, 1], n);
  const p = Math.hypot(...level) < 1e-9 ? ([1, 0, 0] as Triple) : unit(level);
  // Along +z, cross(ẑ, n) is zero and p = x̂, q = ẑ × x̂ = ŷ, as the plane's own formula has it.
  return { p, q: cross(n, p) };
}

/** The displacement of a free point at `x` from the origin, by a wave going along `direction`. */
export function displacement(h: Polarisations, direction: Triple, x: Triple): Triple {
  const { p, q } = waveAxes(direction);
  const xp = dot(p, x);
  const xq = dot(q, x);
  // ½ h·x = ½[h₊(p(p·x) − q(q·x)) + h×(p(q·x) + q(p·x))]
  const along = 0.5 * (h.plus * xp + h.cross * xq);
  const across = 0.5 * (h.cross * xp - h.plus * xq);
  return [along * p[0] + across * q[0], along * p[1] + across * q[1], along * p[2] + across * q[2]];
}

/** G·M☉/c³: the Sun's mass as a time, s. */
const SUN_SECONDS = 4.925_491e-6;

export interface ChirpOptions {
  /** The chirp mass, Suns. */
  readonly chirpMass: number;
  /** Where the chirp is heard from, Hz. */
  readonly from: number;
  /** Where the inspiral gives way to the ringdown, Hz. */
  readonly merger: number;
  /** The final black hole's ringing: its frequency, Hz, and damping time, s. */
  readonly ringdown: { readonly frequency: number; readonly damping: number };
  /** The strain at the merger. */
  readonly peak: number;
  /** How long the ringdown is followed, in damping times. */
  readonly ringFor?: number;
}

/** GW150914 as a stand-in (Abbott et al. 2016): chirp mass about 30 Suns, from 35 Hz to the
 * merger near 150 Hz, peak strain 1.0 × 10⁻²¹, ringing at about 250 Hz for about 4 ms. */
export const GW150914_STAND_IN: ChirpOptions = {
  chirpMass: 30,
  from: 35,
  merger: 150,
  ringdown: { frequency: 250, damping: 0.004 },
  peak: 1.0e-21,
};

/**
 * A Newtonian chirp, then a ringdown, as seen face on (both polarisations, a quarter cycle
 * apart). Before the merger, τ = −t s to go: f = (1/π)(5/(256τ))^⅜ (GℳM☉/c³)^−⅝, the phase
 * Φ = −2(τ/5𝓜)^⅝, the amplitude rising as f^⅔. After, the ringing dies as e^(−t/τ).
 */
export function chirp(options: ChirpOptions): Waveform {
  const mass = options.chirpMass * SUN_SECONDS;
  /** Time to go before the merger at which the chirp is at `f` Hz. */
  const before = (f: number): number => (5 / 256) * (Math.PI * f) ** (-8 / 3) * mass ** (-5 / 3);
  const tMerger = before(options.merger);
  const start = -before(options.from) + tMerger;
  const phase = (tau: number): number => -2 * (tau / (5 * mass)) ** (5 / 8);
  const pitch = (tau: number): number =>
    (1 / Math.PI) * (5 / (256 * tau)) ** (3 / 8) * mass ** (-5 / 8);
  const { frequency: ring, damping } = options.ringdown;
  const end = damping * (options.ringFor ?? 6);
  // The merger's phase, for the ringdown to carry on from.
  const mergerPhase = phase(tMerger);
  return {
    start,
    end,
    peak: options.peak,
    at(t) {
      if (t < start || t > end) return { plus: 0, cross: 0 };
      if (t <= 0) {
        // Shifted so the merger frequency falls at t = 0.
        const tau = tMerger - t;
        const amplitude = options.peak * (pitch(tau) / options.merger) ** (2 / 3);
        const angle = phase(tau);
        return { plus: amplitude * Math.cos(angle), cross: amplitude * Math.sin(angle) };
      }
      const amplitude = options.peak * Math.exp(-t / damping);
      const angle = mergerPhase + 2 * Math.PI * ring * t;
      return { plus: amplitude * Math.cos(angle), cross: amplitude * Math.sin(angle) };
    },
    frequency(t) {
      if (t < start || t > end) return 0;
      return t <= 0 ? pitch(tMerger - t) : ring;
    },
  };
}
