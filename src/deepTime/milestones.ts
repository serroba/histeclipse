/**
 * Milestones of the last 540 million years. Where the literature disagrees, each position is
 * an estimate of its own, with its source and the evidence it rests on; none is chosen over
 * the others. Ages are ranges (min to max, Ma); a point has min equal to max.
 *
 * `basis` says how firm the numbers are:
 * - `stated`: the source gives the number;
 * - `stage`: the source names a geological stage, and the range is that stage's on the ICS
 *   chart v2026/06;
 * - `secondary`: the number is the source's, as quoted by a later paper.
 */

export type MilestoneKind = 'life' | 'extinction' | 'continents' | 'climate' | 'humans';
export type Basis = 'stated' | 'stage' | 'secondary';

export interface Estimate {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly basis: Basis;
  readonly source: string;
  readonly url: string;
}

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: MilestoneKind;
  /** Where the estimates differ partly because they measure different things. */
  readonly note?: string;
  readonly estimates: readonly Estimate[];
}

const ICS = 'International Chronostratigraphic Chart v2026/06 (ICS)';
const ICS_URL = 'https://stratigraphy.org/ICSchart/ChronostratChart2026-06.pdf';

/** Oldest first, by anchor. */
export const MILESTONES: readonly Milestone[] = [
  {
    id: 'cambrian-explosion',
    title: 'Cambrian explosion',
    description:
      'Most major animal groups appear in the fossil record, over 20 million years or more.',
    kind: 'life',
    note: 'A drawn-out radiation, not a moment. The base of the Cambrian marks where the period is defined to start; the Ediacaran animals came before.',
    estimates: [
      {
        label: 'Base of the Cambrian',
        min: 538.2,
        max: 539.4,
        basis: 'stated',
        source: ICS,
        url: ICS_URL,
      },
      {
        label: 'Chengjiang fossils, maximum age (uranium–lead dating)',
        min: 517.32,
        max: 518.74,
        basis: 'stated',
        source: 'Yang et al. 2018, Journal of the Geological Society 175',
        url: 'https://doi.org/10.1144/jgs2017-103',
      },
    ],
  },
  {
    id: 'first-land-plants',
    title: 'First land plants',
    description: 'Plants move onto land. The earliest evidence is microscopic spores.',
    kind: 'life',
    note: 'Fossil spores date the first evidence; molecular clocks date the common ancestor of living land plants, which can be older.',
    estimates: [
      {
        label: 'Molecular clock (95% range)',
        min: 470,
        max: 515.1,
        basis: 'stated',
        source: 'Morris et al. 2018, PNAS 115',
        url: 'https://doi.org/10.1073/pnas.1719588115',
      },
      {
        label: 'Spores between algae and land plants',
        min: 480,
        max: 480,
        basis: 'stated',
        source: 'Strother & Foster 2021, Science 373',
        url: 'https://doi.org/10.1126/science.abj2927',
      },
      {
        label: 'Fossil spores of land plants, Argentina',
        min: 471,
        max: 473,
        basis: 'stated',
        source: 'Rubinstein et al. 2010, New Phytologist 188',
        url: 'https://doi.org/10.1111/j.1469-8137.2010.03433.x',
      },
    ],
  },
  {
    id: 'end-ordovician-extinction',
    title: 'End-Ordovician mass extinction',
    description: 'Two pulses tied to glaciation wipe out about 85% of marine species.',
    kind: 'extinction',
    estimates: [
      {
        label: 'Hirnantian stage, when it struck',
        min: 443.1,
        max: 445.2,
        basis: 'stated',
        source: ICS,
        url: ICS_URL,
      },
    ],
  },
  {
    id: 'first-tetrapods',
    title: 'First four-limbed animals',
    description: 'Vertebrates with limbs instead of fins appear.',
    kind: 'life',
    note: 'Trackways in Poland would put limbs about 18 million years before the oldest bones; others read them as fish traces.',
    estimates: [
      {
        label: 'Zachełmie trackways (Eifelian)',
        min: 387.95,
        max: 393.47,
        basis: 'stage',
        source: 'Niedźwiedzki et al. 2010, Nature 463',
        url: 'https://doi.org/10.1038/nature08623',
      },
      {
        label: 'Sceptics: oldest valid tracks (Givetian)',
        min: 382.31,
        max: 387.95,
        basis: 'stage',
        source: 'Lucas 2015, Ichnos 22',
        url: 'https://doi.org/10.1080/10420940.2015.1063491',
      },
      {
        label: 'Oldest bones, Elginerpeton (late Frasnian)',
        min: 372.15,
        max: 382.31,
        basis: 'stage',
        source: 'Ahlberg 1995, Nature 373',
        url: 'https://doi.org/10.1038/373420a0',
      },
    ],
  },
  {
    id: 'oldest-forests',
    title: 'Oldest fossil forests',
    description: 'Roots and stumps in New York State record some of the earliest forests.',
    kind: 'life',
    estimates: [
      {
        label: 'Cairo, New York (Givetian)',
        min: 382.31,
        max: 387.95,
        basis: 'stage',
        source: 'Stein et al. 2020, Current Biology 30',
        url: 'https://doi.org/10.1016/j.cub.2019.11.067',
      },
      {
        label: 'Gilboa, New York (Givetian)',
        min: 382.31,
        max: 387.95,
        basis: 'stage',
        source: 'Stein et al. 2007, Nature 446',
        url: 'https://doi.org/10.1038/nature05705',
      },
    ],
  },
  {
    id: 'late-devonian-extinction',
    title: 'Late Devonian extinction',
    description: 'A major marine extinction that hits reefs hard.',
    kind: 'extinction',
    estimates: [
      {
        label: 'Frasnian–Famennian boundary',
        min: 371.69,
        max: 372.61,
        basis: 'stated',
        source: ICS,
        url: ICS_URL,
      },
    ],
  },
  {
    id: 'pangaea-assembled',
    title: 'Pangaea assembled',
    description: 'Nearly all the continents join into one supercontinent.',
    kind: 'continents',
    note: 'Assembly took tens of millions of years; there is no single date.',
    estimates: [
      {
        label: 'Conventional date',
        min: 330,
        max: 330,
        basis: 'stated',
        source: 'as summarised in Pastor-Galán 2022, Earth-Science Reviews 226',
        url: 'https://doi.org/10.1016/j.earscirev.2022.103918',
      },
      {
        label: 'Collisions continued until',
        min: 270,
        max: 320,
        basis: 'stated',
        source: 'Pastor-Galán 2022, Earth-Science Reviews 226',
        url: 'https://doi.org/10.1016/j.earscirev.2022.103918',
      },
    ],
  },
  {
    id: 'first-flowering-plants',
    title: 'First flowering plants',
    description:
      'Flowering plants appear. Unambiguous fossils are Early Cretaceous; other evidence points earlier.',
    kind: 'life',
    note: 'Molecular clocks date the common ancestor of living flowering plants; Triassic pollen may come from extinct relatives.',
    estimates: [
      {
        label: 'Molecular clock (range)',
        min: 149,
        max: 256,
        basis: 'stated',
        source: 'Barba-Montoya et al. 2018, New Phytologist 218',
        url: 'https://doi.org/10.1111/nph.15011',
      },
      {
        label: 'Flower-like pollen, Middle Triassic (contested)',
        min: 243,
        max: 243,
        basis: 'stated',
        source: 'Hochuli & Feist-Burkhardt 2013, Frontiers in Plant Science 4',
        url: 'https://doi.org/10.3389/fpls.2013.00344',
      },
      {
        label: 'Oldest widely accepted pollen (Valanginian–Hauterivian)',
        min: 132.5,
        max: 137.5,
        basis: 'stage',
        source: 'Hochuli & Feist-Burkhardt 2013, Frontiers in Plant Science 4',
        url: 'https://doi.org/10.3389/fpls.2013.00344',
      },
    ],
  },
  {
    id: 'end-permian-extinction',
    title: 'End-Permian mass extinction',
    description: 'The most severe extinction known: most marine and many land species vanish.',
    kind: 'extinction',
    estimates: [
      {
        label: 'Extinction, Meishan, China (uranium–lead dating)',
        min: 251.849,
        max: 251.978,
        basis: 'stated',
        source: 'Burgess, Bowring & Shen 2014, PNAS 111',
        url: 'https://doi.org/10.1073/pnas.1317692111',
      },
    ],
  },
  {
    id: 'first-dinosaurs',
    title: 'First dinosaurs',
    description: 'Early dinosaurs such as Eoraptor and Herrerasaurus appear in Argentina.',
    kind: 'life',
    note: 'Nyasasaurus, from Tanzania, may be a dinosaur or a close relative; its rocks have no radiometric date.',
    estimates: [
      {
        label: 'Possible older dinosaur, Nyasasaurus',
        min: 245,
        max: 245,
        basis: 'secondary',
        source: 'Nesbitt et al. 2013, Biology Letters 9; age from Bernardi et al. 2018',
        url: 'https://doi.org/10.1098/rsbl.2012.0949',
      },
      {
        label: 'Oldest undisputed, Ischigualasto (argon dating)',
        min: 231.1,
        max: 231.7,
        basis: 'secondary',
        source: 'Martínez et al. 2011, Science 331; age via Bernardi et al. 2018',
        url: 'https://doi.org/10.1126/science.1198467',
      },
    ],
  },
  {
    id: 'pangaea-breakup',
    title: 'Pangaea breaks up',
    description: 'Rifting splits Pangaea, and the Central Atlantic opens.',
    kind: 'continents',
    estimates: [
      {
        label: 'Rifting, to final break-up',
        min: 200,
        max: 240,
        basis: 'stated',
        source: 'Pastor-Galán 2022, Earth-Science Reviews 226',
        url: 'https://doi.org/10.1016/j.earscirev.2022.103918',
      },
      {
        label: 'New ocean floor begins, Central Atlantic',
        min: 190,
        max: 190,
        basis: 'stated',
        source: 'Labails et al. 2010, Earth and Planetary Science Letters 297',
        url: 'https://doi.org/10.1016/j.epsl.2010.06.024',
      },
    ],
  },
  {
    id: 'end-triassic-extinction',
    title: 'End-Triassic mass extinction',
    description: 'Vast eruptions in the Central Atlantic coincide with a major extinction.',
    kind: 'extinction',
    estimates: [
      {
        label: 'Extinction, by the eruptions’ uranium–lead dates',
        min: 201.564,
        max: 201.564,
        basis: 'secondary',
        source: 'Blackburn et al. 2013, Science 340',
        url: 'https://doi.org/10.1126/science.1234204',
      },
      {
        label: 'Triassic–Jurassic boundary',
        min: 201.2,
        max: 201.6,
        basis: 'stated',
        source: ICS,
        url: ICS_URL,
      },
    ],
  },
  {
    id: 'k-pg-extinction',
    title: 'End-Cretaceous extinction',
    description:
      'An asteroid strikes at Chicxulub; the non-bird dinosaurs and much other life die out.',
    kind: 'extinction',
    estimates: [
      {
        label: 'Ash at the boundary, Montana (argon dating)',
        min: 66.043,
        max: 66.043,
        basis: 'secondary',
        source: 'Renne et al. 2013, Science 339',
        url: 'https://doi.org/10.1126/science.1230492',
      },
      {
        label: 'Cretaceous–Paleogene boundary',
        min: 66,
        max: 66,
        basis: 'stated',
        source: ICS,
        url: ICS_URL,
      },
    ],
  },
  {
    id: 'india-asia-collision',
    title: 'India meets Asia',
    description: 'India’s collision with Asia begins raising the Himalaya and Tibet.',
    kind: 'continents',
    note: 'The camps partly define “collision” differently: first contact, continents meeting, or the last ocean closing. The latest view is a minority one, answered in print.',
    estimates: [
      {
        label: 'Early: sediment sources switch',
        min: 58,
        max: 60,
        basis: 'stated',
        source: 'Hu et al. 2015, Geology 43',
        url: 'https://doi.org/10.1130/G36872.1',
      },
      {
        label: 'Middle: last marine rocks, Asian sediment',
        min: 50.6,
        max: 52.8,
        basis: 'stated',
        source: 'Najman et al. 2010, Journal of Geophysical Research 115',
        url: 'https://doi.org/10.1029/2010JB007673',
      },
      {
        label: 'Late: continents meet; earlier event an island arc',
        min: 34,
        max: 34,
        basis: 'stated',
        source: 'Aitchison, Ali & Davis 2007, Journal of Geophysical Research 112',
        url: 'https://doi.org/10.1029/2006JB004706',
      },
    ],
  },
  {
    id: 'antarctic-ice',
    title: 'Antarctic ice sheet forms',
    description: 'Permanent ice grows on Antarctica in two quick steps as the climate cools.',
    kind: 'climate',
    note: 'Smaller, passing ice sheets came earlier.',
    estimates: [
      {
        label: 'Deep-sea records: two steps of ice growth',
        min: 33.9,
        max: 34,
        basis: 'stated',
        source: 'Coxall et al. 2005, Nature 433',
        url: 'https://doi.org/10.1038/nature03135',
      },
    ],
  },
  {
    id: 'panama-isthmus',
    title: 'Isthmus of Panama',
    description: 'A land bridge joins the Americas and parts the Atlantic from the Pacific.',
    kind: 'continents',
    note: 'A seaway closed to deep water is not yet a continuous land bridge; the camps date different things (see also Jaramillo et al. 2017, Science Advances).',
    estimates: [
      {
        label: 'Animals cross in waves (molecules and fossils)',
        min: 20,
        max: 20,
        basis: 'stated',
        source: 'Bacon et al. 2015, PNAS 112',
        url: 'https://doi.org/10.1073/pnas.1423853112',
      },
      {
        label: 'Seaway closed, middle Miocene (river sediments)',
        min: 11.63,
        max: 15.98,
        basis: 'stage',
        source: 'Montes et al. 2015, Science 348',
        url: 'https://doi.org/10.1126/science.aaa2815',
      },
      {
        label: 'Land bridge complete',
        min: 2.8,
        max: 2.8,
        basis: 'stated',
        source: 'O’Dea et al. 2016, Science Advances 2',
        url: 'https://doi.org/10.1126/sciadv.1600883',
      },
    ],
  },
  {
    id: 'homo-sapiens',
    title: 'Earliest Homo sapiens',
    description: 'Fossils from Morocco and Ethiopia show early members of our species in Africa.',
    kind: 'humans',
    note: 'The oldest of these are often described as early members of our lineage rather than fully modern humans.',
    estimates: [
      {
        label: 'Jebel Irhoud, Morocco',
        min: 0.281,
        max: 0.349,
        basis: 'stated',
        source: 'Hublin et al. 2017, Nature 546',
        url: 'https://doi.org/10.1038/nature22336',
      },
      {
        label: 'Omo I, Ethiopia (minimum age)',
        min: 0.211,
        max: 0.255,
        basis: 'secondary',
        source: 'Vidal et al. 2022, Nature 601',
        url: 'https://doi.org/10.1038/s41586-021-04275-8',
      },
    ],
  },
];

/**
 * Where a milestone sits on the time line: the oldest edge of any estimate, where the earliest
 * proposal comes in. Playing on from there passes every other one, so none is favoured.
 */
export function anchorMa(milestone: Milestone): number {
  return Math.max(...milestone.estimates.map(({ max }) => max));
}

/** Milestones with an estimate within `reach` Ma of `ma`, oldest first. */
export function milestonesNear(ma: number, reach: number): readonly Milestone[] {
  return MILESTONES.filter(({ estimates }) =>
    estimates.some(({ min, max }) => ma >= min - reach && ma <= max + reach),
  );
}

/**
 * A milestone this close to `ma` is the one the view stands on, not the next: a link rounded
 * to a tenth of a million years (as older links were) still lands on it.
 */
export const STANDING_MA = 0.05;

/** The next milestone towards the present (direction −1) or the past (+1) from `ma`. */
export function nextMilestone(ma: number, direction: 1 | -1): Milestone | null {
  return direction < 0
    ? (MILESTONES.find((milestone) => anchorMa(milestone) < ma - STANDING_MA) ?? null)
    : (MILESTONES.findLast((milestone) => anchorMa(milestone) > ma + STANDING_MA) ?? null);
}
