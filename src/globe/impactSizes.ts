/**
 * How large an impact is drawn and how long it plays (#314, #1167): in proportion to its crater,
 * Chicxulub's the yardstick, and longer and larger for one that reached the whole globe.
 *
 * Pure.
 */

const EARTH_KM = 6371;
/** Milliseconds, for an impact Chicxulub's size: the approach, the flash, the ring, the whole. */
export const APPROACH = 1400;
const FLASH = 700;
export const RING = 2800;
const TOTAL = 5200;
/** Milliseconds more a worldwide impact plays: its veil left to clear (#1167). */
const WORLDWIDE_MORE = 5000;
/** Chicxulub's crater, km: the yardstick the others are drawn against. */
const YARDSTICK_KM = 180;

/** How large an impact is drawn, in Earth radii, and how long it lasts, ms. */
export interface ImpactSizes {
  /** Its crater's width against Chicxulub's: 1 for Chicxulub, capped for the very largest. */
  readonly strength: number;
  readonly head: number;
  readonly trail: number;
  readonly flash: number;
  readonly craterRadius: number;
  readonly blastRadius: number;
  /** How far its effects reached around the Earth, 0 to 1. */
  readonly worldwide: number;
  readonly flashMs: number;
  readonly totalMs: number;
}

/**
 * An impact's sizes, in proportion to its crater: the flash, impactor and trail grow with the
 * crater's width, so Chicxulub's flash is eighteen times a 10 km crater's; each has a floor,
 * so the smallest still show. A smaller one plays out sooner.
 */
export function impactSizes(craterKm: number, worldwide = 0): ImpactSizes {
  const strength = Math.min(Math.max(craterKm, 0) / YARDSTICK_KM, 1.7);
  const craterRadius = Math.max(craterKm / 2 / EARTH_KM, 0.002);
  const reach = Math.min(1, Math.max(0, worldwide));
  return {
    strength,
    head: Math.max(0.012, 0.05 * strength) * (1 + 0.6 * reach),
    trail: Math.max(0.04, 0.12 * strength) * (1 + 1.5 * reach),
    // A worldwide one's fireball lights up most of the side of the globe in view.
    flash: Math.max(0.02, 0.3 * strength) * (1 + 2.5 * reach),
    craterRadius,
    // The blast's reach is illustrative: four crater radii, and never too small to see.
    blastRadius: Math.max(craterRadius * 4, 0.015) * (1 + 2 * reach),
    worldwide: reach,
    flashMs: FLASH * (1 + reach),
    totalMs: TOTAL * (0.5 + 0.5 * Math.min(strength, 1)) + WORLDWIDE_MORE * reach,
  };
}
