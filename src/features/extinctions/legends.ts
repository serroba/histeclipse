/**
 * The keys to the extinctions' marks and colours on the globe, under their clocks (#1268).
 *
 * Pure.
 */

import type { LegendItem } from '../ownTime';

/** A province's marks and colours (#1268). */
export const PROVINCE_LEGEND: readonly LegendItem[] = [
  ['cause', 'The lava province'],
  ['record', 'Where the extinction is dated'],
  ['smoke', 'Smoke, darker with gas from the sills'],
  ['lava', 'Lava flowing'],
  ['basalt', 'Lava cooled to basalt'],
];

/** A crisis of the seas' marks and colours: its ice's only where it had an ice sheet. */
export function seasLegend(iced: boolean): readonly LegendItem[] {
  return [
    ['cause', iced ? 'The ice sheet’s place' : 'A possible cause'],
    ['record', 'Where the extinction is dated'],
    ...(iced ? [['ice', 'The ice sheet’s reach'] as const] : []),
    ['anoxia', 'Oxygen-poor water'],
  ];
}
