/**
 * Deep time's span: the 540 million years the elevation maps cover, the ice ages of the last
 * 2.6 million, or all of Earth's 4.6 billion.
 */
export const DEEP_SCALES = ['all', 'ice', 'eons'] as const;
export type DeepScale = (typeof DEEP_SCALES)[number];

/** Deep time reaches back to the oldest solids of the Solar System (Connelly et al. 2012). */
export const EARTH_AGE_MA = 4568;

/** Deep-time moments are kept to a thousand years, fine enough for the ice ages. */
export function roundMa(ma: number): number {
  return Math.round(ma * 1000) / 1000;
}
