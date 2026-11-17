/**
 * GW150914's card (#830): what was heard on 14 September 2015, as the discovery paper gives it
 * (Abbott et al. 2016, PRL 116, 061102, its abstract and Table I), with the ranges it gives,
 * and where to read it and its data.
 */

import type { MarkerCardContent } from '../../ui/markerCard';

export const GW150914_CARD: MarkerCardContent = {
  title: 'GW150914: the first gravitational wave heard',
  facts: [
    ['When', '14 September 2015, 09:50:45 UTC'],
    [
      'Heard by',
      'LIGO Livingston, Louisiana, then LIGO Hanford, Washington, 6.9 ms later (+0.5, −0.4 ms): the wave came from the southern sky',
    ],
    ['The two black holes', '36 (+5, −4) and 29 (± 4) times the Sun’s mass'],
    ['The one they made', '62 (± 4) times the Sun’s mass, spinning'],
    [
      'Given off as waves',
      '3.0 (± 0.5) Suns’ mass as energy, in about a fifth of a second: at its peak, more power than the light of all the stars in the observable universe',
    ],
    ['How far', '410 (+160, −180) megaparsecs: about 1.3 billion light-years'],
    [
      'How strong',
      'A peak strain of 1.0 × 10⁻²¹: LIGO’s 4 km arms changed in length by about 4 × 10⁻¹⁸ m',
    ],
    ['How it sounded', 'A chirp, rising from 35 to 250 Hz, eight cycles in 0.2 s'],
  ],
  links: [
    {
      label: 'The discovery paper (Abbott et al. 2016)',
      href: 'https://doi.org/10.1103/PhysRevLett.116.061102',
    },
    { label: 'GWOSC: GW150914 and its data', href: 'https://gwosc.org/events/GW150914/' },
  ],
  note: 'The ranges are the paper’s 90% credible intervals. The masses are as in the source frame; the distance carries most of the uncertainty.',
};
