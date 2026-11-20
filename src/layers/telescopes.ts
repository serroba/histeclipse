import { PRESENT_YEAR } from '../time/present';
import { layer } from './layer';

/** The most significant telescopes, on the ground and in space (#848, epic #852). */
export const telescopes = layer({
  id: 'telescopes',
  label: 'Telescopes',
  summary: 'The great telescopes, on the ground and in space.',
  about:
    'The most significant telescopes: on Earth, each at its site from its first light to its closing, from Herschel’s 40-foot of 1789 to the ELT being built; in space, each on its orbit while it worked, about Earth or out at L2 and around the Sun. Tap one for its card.',
  spans: ['years'],
  reach: 'In the years, from 1789 to today.',
  covers: { years: [1789, PRESENT_YEAR] },
  list: true,
  // A telescope's tube on its tripod (#848).
  icon: ['M3 13l13-7 2 4-13 7z', 'M16 6l2-1 2 4-2 1', 'M10 14l-3 7M11 14l3 7'],
  why: 'telescopes',
});
