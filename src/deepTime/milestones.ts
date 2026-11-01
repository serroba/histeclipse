/**
 * Milestones of Earth's history, from the Solar System's first solids to our species. Where the literature disagrees, each position is
 * an estimate of its own, with its source and the evidence it rests on; none is chosen over
 * the others. Ages are ranges (min to max, Ma); a point has min equal to max.
 *
 * `basis` says how firm the numbers are:
 * - `stated`: the source gives the number;
 * - `stage`: the source names a geological stage, and the range is that stage's on the ICS
 *   chart v2026/06;
 * - `secondary`: the number is the source's, as quoted by a later paper.
 */

export type MilestoneKind = 'cosmos' | 'life' | 'extinction' | 'continents' | 'climate' | 'humans';
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
    id: 'solar-system-formation',
    title: 'The Solar System forms',
    description:
      "The first solids condense around the young Sun: grains in meteorites set the Solar System's time zero.",
    kind: 'cosmos',
    note: "Ages depend on each sample's uranium isotopes; allowing for them moved the oldest dates by about a million years.",
    estimates: [
      {
        label: 'Oldest solids (lead dating of meteorite inclusions)',
        min: 4567.14,
        max: 4567.46,
        basis: 'stated',
        source: 'Connelly et al. 2012, Science 338',
        url: 'https://doi.org/10.1126/science.1226919',
      },
      {
        label: 'Allende meteorite inclusion, uranium-corrected',
        min: 4566.68,
        max: 4567.68,
        basis: 'secondary',
        source: 'Amelin et al. 2010, Earth and Planetary Science Letters 300',
        url: 'https://doi.org/10.1016/j.epsl.2010.10.015',
      },
    ],
  },
  {
    id: 'moon-forming-impact',
    title: 'The Moon forms',
    description:
      'A Mars-sized body, Theia, strikes the young Earth; the debris gathers into the Moon. Its age is disputed by about 160 million years.',
    kind: 'cosmos',
    note: 'The camps date different things: the first lunar crust, the end of the magma ocean, or later remelting.',
    estimates: [
      {
        label: 'Early: Apollo 14 zircons',
        min: 4510,
        max: 4510,
        basis: 'stated',
        source: 'Barboni et al. 2017, Science Advances 3',
        url: 'https://doi.org/10.1126/sciadv.1602365',
      },
      {
        label: 'Old, the young dates read as remelting by tides',
        min: 4350,
        max: 4510,
        basis: 'stated',
        source: 'Nimmo, Kleine & Morbidelli 2024, Nature 636',
        url: 'https://doi.org/10.1038/s41586-024-08231-0',
      },
      {
        label: 'Intermediate: a long-lived magma ocean',
        min: 4400,
        max: 4450,
        basis: 'stated',
        source: 'Maurice et al. 2020, Science Advances 6',
        url: 'https://doi.org/10.1126/sciadv.aba8949',
      },
      {
        label: 'Young: the oldest lunar crust rock',
        min: 4357,
        max: 4363,
        basis: 'stated',
        source: 'Borg et al. 2011, Nature 477',
        url: 'https://doi.org/10.1038/nature10328',
      },
      {
        label: 'Young: the cluster of lunar ages',
        min: 4350,
        max: 4350,
        basis: 'stated',
        source: 'Borg & Carlson 2023, Annual Review of Earth and Planetary Sciences 51',
        url: 'https://doi.org/10.1146/annurev-earth-031621-060538',
      },
    ],
  },
  {
    id: 'oldest-earth-minerals',
    title: 'Oldest pieces of Earth',
    description:
      'Zircon crystals from Jack Hills, Western Australia, recycled into younger rocks, are the oldest known bits of Earth.',
    kind: 'continents',
    estimates: [
      {
        label: 'Jack Hills zircon',
        min: 4396,
        max: 4412,
        basis: 'stated',
        source: 'Wilde et al. 2001, Nature 409',
        url: 'https://doi.org/10.1038/35051550',
      },
      {
        label: 'Jack Hills zircon, age confirmed by atom-probe',
        min: 4400,
        max: 4400,
        basis: 'stated',
        source: 'Valley et al. 2014, Nature Geoscience 7',
        url: 'https://doi.org/10.1038/ngeo2075',
      },
    ],
  },
  {
    id: 'oldest-rocks',
    title: 'Oldest rocks',
    description:
      'The Acasta Gneiss of northern Canada is the oldest firmly dated rock; Nuvvuagittuq in Quebec may be older, but that is disputed.',
    kind: 'continents',
    note: 'Acasta is dated by its zircons crystallising; the Nuvvuagittuq age comes from neodymium isotopes, which critics read as dating its source, not the rock.',
    estimates: [
      {
        label: 'Disputed: Nuvvuagittuq amphibolite',
        min: 4199,
        max: 4333,
        basis: 'stated',
        source: "O'Neil et al. 2008, Science 321",
        url: 'https://doi.org/10.1126/science.1161925',
      },
      {
        label: 'Acasta Gneiss',
        min: 4028,
        max: 4034,
        basis: 'stated',
        source: 'Bowring & Williams 1999, Contributions to Mineralogy and Petrology 134',
        url: 'https://doi.org/10.1007/s004100050465',
      },
    ],
  },
  {
    id: 'earliest-life',
    title: 'Earliest life',
    description:
      'Claims of the first life range from contested Hadean traces to widely accepted 3.43-billion-year-old stromatolite reefs.',
    kind: 'life',
    note: 'Fossils and traces give the least age life can have; molecular clocks date the last common ancestor of all life (LUCA), which may predate every surviving rock.',
    estimates: [
      {
        label: 'Molecular clock: LUCA',
        min: 4090,
        max: 4330,
        basis: 'stated',
        source: 'Moody et al. 2024, Nature Ecology & Evolution 8',
        url: 'https://doi.org/10.1038/s41559-024-02461-1',
      },
      {
        label: 'Contested: tubes in vent rocks, Nuvvuagittuq',
        min: 3770,
        max: 4280,
        basis: 'stated',
        source: 'Dodd et al. 2017, Nature 543',
        url: 'https://doi.org/10.1038/nature21377',
      },
      {
        label: 'Molecular clock: LUCA older than',
        min: 3900,
        max: 3900,
        basis: 'stated',
        source: 'Betts et al. 2018, Nature Ecology & Evolution 2',
        url: 'https://doi.org/10.1038/s41559-018-0644-x',
      },
      {
        label: 'Contested: Isua stromatolites, Greenland',
        min: 3700,
        max: 3700,
        basis: 'stated',
        source: 'Nutman et al. 2016, Nature 537',
        url: 'https://doi.org/10.1038/nature19355',
      },
      {
        label: 'Rebuttal: the Isua structures are folds in the rock',
        min: 3700,
        max: 3700,
        basis: 'stated',
        source: 'Allwood et al. 2018, Nature 563',
        url: 'https://doi.org/10.1038/s41586-018-0610-4',
      },
      {
        label: 'Dresser Formation, Australia',
        min: 3480,
        max: 3480,
        basis: 'secondary',
        source: 'as cited in Nutman et al. 2016, Nature 537',
        url: 'https://doi.org/10.1038/nature19355',
      },
      {
        label: 'Widely accepted: Strelley Pool stromatolite reef',
        min: 3430,
        max: 3430,
        basis: 'stated',
        source: 'Allwood et al. 2006, Nature 441',
        url: 'https://doi.org/10.1038/nature04764',
      },
    ],
  },
  {
    id: 'earliest-water',
    title: 'Earliest sign of liquid water',
    description:
      'Heavy oxygen in Hadean zircons suggests their magmas melted crust that had met liquid water at the surface.',
    kind: 'climate',
    note: 'Indirect: read from zircons’ oxygen, not from preserved sediments. The oldest Jack Hills zircon, about 4,404 million years old, already carries it (Wilde et al. 2001).',
    estimates: [
      {
        label: 'Water at the surface by',
        min: 4300,
        max: 4300,
        basis: 'stated',
        source: 'Mojzsis, Harrison & Pidgeon 2001, Nature 409',
        url: 'https://doi.org/10.1038/35051557',
      },
    ],
  },
  {
    id: 'late-heavy-bombardment',
    title: 'Late Heavy Bombardment',
    description:
      'A proposed surge of impacts on the Moon and Earth about 3.9 billion years ago. Whether there was a surge at all is debated.',
    kind: 'cosmos',
    note: 'Three positions: a short cataclysm; a longer, hybrid bombardment; or a smooth decline, the surge an artefact of how the rocks were dated.',
    estimates: [
      {
        label: 'Hybrid: raised impact rate',
        min: 3500,
        max: 4200,
        basis: 'stated',
        source: 'Bottke & Norman 2017, Annual Review of Earth and Planetary Sciences 45',
        url: 'https://doi.org/10.1146/annurev-earth-063016-020131',
      },
      {
        label: 'Classic: a lunar cataclysm',
        min: 3850,
        max: 4000,
        basis: 'stated',
        source: 'Tera, Papanastassiou & Wasserburg 1974, Earth and Planetary Science Letters 22',
        url: 'https://doi.org/10.1016/0012-821X(74)90059-4',
      },
      {
        label: 'Artefact: the peak may be illusory',
        min: 3900,
        max: 3900,
        basis: 'stated',
        source: 'Boehnke & Harrison 2016, PNAS 113',
        url: 'https://doi.org/10.1073/pnas.1611535113',
      },
    ],
  },
  {
    id: 'first-eukaryotes',
    title: 'First complex cells',
    description:
      'Cells with nuclei (eukaryotes) appear as fossils by about 1.7 to 1.6 billion years ago; an older chemical claim was traced to contamination.',
    kind: 'life',
    note: "Fossils give the least age; molecular clocks the group's origin; chemical traces can be contaminants. The 2.7-billion-year claim was rebutted, not retracted.",
    estimates: [
      {
        label: 'Claimed: chemical traces in 2.7-billion-year-old rocks',
        min: 2700,
        max: 2700,
        basis: 'stated',
        source: 'Brocks et al. 1999, Science 285',
        url: 'https://doi.org/10.1126/science.285.5430.1033',
      },
      {
        label: 'Rebuttal: the traces came in after 2.2 billion years ago, or later still',
        min: 2200,
        max: 2200,
        basis: 'stated',
        source: 'Rasmussen et al. 2008, Nature 455; French et al. 2015, PNAS 112',
        url: 'https://doi.org/10.1073/pnas.1419563112',
      },
      {
        label: 'Molecular clock: modern eukaryotes younger than',
        min: 1840,
        max: 1840,
        basis: 'stated',
        source: 'Betts et al. 2018, Nature Ecology & Evolution 2',
        url: 'https://doi.org/10.1038/s41559-018-0644-x',
      },
      {
        label: 'Oldest eukaryote fossils',
        min: 1680,
        max: 1780,
        basis: 'stated',
        source: 'Rasmussen et al. 2008, Nature 455',
        url: 'https://doi.org/10.1038/nature07381',
      },
      {
        label: 'Many-celled eukaryotes, North China',
        min: 1635,
        max: 1635,
        basis: 'stated',
        source: 'Miao et al. 2024, Science Advances 10',
        url: 'https://doi.org/10.1126/sciadv.adk3208',
      },
      {
        label: 'Diverse eukaryotes, Roper Group, Australia',
        min: 1500,
        max: 1500,
        basis: 'stated',
        source: 'Javaux, Knoll & Walter 2001, Nature 412',
        url: 'https://doi.org/10.1038/35083562',
      },
    ],
  },
  {
    id: 'great-oxidation',
    title: 'Great Oxidation Event',
    description:
      'Oxygen first builds up in the air, in fits and starts over some 200 million years rather than in one step.',
    kind: 'climate',
    note: 'Camps mean different things by it: the first rise of oxygen (about 2.43 billion years ago), or the point after which it stayed (2.32 or 2.22). Earlier “whiffs” are contested.',
    estimates: [
      {
        label: 'Contested whiff: Mount McRae Shale',
        min: 2493,
        max: 2509,
        basis: 'stated',
        source: 'Anbar et al. 2007, Science 317',
        url: 'https://doi.org/10.1126/science.1140325',
      },
      {
        label: 'Whiff disputed: the signal came in later',
        min: 2500,
        max: 2500,
        basis: 'stated',
        source: 'Slotznick et al. 2022, Science Advances 8',
        url: 'https://doi.org/10.1126/sciadv.abj7190',
      },
      {
        label: 'Onset',
        min: 2426,
        max: 2460,
        basis: 'stated',
        source: 'Gumsley et al. 2017, PNAS 114',
        url: 'https://doi.org/10.1073/pnas.1608824114',
      },
      {
        label: 'Swings end',
        min: 2240,
        max: 2250,
        basis: 'stated',
        source: 'Gumsley et al. 2017, PNAS 114',
        url: 'https://doi.org/10.1073/pnas.1608824114',
      },
      {
        label: 'Oxygen here to stay',
        min: 2220,
        max: 2220,
        basis: 'stated',
        source: 'Poulton et al. 2021, Nature 592',
        url: 'https://doi.org/10.1038/s41586-021-03393-7',
      },
    ],
  },
  {
    id: 'huronian-glaciations',
    title: 'Huronian ice ages',
    description: "Three ice ages recorded in Ontario's rocks, around the time oxygen first rose.",
    kind: 'climate',
    note: "Loosely bracketed by the rocks below and above; matching them with South Africa's glaciations changed when the Ongeluk lavas were redated.",
    estimates: [
      {
        label: 'Older than: basal Huronian volcanics',
        min: 2446,
        max: 2473,
        basis: 'secondary',
        source: 'as cited in Hilburn et al. 2005, Earth and Planetary Science Letters 232',
        url: 'https://doi.org/10.1016/j.epsl.2004.11.025',
      },
      {
        label: 'First global ice age of the time',
        min: 2426,
        max: 2460,
        basis: 'stated',
        source: 'Gumsley et al. 2017, PNAS 114',
        url: 'https://doi.org/10.1073/pnas.1608824114',
      },
      {
        label: 'Younger than: Nipissing diabase',
        min: 2215,
        max: 2223,
        basis: 'secondary',
        source: 'as cited in Hilburn et al. 2005, Earth and Planetary Science Letters 232',
        url: 'https://doi.org/10.1016/j.epsl.2004.11.025',
      },
    ],
  },
  {
    id: 'columbia-nuna',
    title: 'Supercontinent Columbia (Nuna)',
    description:
      'An early supercontinent, stitched together by collisions about 2.1 to 1.8 billion years ago and broken up gradually.',
    kind: 'continents',
    note: 'Columbia and Nuna are partly competing reconstructions, which differ in how the cratons fit, not just two names.',
    estimates: [
      {
        label: 'Assembled (2.1–1.8 billion-year collision belts)',
        min: 1800,
        max: 2100,
        basis: 'stated',
        source: 'Zhao et al. 2002, Earth-Science Reviews 59',
        url: 'https://doi.org/10.1016/S0012-8252(02)00073-9',
      },
      {
        label: "Nuna's core reconstruction",
        min: 1300,
        max: 1900,
        basis: 'stated',
        source: 'Evans & Mitchell 2011, Geology 39',
        url: 'https://doi.org/10.1130/G31654.1',
      },
      {
        label: 'Broke up',
        min: 1200,
        max: 1600,
        basis: 'stated',
        source: 'Zhao et al. 2002, Earth-Science Reviews 59',
        url: 'https://doi.org/10.1016/S0012-8252(02)00073-9',
      },
    ],
  },
  {
    id: 'rodinia',
    title: 'Supercontinent Rodinia',
    description:
      'A supercontinent assembled about 1.3 to 0.9 billion years ago that began to rift apart about 750 million years ago.',
    kind: 'continents',
    note: 'Its layout is still debated: a consensus model (Li et al. 2008) and a different, long-lived fit (Evans 2009).',
    estimates: [
      {
        label: 'Assembled',
        min: 900,
        max: 1300,
        basis: 'stated',
        source: 'Li et al. 2008, Precambrian Research 160',
        url: 'https://doi.org/10.1016/j.precamres.2007.04.021',
      },
      {
        label: 'Long-lived alternative: rifting',
        min: 700,
        max: 800,
        basis: 'stated',
        source: 'Evans 2009, Geological Society Special Publications 327',
        url: 'https://doi.org/10.1144/SP327.16',
      },
      {
        label: 'Broke up (first rifts about 750 million years ago)',
        min: 600,
        max: 750,
        basis: 'stated',
        source: 'Li et al. 2008, Precambrian Research 160',
        url: 'https://doi.org/10.1016/j.precamres.2007.04.021',
      },
    ],
  },
  {
    id: 'snowball-earth',
    title: 'Snowball Earth',
    description:
      'Two long ice ages, the Sturtian and Marinoan, when glaciers reached the sea near the equator.',
    kind: 'climate',
    note: 'A “hard snowball”, the ocean frozen over, against a “slushball” with open water near the equator.',
    estimates: [
      {
        label: 'Slushball: open tropical water in a coupled model',
        min: 600,
        max: 800,
        basis: 'stated',
        source: 'Hyde et al. 2000, Nature 405',
        url: 'https://doi.org/10.1038/35013005',
      },
      {
        label: 'Sturtian glaciation',
        min: 658.5,
        max: 717.5,
        basis: 'stated',
        source: 'Hoffman et al. 2017, Science Advances 3',
        url: 'https://doi.org/10.1126/sciadv.1600983',
      },
      {
        label: 'Marinoan glaciation',
        min: 634.7,
        max: 649.9,
        basis: 'stated',
        source: 'Hoffman et al. 2017, Science Advances 3',
        url: 'https://doi.org/10.1126/sciadv.1600983',
      },
    ],
  },
  {
    id: 'ediacaran-biota',
    title: 'First large complex life',
    description:
      'A brief ice age about 580 million years ago, followed within some 10 million years by the oldest large, complex fossils.',
    kind: 'life',
    note: 'The Gaskiers ice age was short, under 340,000 years where measured: not a snowball.',
    estimates: [
      {
        label: 'Gaskiers glaciation',
        min: 579.88,
        max: 580.9,
        basis: 'stated',
        source: 'Pu et al. 2016, Geology 44',
        url: 'https://doi.org/10.1130/G38284.1',
      },
      {
        label: 'Oldest complex large fossils, Mistaken Point',
        min: 573.51,
        max: 574.83,
        basis: 'stated',
        source: 'Matthews et al. 2021, GSA Bulletin 133',
        url: 'https://doi.org/10.1130/B35646.1',
      },
    ],
  },
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

/**
 * The next milestone towards the present (direction −1) or the past (+1) from `ma`, among
 * those no older than `oldest` (the span the bar shows).
 */
export function nextMilestone(ma: number, direction: 1 | -1, oldest = Infinity): Milestone | null {
  const shown = MILESTONES.filter((milestone) => anchorMa(milestone) <= oldest);
  return direction < 0
    ? (shown.find((milestone) => anchorMa(milestone) < ma - STANDING_MA) ?? null)
    : (shown.findLast((milestone) => anchorMa(milestone) > ma + STANDING_MA) ?? null);
}
