/**
 * What the deep-time globe's colours and the milestone ticks mean. The map colours are the
 * globe shader's (`src/globe/scene.ts`), in sRGB; keep the two in step.
 */

import type { MilestoneKind } from './milestones';

export interface KeyEntry {
  readonly label: string;
  /** A CSS colour or gradient for the swatch. */
  readonly swatch: string;
}

/** sRGB components 0..1, as the shader writes them, as a CSS hex colour. */
export function hex(red: number, green: number, blue: number): string {
  const byte = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(red)}${byte(green)}${byte(blue)}`;
}

const gradient = (...stops: readonly string[]) => `linear-gradient(to right, ${stops.join(', ')})`;

export const MAP_KEY: readonly KeyEntry[] = [
  {
    label: 'Sea: deep ocean to shallow shelf',
    swatch: gradient(hex(0.04, 0.12, 0.3), hex(0.13, 0.34, 0.58), hex(0.36, 0.64, 0.78)),
  },
  {
    label: 'Land by height: lowland, upland, mountains, peaks',
    swatch: gradient(
      hex(0.33, 0.5, 0.26),
      hex(0.66, 0.6, 0.4),
      hex(0.52, 0.4, 0.29),
      hex(0.92, 0.92, 0.9),
    ),
  },
  { label: 'Sea floor laid bare by a low sea (ice ages)', swatch: hex(0.72, 0.68, 0.46) },
  { label: 'Ice sheets and sea ice', swatch: gradient(hex(0.78, 0.87, 0.95), hex(0.97, 0.98, 1)) },
  { label: 'Continents as plate models draw them', swatch: hex(0.55, 0.45, 0.58) },
  { label: 'Before any map: a plain globe, not a guess', swatch: hex(0.2, 0.25, 0.33) },
];

/** The milestone ticks on the time line, by kind; their colours are in the stylesheet. */
export const MILESTONE_KEY: readonly { readonly kind: MilestoneKind; readonly label: string }[] = [
  { kind: 'cosmos', label: 'Earth, Moon and Sun' },
  { kind: 'continents', label: 'Continents' },
  { kind: 'climate', label: 'Climate' },
  { kind: 'life', label: 'Life' },
  { kind: 'extinction', label: 'Extinctions' },
  { kind: 'humans', label: 'Humans' },
];
