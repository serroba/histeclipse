/**
 * What the radiocarbon curve shows that a student should see marked on it: sudden spikes of
 * carbon-14 from solar storms (Miyake events), which date a tree ring to its very year, and the
 * Hallstatt plateau, where centuries share one radiocarbon age. Each names its source.
 */

import type { SourceId } from '../sources/registry';

export interface RadiocarbonEvent {
  readonly name: string;
  /** Astronomical years (0 is 1 BCE): when, or from when to when. */
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly sources: readonly SourceId[];
}

/** Oldest first. */
export const RADIOCARBON_EVENTS: readonly RadiocarbonEvent[] = [
  {
    name: 'Miyake event, 7176 BCE',
    from: -7175,
    to: -7175,
    text: 'A sudden rise in carbon-14 in a single year, from a storm of particles from the Sun.',
    sources: ['brehm2022'],
  },
  {
    name: 'Miyake event, 5259 BCE',
    from: -5258,
    to: -5258,
    text: 'A sudden rise in carbon-14 in a single year, from a storm of particles from the Sun.',
    sources: ['brehm2022'],
  },
  {
    name: 'The Hallstatt plateau',
    from: -799,
    to: -399,
    text: 'The curve runs flat: about four centuries give much the same radiocarbon age, so an Iron Age date can only be placed somewhere in them.',
    sources: ['intcal20'],
  },
  {
    name: 'Miyake event, about 660 BCE',
    from: -660,
    to: -660,
    text: 'A sharp rise in carbon-14, beryllium-10 and chlorine-36 together: an extreme solar storm.',
    sources: ['oHare2019'],
  },
  {
    name: 'Miyake event, 774/775 CE',
    from: 774,
    to: 774,
    text: 'The first found: a one-year jump in carbon-14 in tree rings in Japan, then worldwide. Rings carrying it are dated to the year.',
    sources: ['miyake2012'],
  },
  {
    name: 'Miyake event, 993/994 CE',
    from: 993,
    to: 993,
    text: 'A second one-year jump. Wood cut at L’Anse aux Meadows, Newfoundland, carries it 29 rings in: the Vikings were felling trees there in 1021 CE.',
    sources: ['miyake2013', 'kuitems2022'],
  },
];
