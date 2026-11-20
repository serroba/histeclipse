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

/**
 * GW170817's card (#990): what was heard and seen on 17 August 2017, as the discovery paper gives
 * it (Abbott et al. 2017, PRL 119, 161101: its abstract, text and Table I, low-spin column) and
 * the multi-messenger paper (Abbott et al. 2017, ApJL 848, L12), with their ranges.
 */
export const GW170817_CARD: MarkerCardContent = {
  title: 'GW170817: two neutron stars merge, heard and seen',
  facts: [
    ['When', '17 August 2017, 12:41:04 UTC'],
    [
      'Heard by',
      'LIGO Livingston, LIGO Hanford and Virgo, in Italy: together they placed it in 28 square degrees of the southern sky',
    ],
    [
      'The two neutron stars',
      '1.36 to 1.60 and 1.17 to 1.36 times the Sun’s mass, 2.74 (+0.04, −0.01) together, if they spun slowly, as the neutron-star pairs known in our Galaxy do',
    ],
    [
      'Their size',
      'About 24 km across each (radius 11.9 ± 1.4 km, from how the tides shaped the wave)',
    ],
    ['How far', '40 (+8, −14) megaparsecs: about 130 million light-years, in the galaxy NGC 4993'],
    [
      'How it sounded',
      'A chirp heard from 24 Hz for about 100 s, some 3,000 cycles, rising to over a thousand hertz as the stars touched',
    ],
    [
      'Then in light',
      'A burst of gamma rays, GRB 170817A, 1.7 s after the merger (Fermi and INTEGRAL); and a new light in NGC 4993 found 10.9 hours later, the kilonova AT 2017gfo, followed for weeks from radio to X-rays',
    ],
  ],
  links: [
    {
      label: 'The discovery paper (Abbott et al. 2017)',
      href: 'https://doi.org/10.1103/PhysRevLett.119.161101',
    },
    {
      label: 'The light that followed (Abbott et al. 2017, ApJL)',
      href: 'https://doi.org/10.3847/2041-8213/aa91c9',
    },
    { label: 'GWOSC: GW170817 and its data', href: 'https://gwosc.org/events/GW170817/' },
  ],
  note: 'The ranges are 90% credible intervals. The masses are as in the source frame; with fast spins allowed they range more widely, 0.86 to 2.26 Suns. The radius is from Abbott et al. 2018 (PRL 121, 161101).',
};
