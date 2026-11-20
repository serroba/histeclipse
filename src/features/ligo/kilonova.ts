/**
 * The kilonova AT 2017gfo (#992, epic #994): what GW170817 flung out, and how it shone. Two
 * components, as Kasen et al. (2017, Nature 551, 80) read them from its light:
 *   - a fast "blue" one, about 0.025 Suns at 0.3c, thrown out toward the poles as the stars
 *     touched, light r-process elements (lighter than about A = 140) that let light out soon;
 *   - a slower "red" one, about 0.04 Suns at 0.1c, mostly a wind from the disk about the
 *     remnant, rich in lanthanides, heavy and opaque, so its light comes out late and red.
 * Gold and platinum would be made with the lanthanides, in the red; neither was seen directly.
 *
 * Its light is a simple model, not the measured light curve: each component is heated by its
 * radioactive nuclei at ė ≈ 2 × 10¹⁰ ε (t/day)^−1.3 erg/s/g, and lets that heat out once light
 * can diffuse through it, from about t_peak = 1.6 d (M/0.01 M☉)^½ (v/0.1c)^−½ (κ/1 cm²/g)^½
 * (Metzger 2020, Living Reviews in Relativity 23, 1, eqs. 7 and 23). Opacities of 0.5 cm²/g
 * (lanthanide-free) and 10 (lanthanide-rich) set the two apart.
 *
 * Its clock runs in days from the merger, played on a log scale: hours at first, weeks by the end,
 * with what was seen when (Abbott et al. 2017, ApJL 848, L12; Watson et al. 2019).
 *
 * Pure: no DOM, no three.js.
 */

/** A component of the ejecta. */
export interface Ejecta {
  readonly name: 'blue' | 'red';
  /** Its mass, Suns; its speed, as a share of light's; its opacity, cm²/g. */
  readonly suns: number;
  readonly speed: number;
  readonly opacity: number;
}

/** The two components (Kasen et al. 2017), with the opacities the model gives them. */
export const EJECTA: readonly [Ejecta, Ejecta] = [
  { name: 'blue', suns: 0.025, speed: 0.3, opacity: 0.5 },
  { name: 'red', suns: 0.04, speed: 0.1, opacity: 10 },
];

/** Earth's mass in Suns' (IAU nominal values). */
export const EARTHS_PER_SUN = 332_946;
/** The Sun's mass, g; light's speed, km/s; an astronomical unit, km. */
const SUN_GRAMS = 1.988_4e33;
const LIGHT_KM = 299_792.458;
const AU_KM = 149_597_870.7;
const DAY_S = 86_400;
/** The share of the radioactive heat that warms the ejecta rather than escaping (ε). */
const THERMALISED = 0.5;

/** When the component's light peaks, days (Metzger 2020, eq. 7). */
export function peakDays(part: Ejecta): number {
  return 1.6 * Math.sqrt(part.suns / 0.01) * Math.sqrt(0.1 / part.speed) * Math.sqrt(part.opacity);
}

/** The heat its radioactive nuclei give, erg/s per gram, `days` after the merger (eq. 23). */
export function heatingRate(days: number): number {
  return 2e10 * THERMALISED * days ** -1.3;
}

/**
 * How bright the component shines, erg/s, `days` after the merger: all its heat once light gets
 * out, and before that the share of it near enough the surface to, rising as (t/t_peak)^3/2.
 */
export function luminosity(part: Ejecta, days: number): number {
  if (days <= 0) return 0;
  const reach = Math.min(1, (days / peakDays(part)) ** 1.5);
  return part.suns * SUN_GRAMS * heatingRate(days) * reach;
}

/** How far out the component's leading edge is, AU, `days` after the merger. */
export function reachAu(part: Ejecta, days: number): number {
  return (part.speed * LIGHT_KM * days * DAY_S) / AU_KM;
}

/** The clock: from an hour after the merger to four weeks, on a log scale. */
const FIRST_DAY = 1 / 24;
const LAST_DAY = 28;
/** How long the chapter plays the clock, and rests at its end, ms. */
export const KILONOVA_MS = { glow: 24_000, rest: 3000 } as const;

/** Days after the merger, `ms` into the chapter (looping). */
export function kilonovaDays(ms: number): number {
  const total = KILONOVA_MS.glow + KILONOVA_MS.rest;
  const into = ((ms % total) + total) % total;
  const share = Math.min(1, into / KILONOVA_MS.glow);
  return FIRST_DAY * (LAST_DAY / FIRST_DAY) ** share;
}

/** When, ms into the chapter, it is `days` after the merger. */
export function kilonovaMs(days: number): number {
  const clamped = Math.min(LAST_DAY, Math.max(FIRST_DAY, days));
  return (KILONOVA_MS.glow * Math.log(clamped / FIRST_DAY)) / Math.log(LAST_DAY / FIRST_DAY);
}

/** What the glow is at a moment: each component's brightness, 0 to 1, against its own peak. */
export interface Glow {
  readonly days: number;
  readonly blue: number;
  readonly red: number;
  /** The share of all the light the blue gives. */
  readonly blueShare: number;
}

/** How bright each component is `days` after the merger, each against its own brightest: the
 * red is fainter at its peak than the blue at its, and drawn so it can be seen to rise. */
export function glowAt(days: number): Glow {
  const [blue, red] = EJECTA;
  const b = luminosity(blue, days);
  const r = luminosity(red, days);
  return {
    days,
    blue: b / luminosity(blue, peakDays(blue)),
    red: r / luminosity(red, peakDays(red)),
    blueShare: b + r > 0 ? b / (b + r) : 0,
  };
}

/** What was seen, and when, days after the merger. */
export const SEEN: readonly { readonly days: number; readonly text: string }[] = [
  { days: 10.9 / 24, text: 'found in NGC 4993 by the Swope telescope, Chile' },
  { days: 1.5, text: 'strontium seen in its spectrum' },
  { days: 2, text: 'its blue light fading' },
  { days: 9, text: 'X-rays seen by Chandra' },
  { days: 16, text: 'radio waves seen by the VLA' },
];

/** The clock in words: hours, then days. */
function clockText(days: number): string {
  if (days < 1) return `${String(Math.round(days * 24))} h after the merger`;
  return `Day ${days < 10 ? days.toFixed(1) : String(Math.round(days))}`;
}

/** Where the kilonova is, in words: its clock, how far out its fast edge is, what was seen. */
export function kilonovaText(days: number): string {
  const seen = [...SEEN].reverse().find((event) => days >= event.days && days < event.days * 2.5);
  const [blue] = EJECTA;
  const au = reachAu(blue, days);
  const reach = au < 10 ? au.toFixed(1) : String(Math.round(au));
  const glow = glowAt(days);
  const colour =
    glow.blueShare > 0.75
      ? 'mostly blue light'
      : glow.blueShare > 0.45
        ? 'blue and red light'
        : 'mostly red and infrared light';
  const parts = [clockText(days), colour, `its fast edge ${reach} AU out`];
  if (seen !== undefined) parts.push(seen.text);
  return parts.join(' · ');
}
