/** Shared geography, imported by every part of the app; it imports nothing (#378). */

export interface GeoPoint {
  /** Degrees, −90 to 90. */
  readonly latitude: number;
  /** Degrees, −180 (exclusive) to 180. */
  readonly longitude: number;
}
