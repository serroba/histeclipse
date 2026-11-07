/**
 * Where everything on screen comes from: each source once (who made it, where to find it, under
 * what licence), and for each thing the reader can see, a "why": what it shows, which sources it
 * rests on, and how this site used them. The "Why this?" marks and the Sources panel read these.
 *
 * Plain data; the checks that every layer has its why are in registry.test.ts.
 */

import type { BorderSource, Layer, Span } from '../state/viewState';

/** What kind of thing a source is, each shown with its own icon. */
export type SourceKind = 'paper' | 'dataset' | 'model' | 'imagery' | 'catalogue';

export interface Source {
  /** The name a link reads as. */
  readonly name: string;
  readonly kind: SourceKind;
  /** The full reference: authors, year, venue, version. */
  readonly cite: string;
  readonly url: string;
  /** As its maker states it; omitted when none is stated. */
  readonly licence?: string;
  /** Non-commercial terms: shown with a warning, since they bind what the site may do. */
  readonly nonCommercial?: true;
}

export const SOURCES = {
  blueMarble: {
    name: 'NASA Blue Marble',
    kind: 'imagery',
    cite: 'NASA Earth Observatory, Blue Marble: Next Generation (Stöckli et al. 2005)',
    url: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/',
    licence: 'NASA, public domain',
  },
  de441: {
    name: 'JPL DE441',
    kind: 'model',
    cite: 'Park, Folkner, Williams & Boggs (2021), The JPL Planetary and Lunar Ephemerides DE440 and DE441, Astronomical Journal 161, 105',
    url: 'https://doi.org/10.3847/1538-3881/abd414',
    licence: 'NASA/JPL, public domain',
  },
  skyfield: {
    name: 'Skyfield',
    kind: 'model',
    cite: 'Rhodes, Skyfield: high precision research-grade positions for planets and Earth satellites',
    url: 'https://rhodesmill.org/skyfield/',
    licence: 'MIT',
  },
  deltaTSplines: {
    name: 'Morrison et al. 2021',
    kind: 'paper',
    cite: 'Morrison, Stephenson, Hohenkerk & Zawilski (2021), Addendum 2020 to "Measurement of the Earth’s rotation: 720 BC to AD 2015", Proceedings of the Royal Society A 477',
    url: 'https://doi.org/10.1098/rspa.2020.0776',
  },
  deltaTLongTerm: {
    name: 'Stephenson et al. 2016',
    kind: 'paper',
    cite: 'Stephenson, Morrison & Hohenkerk (2016), Measurement of the Earth’s rotation: 720 BC to AD 2015, Proceedings of the Royal Society A 472',
    url: 'https://doi.org/10.1098/rspa.2016.0404',
  },
  vsop87: {
    name: 'VSOP87',
    kind: 'model',
    cite: 'Bretagnon & Francou (1988), Planetary theories in rectangular and spherical variables: VSOP87 solutions, Astronomy & Astrophysics 202, 309; via the astronomia library (MIT)',
    url: 'https://ui.adsabs.harvard.edu/abs/1988A&A...202..309B',
  },
  meeus: {
    name: 'Meeus, Astronomical Algorithms',
    kind: 'paper',
    cite: 'Meeus (1998), Astronomical Algorithms, 2nd edition, Willmann-Bell: the Sun (ch. 25), nutation (ch. 22) and sidereal time (ch. 12)',
    url: 'https://search.worldcat.org/search?q=Meeus+Astronomical+Algorithms+2nd+edition',
  },
  elpmpp02: {
    name: 'ELP/MPP02',
    kind: 'model',
    cite: 'Chapront & Francou (2003), The lunar theory ELP revisited, Astronomy & Astrophysics 404, 735; via the astronomia library (MIT)',
    url: 'https://doi.org/10.1051/0004-6361:20030529',
  },
  vondrak: {
    name: 'Vondrák et al. 2011',
    kind: 'paper',
    cite: 'Vondrák, Capitaine & Wallace (2011), New precession expressions, valid for long time intervals, Astronomy & Astrophysics 534, A22',
    url: 'https://doi.org/10.1051/0004-6361/201117274',
  },
  sdo: {
    name: 'NASA SDO',
    kind: 'imagery',
    cite: 'NASA Solar Dynamics Observatory, AIA and HMI science teams, images of 2024 via Helioviewer',
    url: 'https://sdo.gsfc.nasa.gov/',
    licence: 'NASA, public domain',
  },
  helioviewer: {
    name: 'Helioviewer',
    kind: 'imagery',
    cite: 'Helioviewer Project (ESA and NASA)',
    url: 'https://helioviewer.org/',
  },
  hipparcos: {
    name: 'Hipparcos',
    kind: 'catalogue',
    cite: 'The Hipparcos main catalogue (ESA 1997; Perryman et al.), via NASA’s HEASARC',
    url: 'https://heasarc.gsfc.nasa.gov/W3Browse/all/hipparcos.html',
  },
  cliopatria: {
    name: 'Cliopatria',
    kind: 'dataset',
    cite: 'Cliopatria v0.2.1, Seshat Global History Databank',
    url: 'https://github.com/Seshat-Global-History-Databank/cliopatria',
    licence: 'CC BY 4.0',
  },
  ohm: {
    name: 'OpenHistoricalMap',
    kind: 'dataset',
    cite: '© OpenHistoricalMap contributors, vector tiles at zoom 2, fetched 2026-11-01',
    url: 'https://www.openhistoricalmap.org/copyright',
    licence: 'CC0',
  },
  archaeoglobe: {
    name: 'ArchaeoGLOBE',
    kind: 'dataset',
    cite: 'ArchaeoGLOBE Project (2019), Archaeological assessment reveals Earth’s early transformation through land use, Science 365, 897; Harvard Dataverse',
    url: 'https://doi.org/10.1126/science.aax1192',
    licence: 'CC0 1.0',
  },
  periodo: {
    name: 'PeriodO',
    kind: 'dataset',
    cite: 'PeriodO, a gazetteer of period definitions, matched to countries by Wikidata identifiers',
    url: 'https://perio.do',
    licence: 'CC0',
  },
  naturalEarth: {
    name: 'Natural Earth',
    kind: 'dataset',
    cite: 'Natural Earth 1:110m country outlines',
    url: 'https://www.naturalearthdata.com',
    licence: 'Public domain',
  },
  aadr: {
    name: 'Allen Ancient DNA Resource',
    kind: 'dataset',
    cite: 'Allen Ancient DNA Resource v66.p1 (Mallick et al. 2024, Scientific Data 11, 182; Reich lab)',
    url: 'https://doi.org/10.7910/DVN/FFIDCW',
    licence: 'CC0 1.0',
  },
  macrostrat: {
    name: 'Macrostrat',
    kind: 'dataset',
    cite: 'Macrostrat (Peters et al.), world geologic map units',
    url: 'https://macrostrat.org',
    licence: 'CC BY 4.0',
  },
  impactEarth: {
    name: 'Impact Earth Database',
    kind: 'catalogue',
    cite: 'Impact Earth Database, Western University (Osinski et al. 2022, Earth-Science Reviews 232, 104112)',
    url: 'https://impact.uwo.ca',
  },
  gplates: {
    name: 'GPlates Web Service',
    kind: 'model',
    cite: 'GPlates Web Service (EarthByte), reconstructing places on the PALEOMAP model',
    url: 'https://gws.gplates.org',
  },
  gvp: {
    name: 'Global Volcanism Program',
    kind: 'catalogue',
    cite: 'Global Volcanism Program, Smithsonian Institution: Volcanoes of the World, Holocene volcanoes and eruptions',
    url: 'https://volcano.si.edu',
    licence: 'Non-commercial use with credit',
    nonCommercial: true,
  },
  paleodem: {
    name: 'PALEOMAP PaleoDEMs',
    kind: 'model',
    cite: 'Scotese & Wright (2018), PALEOMAP Paleodigital Elevation Models (PaleoDEMS) for the Phanerozoic',
    url: 'https://doi.org/10.5281/zenodo.5460860',
    licence: 'CC BY 4.0',
  },
  scotese2022: {
    name: 'Scotese 2022',
    kind: 'model',
    cite: 'Scotese (2022), Global Mean Surface Temperatures for 100 Phanerozoic Time Intervals, after Scotese et al. (2021) and Valdes, Scotese & Lunt (2021)',
    url: 'https://doi.org/10.5281/zenodo.5718392',
    licence: 'CC BY 4.0',
  },
  cesm: {
    name: 'CESM, Li et al. 2023',
    kind: 'model',
    cite: 'Li, Hu et al. (2023), Paleoceanography and Paleoclimatology 38, CESM1.2.2 runs',
    url: 'https://doi.org/10.5281/zenodo.7322003',
    licence: 'CC BY 4.0',
  },
  ics: {
    name: 'ICS chart v2026/06',
    kind: 'paper',
    cite: 'International Chronostratigraphic Chart v2026-06, International Commission on Stratigraphy (Cohen et al. 2025, Episodes 48, 105–115)',
    url: 'https://stratigraphy.org/chart',
    licence: 'CC BY 4.0',
  },
  paleomist: {
    name: 'PaleoMIST 1.0',
    kind: 'model',
    cite: 'Gowan et al. (2021), A new global ice sheet reconstruction for the past 80 000 years, Nature Communications 12, 1199; PANGAEA',
    url: 'https://doi.org/10.1594/PANGAEA.905800',
    licence: 'CC BY 4.0',
  },
  batchelor: {
    name: 'Batchelor et al. 2019',
    kind: 'paper',
    cite: 'Batchelor et al. (2019), The configuration of Northern Hemisphere ice sheets through the Quaternary, Nature Communications 10, 3713; shapefiles on OSF',
    url: 'https://osf.io/7jen3/',
    licence: 'No licence stated',
  },
  etopo1: {
    name: 'ETOPO1',
    kind: 'dataset',
    cite: 'ETOPO1 global relief (Amante & Eakins 2009, NOAA NGDC), via NOAA ERDDAP',
    url: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
    licence: 'NOAA, public domain',
  },
  bintanja: {
    name: 'Bintanja & van de Wal 2008',
    kind: 'paper',
    cite: 'Bintanja & van de Wal (2008), Nature 454; NOAA World Data Service',
    url: 'https://doi.org/10.1038/nature07158',
  },
  spratt: {
    name: 'Spratt & Lisiecki 2016',
    kind: 'paper',
    cite: 'Spratt & Lisiecki (2016), A Late Pleistocene sea level stack, Climate of the Past 12; NOAA World Data Service',
    url: 'https://doi.org/10.5194/cp-12-1079-2016',
  },
  miller: {
    name: 'Miller et al. 2020',
    kind: 'paper',
    cite: 'Miller et al. (2020), Cenozoic sea-level and cryospheric evolution, Science Advances 6; PANGAEA',
    url: 'https://doi.org/10.1594/PANGAEA.923139',
    licence: 'CC BY 4.0',
  },
  vanDerMeer: {
    name: 'van der Meer et al. 2022',
    kind: 'paper',
    cite: 'van der Meer et al. (2022), Gondwana Research 111, Supplementary Table 1',
    url: 'https://doi.org/10.1016/j.gr.2022.07.014',
    licence: 'CC BY 4.0',
  },
  cao2024: {
    name: 'Cao et al. 2024',
    kind: 'model',
    cite: 'Cao et al. (2024), a 1.8 Ga plate model, Geoscience Frontiers 15, 101922; Zenodo',
    url: 'https://doi.org/10.5281/zenodo.13628813',
    licence: 'CC BY 4.0',
  },
  humanFinds: {
    name: 'The site’s list of finds',
    kind: 'dataset',
    cite: 'Dated finds of our species and its relatives, each with the paper that dates it, and rival dates side by side; compiled for this site',
    url: 'https://github.com/serroba/histeclipse/blob/main/public/data/humans/claims.json',
  },
  timmermann: {
    name: 'Timmermann & Friedrich 2016',
    kind: 'model',
    cite: 'Timmermann & Friedrich (2016), Late Pleistocene climate drivers of early human migration, Nature 538, 92; ICCP climate data server',
    url: 'https://climatedata.ibs.re.kr/data/human-dispersal-simulation/arrival-time',
    licence: 'CC BY-NC 4.0',
    nonCommercial: true,
  },
  bereiter: {
    name: 'Bereiter et al. 2015',
    kind: 'paper',
    cite: 'Bereiter et al. (2015), Antarctic CO₂ composite (EPICA Dome C, Lüthi et al. 2008), Geophysical Research Letters; NOAA WDC Paleoclimatology',
    url: 'https://doi.org/10.1002/2014GL061957',
  },
  loulergue: {
    name: 'Loulergue et al. 2008',
    kind: 'paper',
    cite: 'Loulergue et al. (2008), methane from EPICA Dome C, Nature 453; NOAA WDC Paleoclimatology',
    url: 'https://doi.org/10.1038/nature06950',
  },
  foster: {
    name: 'Foster, Royer & Lunt 2017',
    kind: 'paper',
    cite: 'Foster, Royer & Lunt (2017), Future climate forcing potentially without precedent in the last 420 million years, Nature Communications 8, 14845',
    url: 'https://doi.org/10.1038/ncomms14845',
    licence: 'CC BY 4.0',
  },
  mills: {
    name: 'Mills et al. 2023',
    kind: 'paper',
    cite: 'Mills, Krause, Jarvis & Cramer (2023), Annual Review of Earth and Planetary Sciences 51, 253–276; the data of their Figure 6',
    url: 'https://doi.org/10.1146/annurev-earth-032320-095425',
    licence: 'CC BY 4.0',
  },
  co2pip: {
    name: 'Paleo-CO₂ Data Archive',
    kind: 'dataset',
    cite: 'Paleo-CO₂ Data Archive v1.12 (CO2PIP community; CenCO2PIP Consortium 2023, Science), Zenodo',
    url: 'https://doi.org/10.5281/zenodo.15546408',
    licence: 'CC BY 4.0',
  },
  pbdb: {
    name: 'Paleobiology Database',
    kind: 'dataset',
    cite: 'The Paleobiology Database, fossil occurrences of four groups of animals',
    url: 'https://paleobiodb.org',
    licence: 'CC BY 4.0',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

/** What a thing on screen shows, what it rests on, and how this site made it. */
export interface Why {
  readonly title: string;
  readonly what: string;
  readonly sources: readonly SourceId[];
  /** What this site did with them: simplified, packed, interpolated… */
  readonly how?: string;
  /** Where sources disagree, and how to see the others. */
  readonly others?: string;
}

export const WHYS = {
  earth: {
    title: 'Earth today',
    what: 'The planet as satellites see it now: land, sea and cloudless colour.',
    sources: ['blueMarble'],
    how: 'Today’s imagery, whatever the date shown: the ancient Earth’s own colours are not known.',
  },
  bodies: {
    title: 'Sun, Moon and planets',
    what: 'Where the Sun, the Moon and the planets were at the moment shown, and the day and night they make.',
    sources: ['meeus', 'elpmpp02', 'de441', 'vsop87', 'deltaTSplines', 'deltaTLongTerm'],
    how: 'Worked out in your browser: the Sun by Meeus’s formulas and the Moon by ELP/MPP02, both checked against JPL DE441 (the Moon’s mean motion refitted to it); the planets by VSOP87. Clock time is turned into Earth’s turning by ΔT, whose uncertainty grows the further back the date.',
  },
  eclipses: {
    title: 'Eclipses',
    what: 'The year’s eclipses, their times and magnitudes, and the Moon’s shadow on Earth.',
    sources: ['de441', 'skyfield', 'deltaTSplines', 'deltaTLongTerm'],
    how: 'Computed for this site from JPL DE441 with Skyfield. Where on Earth an eclipse was seen depends on ΔT, which is uncertain by minutes to hours in antiquity: the paths shift east or west with it.',
  },
  sun: {
    title: 'The Sun close up',
    what: 'The Sun’s surface in the light picked.',
    sources: ['sdo', 'helioviewer'],
    how: 'Images of 2024, days apart, stitched into one surface: the Sun of the date shown looked different, in ways unknown.',
  },
  sky: {
    title: 'The night sky',
    what: 'The stars as seen from the place picked, at the moment shown.',
    sources: ['hipparcos', 'vondrak', 'meeus', 'elpmpp02', 'vsop87'],
    how: 'Each star carried back along its own motion through space, and the sky turned by precession to the date shown.',
  },
  'empires-cliopatria': {
    title: 'States and empires (Cliopatria)',
    what: 'The borders of states and empires in the year shown, and their names.',
    sources: ['cliopatria'],
    how: 'Borders simplified and split by century for this site. Cliopatria’s latest borders, of 2024, stand for the years since.',
    others:
      'OpenHistoricalMap draws some borders differently: pick it, or both to compare, in Layers.',
  },
  'empires-ohm': {
    title: 'States and empires (OpenHistoricalMap)',
    what: 'The borders of states and empires in the year shown, and their names.',
    sources: ['ohm'],
    how: 'Borders simplified and split by century for this site.',
    others: 'Cliopatria draws some borders differently: pick it, or both to compare, in Layers.',
  },
  ways: {
    title: 'Ways of life',
    what: 'How people lived in each region, as archaeologists rated it: foraging, herding, farming, intensive farming, towns.',
    sources: ['archaeoglobe'],
    how: 'Each region shaded by its most widespread way of life at the rated moment nearest the year shown (ten moments, 10,000 years ago to 1850); mixed where several are as widespread. Region outlines simplified.',
  },
  periods: {
    title: 'Named periods',
    what: 'The archaeological and historical periods named for the place picked.',
    sources: ['periodo', 'naturalEarth'],
    how: 'Periods matched to the country at the place picked by their Wikidata identifiers; each listed with the source that defines it.',
  },
  genomes: {
    title: 'Ancient genomes',
    what: 'Dated ancient DNA, counted by region within 250 years of the year shown.',
    sources: ['aadr'],
    how: 'Ancient individuals that pass the resource’s own assessment, counted by 2° cell.',
  },
  rocks: {
    title: 'Rocks at the surface',
    what: 'How old the rocks at the surface are today.',
    sources: ['macrostrat'],
    how: 'World map units, simplified for this site.',
  },
  impacts: {
    title: 'Impact craters',
    what: 'Craters and deposits left by asteroids and comets, and in deep time, where they lay when they struck.',
    sources: ['impactEarth', 'gplates', 'paleodem'],
    how: 'Places when they struck reconstructed on the PALEOMAP model by the GPlates Web Service.',
  },
  volcanoes: {
    title: 'Volcanic eruptions',
    what: 'Eruptions dated near the year shown, sized by explosivity.',
    sources: ['gvp'],
  },
  orbits: {
    title: 'Planets’ orbits',
    what: 'The paths of Earth and the five bright planets around the Sun.',
    sources: ['vsop87'],
    how: 'Each orbit sampled at 128 points around the date shown.',
  },
  'deep-surface': {
    title: 'The Earth then',
    what: 'Land, sea and mountains as one reconstruction draws them for the moment shown.',
    sources: ['paleodem', 'ics'],
    how: 'Elevation grids smoothed to 0.2°, seams repaired, and blended between the maps either side of the moment. Period names and dates from the ICS chart.',
    others:
      'Other reconstructions place the continents differently: turn on Plates to outline Cao et al. 2024’s over this one.',
  },
  'ice-surface': {
    title: 'The ice ages’ Earth',
    what: 'Today’s land and sea floor, with the coast at the sea level of the moment and the ice sheets of the time.',
    sources: ['etopo1', 'paleomist', 'batchelor', 'bintanja', 'spratt'],
    how: 'Sea level from the reconstruction picked, laid on today’s depths (not on the land as it was); ice from PaleoMIST every 2,500 years, with Batchelor et al.’s outlines at their time slices.',
    others: 'Sea level by Bintanja & van de Wal or by Spratt & Lisiecki: pick whose to follow.',
  },
  temperature: {
    title: 'Temperature',
    what: 'The surface coloured by its temperature, and each model’s global mean.',
    sources: ['scotese2022', 'cesm'],
    how: 'Maps every 5 million years, packed into images and blended between them.',
    others:
      'Scotese 2022 and CESM (Li et al. 2023) disagree, at times by several degrees: pick whose to colour by.',
  },
  sealevel: {
    title: 'Sea level',
    what: 'Sea level through time, as each reconstruction has it, on a chart.',
    sources: ['bintanja', 'spratt', 'miller', 'vanDerMeer'],
    others: 'Each reconstruction is drawn side by side; they differ, the more so further back.',
  },
  plates: {
    title: 'Plates',
    what: 'A second reconstruction’s continents, outlined over the first.',
    sources: ['cao2024'],
    how: 'Continent outlines reconstructed with pyGPlates in the model’s paleomagnetic frame, drawn as 0.25° masks.',
  },
  humans: {
    title: 'Humans',
    what: 'Dated finds of our species and its relatives, and where a dispersal model has people settled.',
    sources: ['humanFinds', 'timmermann'],
    how: 'Each find is shown with the paper that dates it, and rival dates side by side. The dispersal model is one model’s view, not evidence.',
  },
  air: {
    title: 'Air',
    what: 'Carbon dioxide and methane from the ice cores, and carbon dioxide and oxygen from proxies over 540 million years.',
    sources: ['bereiter', 'loulergue', 'foster', 'mills', 'co2pip'],
    others: 'Proxy estimates scatter widely: each study’s points are shown, by method.',
  },
  fossils: {
    title: 'Fossils',
    what: 'Fossils of four groups of animals, counted by 5 million years and 5°, where they lay then.',
    sources: ['pbdb', 'paleodem'],
    how: 'Places at their age on the PALEOMAP reconstruction.',
  },
} as const satisfies Record<string, Why>;

export type WhyId = keyof typeof WHYS;

/** What decides what is on screen, for the sources it rests on. */
export interface Scene {
  readonly mode: 'globe' | 'sky';
  readonly span: Span;
  readonly focus: string;
  readonly layers: ReadonlySet<Layer>;
  readonly borders: BorderSource;
  readonly eclipse: boolean;
  /** The layers drawn on each span, as the Layers panel has them. */
  readonly drawsOn: (layer: Layer, span: Span) => boolean;
}

/** The layers whose why is their own id. */
const LAYER_WHYS: readonly (Layer & WhyId)[] = [
  'ways',
  'periods',
  'genomes',
  'rocks',
  'impacts',
  'volcanoes',
  'orbits',
  'temperature',
  'sealevel',
  'plates',
  'humans',
  'air',
  'fossils',
];

/** The whys of what is on screen: the ground first, then the sky's bodies, then each layer. */
export function onScreen(scene: Scene): WhyId[] {
  if (scene.mode === 'sky') return ['sky', 'bodies'];
  const ground: WhyId[] =
    scene.focus === 'sun'
      ? ['sun']
      : scene.span === 'years'
        ? ['earth', 'bodies']
        : scene.span === 'ice'
          ? ['ice-surface']
          : ['deep-surface'];
  const layers = (layer: Layer): boolean =>
    scene.layers.has(layer) && scene.drawsOn(layer, scene.span);
  const borders: WhyId[] = !layers('empires')
    ? []
    : scene.borders === 'both'
      ? ['empires-cliopatria', 'empires-ohm']
      : [scene.borders === 'ohm' ? 'empires-ohm' : 'empires-cliopatria'];
  const eclipses: WhyId[] =
    scene.eclipse && scene.span === 'years' && (layers('solar') || layers('lunar'))
      ? ['eclipses']
      : [];
  return [...ground, ...eclipses, ...borders, ...LAYER_WHYS.filter(layers)];
}

/** The why for a layer's row in the Layers panel. */
export function layerWhy(layer: Layer, borders: BorderSource): WhyId {
  if (layer === 'empires') return borders === 'ohm' ? 'empires-ohm' : 'empires-cliopatria';
  if (layer === 'solar' || layer === 'lunar') return 'eclipses';
  return layer;
}
