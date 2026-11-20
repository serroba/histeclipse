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

/**
 * The heavy elements in GW170817's kilonova (#992): what was detected, what was inferred, and
 * what is expected, kept apart, each with its paper; and the dispute over where most gold is
 * made, both readings given. Masses in Earths are worked out from the papers' Suns (1 Sun is
 * 332,946 Earths).
 */
export const HEAVY_ELEMENTS_CARD: MarkerCardContent = {
  title: 'Gold and platinum: what the kilonova made',
  facts: [
    [
      'Flung out',
      'About 0.065 Suns’ mass, some 20,000 Earths: 0.025 Suns fast (0.3c) and light in its elements, 0.04 Suns slower (0.1c) and heavy. Inferred from its light, and approximate (Kasen et al. 2017)',
    ],
    [
      'Detected',
      'Strontium, the only element named directly in its spectrum: lines near 350 and 810 nm, 1.5 days after, from 1 to 5 × 10⁻⁵ Suns of it in the glowing outer layers, about 3 to 17 Earths (Watson et al. 2019)',
    ],
    [
      'Inferred',
      'Lanthanides, the heavy elements whose opacity made its slow, red, weeks-long glow: about 0.04 Suns of them and what is made with them (Kasen et al. 2017)',
    ],
    [
      'Inferred: gold',
      'About 3 to 13 Earths’ mass of gold, and 1 to 5 of europium, if what was flung out holds heavy elements in the Sun’s proportions (Côté et al. 2018)',
    ],
    [
      'Not seen',
      'No line of gold or platinum stands out in its spectra: at most, tentatively, a few thousandths of a Sun of platinum and a hundredth of gold (Gillanders et al. 2021)',
    ],
    [
      'Expected',
      'The rapid neutron capture (r-process) makes heavy elements in three peaks, where nuclei hold a closed shell of 50, 82 or 126 neutrons: near strontium (mass about 80 to 90), near tellurium and xenon (about 130), and near platinum and gold (about 195) (Cowan et al. 2021)',
    ],
    [
      'Seen since',
      'Tellurium, of the second peak, in the kilonova of GRB 230307A, by JWST in 2023 (Levan et al. 2024)',
    ],
  ],
  links: [
    { label: 'Kasen et al. 2017 (Nature)', href: 'https://doi.org/10.1038/nature24453' },
    {
      label: 'Watson et al. 2019: strontium (Nature)',
      href: 'https://doi.org/10.1038/s41586-019-1676-3',
    },
    { label: 'Côté et al. 2018: the gold (ApJ)', href: 'https://doi.org/10.3847/1538-4357/aaad67' },
    { label: 'Gillanders et al. 2021 (MNRAS)', href: 'https://doi.org/10.1093/mnras/stab1861' },
    {
      label: 'Cowan et al. 2021 (Rev. Mod. Phys.)',
      href: 'https://doi.org/10.1103/RevModPhys.93.015002',
    },
    {
      label: 'Levan et al. 2024: tellurium (Nature)',
      href: 'https://doi.org/10.1038/s41586-023-06759-1',
    },
    {
      label: 'Siegel et al. 2019: collapsars (Nature)',
      href: 'https://doi.org/10.1038/s41586-019-1136-0',
    },
  ],
  note: 'Where most of the gold comes from is disputed. Kasen et al. (2017): if mergers like this one typically fling out 0.01 Suns or more, they could account for all the gold and platinum about us. Siegel et al. (2019): collapsing, fast-spinning massive stars (collapsars) may make more than 80% of these elements, rarer but each making more. Both are open.',
};
