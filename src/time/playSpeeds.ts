/**
 * The Years bar's speeds (#915), set by the years it shows: slow plays them all in about two
 * minutes, medium in thirty seconds, fast in ten, each rounded to a speed easy to read. Under a
 * year a second the speeds are months a second; up to a year a second the years play month by
 * month.
 */

export const SPEED_LEVELS = ['slow', 'medium', 'fast'] as const;
export type SpeedLevel = (typeof SPEED_LEVELS)[number];

/** Seconds to play the whole window at each level. */
const SECONDS: Readonly<Record<SpeedLevel, number>> = { slow: 120, medium: 30, fast: 10 };

/** The months a second offered under a year a second. */
const MONTH_STEPS = [1, 2, 3, 6] as const;

export interface PlaySpeed {
  readonly level: SpeedLevel;
  /** Years a second. */
  readonly yearsPerSecond: number;
  /** In words: `1 month/s`, `6 months/s`, `20 yr/s`, `1,000 yr/s`. */
  readonly label: string;
}

/** A speed rounded to read easily: months a second under a year, else 1, 2 or 5 × 10ⁿ yr/s. */
export function niceSpeed(yearsPerSecond: number): number {
  if (yearsPerSecond < 1) {
    const months = yearsPerSecond * 12;
    const nearest = MONTH_STEPS.reduce((best, step) =>
      Math.abs(Math.log(step / months)) < Math.abs(Math.log(best / months)) ? step : best,
    );
    return nearest / 12;
  }
  const power = 10 ** Math.floor(Math.log10(yearsPerSecond));
  const mantissa = yearsPerSecond / power;
  const step = mantissa < 1.5 ? 1 : mantissa < 3.5 ? 2 : mantissa < 7.5 ? 5 : 10;
  return step * power;
}

/** A speed in words. */
export function speedLabel(yearsPerSecond: number): string {
  if (yearsPerSecond < 1) {
    const months = Math.round(yearsPerSecond * 12);
    return `${String(months)} ${months === 1 ? 'month' : 'months'}/s`;
  }
  return `${yearsPerSecond.toLocaleString('en')} yr/s`;
}

/** The speeds for a window `years` long, slow first; no two alike. */
export function speedsFor(years: number): PlaySpeed[] {
  const seen = new Set<number>();
  return SPEED_LEVELS.flatMap((level) => {
    const yearsPerSecond = niceSpeed(Math.max(years, 1) / SECONDS[level]);
    if (seen.has(yearsPerSecond)) return [];
    seen.add(yearsPerSecond);
    return [{ level, yearsPerSecond, label: speedLabel(yearsPerSecond) }];
  });
}

/** The speed at a level for a window, or the nearest level there is when two fell together. */
export function speedAt(years: number, level: SpeedLevel): PlaySpeed {
  const speeds = speedsFor(years);
  const exact = speeds.find((speed) => speed.level === level);
  if (exact !== undefined) return exact;
  // Levels that fell together: the slower kept its place, so take the last before it.
  const index = SPEED_LEVELS.indexOf(level);
  const earlier = speeds.filter((speed) => SPEED_LEVELS.indexOf(speed.level) < index);
  return earlier.at(-1) ?? speeds[0] ?? { level, yearsPerSecond: 1, label: speedLabel(1) };
}

/**
 * Whether a speed plays month by month: up to a year a second, twelve months a second at most,
 * so monthly maps (El Niño's) show each month rather than one a year.
 */
export function byMonth(yearsPerSecond: number): boolean {
  return yearsPerSecond <= 1;
}
