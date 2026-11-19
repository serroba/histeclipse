import { PRESENT_YEAR } from '../time/present';
import { layer } from './layer';

/** The most significant telescopes, on the ground and in space (#848, epic #852). */
export const telescopes = layer({
  id: 'telescopes',
  label: 'Telescopes',
  about:
    'The most significant telescopes: on Earth, each at its site from its first light to its closing, from Herschel’s 40-foot of 1789 to the ELT being built; in space, each on its orbit while it worked, about Earth or out at L2 and around the Sun. Tap one for its card.',
  spans: ['years'],
  reach: 'In the years, from 1789 to today.',
  covers: { years: [1789, PRESENT_YEAR] },
  list: true,
});
