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
  morrison2004: {
    name: 'Morrison & Stephenson 2004',
    kind: 'paper',
    cite: 'Morrison & Stephenson (2004), Historical values of the Earth’s clock error ΔT and the calculation of eclipses, Journal for the History of Astronomy 35, 327–336',
    url: 'https://doi.org/10.1177/002182860403500305',
  },
  iers: {
    name: 'IERS',
    kind: 'dataset',
    cite: 'International Earth Rotation and Reference Systems Service: the length of today’s day',
    url: 'https://www.iers.org',
  },
  wells1963: {
    name: 'Wells 1963',
    kind: 'paper',
    cite: 'Wells (1963), Coral growth and geochronometry, Nature 197, 948–950',
    url: 'https://doi.org/10.1038/197948a0',
  },
  williams2000: {
    name: 'Williams 2000',
    kind: 'paper',
    cite: 'Williams (2000), Geological constraints on the Precambrian history of Earth’s rotation and the Moon’s orbit, Reviews of Geophysics 38, 37–59',
    url: 'https://doi.org/10.1029/1999RG900016',
  },
  deWinter2020: {
    name: 'de Winter et al. 2020',
    kind: 'paper',
    cite: 'de Winter et al. (2020), Subdaily-scale chemical variability in a Torreites sanchezi rudist shell, Paleoceanography and Paleoclimatology 35',
    url: 'https://doi.org/10.1029/2019PA003723',
  },
  laskar2004: {
    name: 'Laskar et al. 2004',
    kind: 'model',
    cite: 'Laskar et al. (2004), A long-term numerical solution for the insolation quantities of the Earth, Astronomy & Astrophysics 428, 261–285',
    url: 'https://doi.org/10.1051/0004-6361:20041335',
  },
  laskar1993: {
    name: 'Laskar, Joutel & Robutel 1993',
    kind: 'paper',
    cite: 'Laskar, Joutel & Robutel (1993), Stabilization of the Earth’s obliquity by the Moon, Nature 361, 615–617',
    url: 'https://doi.org/10.1038/361615a0',
  },
  gough1981: {
    name: 'Gough 1981',
    kind: 'paper',
    cite: 'Gough (1981), Solar interior structure and luminosity variations, Solar Physics 74, 21–34',
    url: 'https://doi.org/10.1007/BF00151270',
  },
  saganMullen1972: {
    name: 'Sagan & Mullen 1972',
    kind: 'paper',
    cite: 'Sagan & Mullen (1972), Earth and Mars: evolution of atmospheres and surface temperatures, Science 177, 52–56',
    url: 'https://doi.org/10.1126/science.177.4043.52',
  },
  tarduno2010: {
    name: 'Tarduno et al. 2010',
    kind: 'paper',
    cite: 'Tarduno et al. (2010), Geodynamo, solar wind, and magnetopause 3.4 to 3.45 billion years ago, Science 327, 1238–1240',
    url: 'https://doi.org/10.1126/science.1183445',
  },
  tarduno2015: {
    name: 'Tarduno et al. 2015',
    kind: 'paper',
    cite: 'Tarduno et al. (2015), A Hadean to Paleoarchean geodynamo recorded by single zircon crystals, Science 349, 521–524',
    url: 'https://doi.org/10.1126/science.aaa9114',
  },
  torsvik2012: {
    name: 'Torsvik et al. 2012',
    kind: 'paper',
    cite: 'Torsvik et al. (2012), Phanerozoic polar wander, palaeogeography and dynamics, Earth-Science Reviews 114, 325–368',
    url: 'https://doi.org/10.1016/j.earscirev.2012.06.007',
  },
  torsvikCocks: {
    name: 'Torsvik & Cocks, Earth History and Palaeogeography',
    kind: 'paper',
    cite: 'Torsvik & Cocks (2016), Earth History and Palaeogeography, Cambridge University Press: a textbook, period by period',
    url: 'https://doi.org/10.1017/9781316225523',
  },
  boucot2013: {
    name: 'Boucot, Chen & Scotese 2013',
    kind: 'paper',
    cite: 'Boucot, Chen & Scotese (2013), Phanerozoic Paleoclimate: an atlas of lithologic indicators of climate, SEPM Concepts in Sedimentology and Paleontology 11',
    url: 'https://doi.org/10.2110/sepmcsp.11',
  },
  montanez2013: {
    name: 'Montañez & Poulsen 2013',
    kind: 'paper',
    cite: 'Montañez & Poulsen (2013), The Late Paleozoic Ice Age: an evolving paradigm, Annual Review of Earth and Planetary Sciences 41, 629–656',
    url: 'https://doi.org/10.1146/annurev.earth.031208.100118',
  },
  seton2020: {
    name: 'Seton et al. 2020',
    kind: 'dataset',
    cite: 'Seton et al. (2020), A global data set of present-day oceanic crustal age and seafloor spreading parameters, Geochemistry, Geophysics, Geosystems 21',
    url: 'https://doi.org/10.1029/2020GC009214',
  },
  steinberger2008: {
    name: 'Steinberger & Torsvik 2008',
    kind: 'paper',
    cite: 'Steinberger & Torsvik (2008), Absolute plate motions and true polar wander in the absence of hotspot tracks, Nature 452, 620–623',
    url: 'https://doi.org/10.1038/nature06824',
  },
  merdith2021: {
    name: 'Merdith et al. 2021',
    kind: 'model',
    cite: 'Merdith et al. (2021), Extending full-plate tectonic models into deep time, Earth-Science Reviews 214, 103477',
    url: 'https://doi.org/10.1016/j.earscirev.2020.103477',
  },
  muller2019: {
    name: 'Müller et al. 2019',
    kind: 'model',
    cite: 'Müller et al. (2019), A global plate model including lithospheric deformation along major rifts and orogens since the Triassic, Tectonics 38',
    url: 'https://doi.org/10.1029/2018TC005462',
  },
  gplatesPortal: {
    name: 'GPlates Portal',
    kind: 'model',
    cite: 'The GPlates Portal (EarthByte): reconstructions to explore in the browser',
    url: 'https://portal.gplates.org',
  },
  finnegan2011: {
    name: 'Finnegan et al. 2011',
    kind: 'paper',
    cite: 'Finnegan et al. (2011), The magnitude and duration of Late Ordovician–Early Silurian glaciation, Science 331, 903–906',
    url: 'https://doi.org/10.1126/science.1200803',
  },
  burgess2014: {
    name: 'Burgess, Bowring & Shen 2014',
    kind: 'paper',
    cite: 'Burgess, Bowring & Shen (2014), High-precision timeline for Earth’s most severe extinction, PNAS 111, 3316–3321',
    url: 'https://doi.org/10.1073/pnas.1317692111',
  },
  blackburn2013: {
    name: 'Blackburn et al. 2013',
    kind: 'paper',
    cite: 'Blackburn et al. (2013), Zircon U-Pb geochronology links the end-Triassic extinction with the Central Atlantic Magmatic Province, Science 340, 941–945',
    url: 'https://doi.org/10.1126/science.1234204',
  },
  zachos2001: {
    name: 'Zachos et al. 2001',
    kind: 'paper',
    cite: 'Zachos et al. (2001), Trends, rhythms, and aberrations in global climate 65 Ma to present, Science 292, 686–693',
    url: 'https://doi.org/10.1126/science.1059412',
  },
  hu2016: {
    name: 'Hu et al. 2016',
    kind: 'paper',
    cite: 'Hu et al. (2016), The timing of India-Asia collision onset: facts, theories, controversies, Earth-Science Reviews 160, 264–299',
    url: 'https://doi.org/10.1016/j.earscirev.2016.07.014',
  },
  odea2016: {
    name: 'O’Dea et al. 2016',
    kind: 'paper',
    cite: 'O’Dea et al. (2016), Formation of the Isthmus of Panama, Science Advances 2',
    url: 'https://doi.org/10.1126/sciadv.1600883',
  },
  collins2005: {
    name: 'Collins, Melosh & Marcus 2005',
    kind: 'model',
    cite: 'Collins, Melosh & Marcus (2005), Earth Impact Effects Program: a web-based computer program for calculating the regional environmental consequences of a meteoroid impact on Earth, Meteoritics & Planetary Science 40, 817–840',
    url: 'https://doi.org/10.1111/j.1945-5100.2005.tb00157.x',
  },
  collins2020: {
    name: 'Collins et al. 2020',
    kind: 'paper',
    cite: 'Collins et al. (2020), A steeply-inclined trajectory for the Chicxulub impact, Nature Communications 11',
    url: 'https://doi.org/10.1038/s41467-020-15269-x',
  },
  wilde2001: {
    name: 'Wilde et al. 2001',
    kind: 'paper',
    cite: 'Wilde, Valley, Peck & Graham (2001), Evidence from detrital zircons for the existence of continental crust and oceans on the Earth 4.4 Gyr ago, Nature 409, 175–178',
    url: 'https://doi.org/10.1038/35051550',
  },
  bowring1999: {
    name: 'Bowring & Williams 1999',
    kind: 'paper',
    cite: 'Bowring & Williams (1999), Priscoan (4.00–4.03 Ga) orthogneisses from northwestern Canada, Contributions to Mineralogy and Petrology 134, 3–16',
    url: 'https://doi.org/10.1007/s004100050465',
  },
  allwood2006: {
    name: 'Allwood et al. 2006',
    kind: 'paper',
    cite: 'Allwood et al. (2006), Stromatolite reef from the Early Archaean era of Australia, Nature 441, 714–718',
    url: 'https://doi.org/10.1038/nature04764',
  },
  bleeker2003: {
    name: 'Bleeker 2003',
    kind: 'paper',
    cite: 'Bleeker (2003), The late Archean record: a puzzle in ca. 35 pieces, Lithos 71, 99–134',
    url: 'https://doi.org/10.1016/j.lithos.2003.07.003',
  },
  farquhar2000: {
    name: 'Farquhar, Bao & Thiemens 2000',
    kind: 'paper',
    cite: 'Farquhar, Bao & Thiemens (2000), Atmospheric influence of Earth’s earliest sulfur cycle, Science 289, 756–758',
    url: 'https://doi.org/10.1126/science.289.5480.756',
  },
  zhao2002: {
    name: 'Zhao et al. 2002',
    kind: 'paper',
    cite: 'Zhao et al. (2002), Review of global 2.1–1.8 Ga orogens: implications for a pre-Rodinia supercontinent, Earth-Science Reviews 59, 125–162',
    url: 'https://doi.org/10.1016/S0012-8252(02)00073-9',
  },
  evans2011: {
    name: 'Evans & Mitchell 2011',
    kind: 'paper',
    cite: 'Evans & Mitchell (2011), Assembly and breakup of the core of Paleoproterozoic–Mesoproterozoic supercontinent Nuna, Geology 39, 443–446',
    url: 'https://doi.org/10.1130/G31654.1',
  },
  li2008: {
    name: 'Li et al. 2008',
    kind: 'paper',
    cite: 'Li et al. (2008), Assembly, configuration, and break-up history of Rodinia: a synthesis, Precambrian Research 160, 179–210',
    url: 'https://doi.org/10.1016/j.precamres.2007.04.021',
  },
  hoffman1998: {
    name: 'Hoffman et al. 1998',
    kind: 'paper',
    cite: 'Hoffman, Kaufman, Halverson & Schrag (1998), A Neoproterozoic snowball Earth, Science 281, 1342–1346',
    url: 'https://doi.org/10.1126/science.281.5381.1342',
  },
  hoffman2017: {
    name: 'Hoffman et al. 2017',
    kind: 'paper',
    cite: 'Hoffman et al. (2017), Snowball Earth climate dynamics and Cryogenian geology-geobiology, Science Advances 3',
    url: 'https://doi.org/10.1126/sciadv.1600983',
  },
  sdo: {
    name: 'NASA SDO',
    kind: 'imagery',
    cite: 'NASA Solar Dynamics Observatory, AIA and HMI science teams, images of 2024 via Helioviewer',
    url: 'https://sdo.gsfc.nasa.gov/',
    licence: 'NASA, public domain',
  },
  lemen2012: {
    name: 'Lemen et al. 2012',
    kind: 'paper',
    cite: 'Lemen, J. R., Title, A. M., Akin, D. J., Boerner, P. F., et al. (2012). The Atmospheric Imaging Assembly (AIA) on the Solar Dynamics Observatory (SDO). Solar Physics 275, 17–40',
    url: 'https://doi.org/10.1007/s11207-011-9776-8',
  },
  archinal2018: {
    name: 'Archinal et al. 2018',
    kind: 'model',
    cite: 'Archinal, B. A., Acton, C. H., A’Hearn, M. F., et al. (2018). Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015. Celestial Mechanics and Dynamical Astronomy 130, 22',
    url: 'https://doi.org/10.1007/s10569-017-9805-5',
  },
  paleBlueDot: {
    name: 'Voyager 1: Pale Blue Dot',
    kind: 'imagery',
    cite: 'NASA/JPL, “Solar System Portrait – Earth as ‘Pale Blue Dot’”, Voyager 1, 14 February 1990, NASA Photojournal PIA00452',
    url: 'https://science.nasa.gov/photojournal/solar-system-portrait-earth-as-pale-blue-dot/',
    licence: 'NASA, public domain',
  },
  dayEarthSmiled: {
    name: 'Cassini: The Day the Earth Smiled',
    kind: 'imagery',
    cite: 'NASA/JPL-Caltech/Space Science Institute, “The Day the Earth Smiled: Sneak Preview”, Cassini, 19 July 2013, NASA Photojournal PIA17171',
    url: 'https://science.nasa.gov/photojournal/the-day-the-earth-smiled-sneak-preview/',
    licence: 'NASA, public domain',
  },
  intcal20: {
    name: 'IntCal20',
    kind: 'dataset',
    cite: 'Reimer, P. J., et al. (2020). The IntCal20 Northern Hemisphere radiocarbon age calibration curve (0–55 cal kBP). Radiocarbon 62, 725–757',
    url: 'https://doi.org/10.1017/RDC.2020.41',
    licence: 'CC BY 4.0',
  },
  shcal20: {
    name: 'SHCal20',
    kind: 'dataset',
    cite: 'Hogg, A. G., et al. (2020). SHCal20 Southern Hemisphere calibration, 0–55,000 years cal BP. Radiocarbon 62, 759–778',
    url: 'https://doi.org/10.1017/RDC.2020.59',
    licence: 'CC BY 4.0',
  },
  kovaltsov2012: {
    name: 'Kovaltsov et al. 2012',
    kind: 'paper',
    cite: 'Kovaltsov, G. A., Mishev, A. & Usoskin, I. G. (2012). A new model of cosmogenic production of radiocarbon 14C in the atmosphere. Earth and Planetary Science Letters 337–338, 114–120',
    url: 'https://doi.org/10.1016/j.epsl.2012.05.036',
  },
  usoskin2005: {
    name: 'Usoskin et al. 2005',
    kind: 'paper',
    cite: 'Usoskin, I. G., Alanko-Huotari, K., Kovaltsov, G. A. & Mursula, K. (2005). Heliospheric modulation of cosmic rays: monthly reconstruction for 1951–2004. Journal of Geophysical Research 110, A12108',
    url: 'https://doi.org/10.1029/2005JA011250',
  },
  korte2011: {
    name: 'Korte et al. 2011',
    kind: 'paper',
    cite: 'Korte, M., Constable, C., Donadini, F. & Holme, R. (2011). Reconstructing the Holocene geomagnetic field. Earth and Planetary Science Letters 312, 497–505',
    url: 'https://doi.org/10.1016/j.epsl.2011.10.031',
  },
  ggf100k: {
    name: 'GGF100k',
    kind: 'dataset',
    cite: 'Panovska, S., Constable, C. G. & Korte, M. (2018). Extending global continuous geomagnetic field reconstructions on timescales beyond human civilization. Geochemistry, Geophysics, Geosystems 19, 4757–4772; dipole moment from the model archive, EarthRef ERDA 2382 (no licence stated)',
    url: 'https://doi.org/10.1029/2018GC007966',
  },
  korte2019: {
    name: 'Korte et al. 2019',
    kind: 'paper',
    cite: 'Korte, M., Brown, M. C., Panovska, S. & Wardinski, I. (2019). Robust characteristics of the Laschamp and Mono Lake geomagnetic excursions: results from global field models. Frontiers in Earth Science 7, 86',
    url: 'https://doi.org/10.3389/feart.2019.00086',
    licence: 'CC BY 4.0',
  },
  marine20: {
    name: 'Marine20',
    kind: 'dataset',
    cite: 'Heaton, T. J., et al. (2020). Marine20—the marine radiocarbon age calibration curve (0–55,000 cal BP). Radiocarbon 62, 779–820',
    url: 'https://doi.org/10.1017/RDC.2020.68',
    licence: 'CC BY 4.0',
  },
  godwin1962: {
    name: 'Godwin 1962',
    kind: 'paper',
    cite: 'Godwin, H. (1962). Half-life of radiocarbon. Nature 195, 984',
    url: 'https://doi.org/10.1038/195984a0',
  },
  holvol: {
    name: 'HolVol',
    kind: 'dataset',
    cite: 'Sigl, M., Toohey, M., McConnell, J. R., Cole-Dai, J. & Severi, M. (2022). Volcanic stratospheric sulfur injections and aerosol optical depth during the Holocene (past 11 500 years) from a bipolar ice-core array. Earth System Science Data 14, 3167–3196; data: HolVol v1.0, PANGAEA, doi:10.1594/PANGAEA.928646',
    url: 'https://doi.org/10.5194/essd-14-3167-2022',
    licence: 'CC BY 4.0',
  },
  sigl2015: {
    name: 'Sigl et al. 2015',
    kind: 'paper',
    cite: 'Sigl, M., et al. (2015). Timing and climate forcing of volcanic eruptions for the past 2,500 years. Nature 523, 543–549',
    url: 'https://doi.org/10.1038/nature14565',
  },
  lavigne2013: {
    name: 'Lavigne et al. 2013',
    kind: 'paper',
    cite: 'Lavigne, F., et al. (2013). Source of the great A.D. 1257 mystery eruption unveiled, Samalas volcano, Rinjani Volcanic Complex, Indonesia. PNAS 110, 16742–16747',
    url: 'https://doi.org/10.1073/pnas.1307520110',
  },
  stuiverPolach1977: {
    name: 'Stuiver & Polach 1977',
    kind: 'paper',
    cite: 'Stuiver, M. & Polach, H. A. (1977). Discussion: reporting of 14C data. Radiocarbon 19, 355–363',
    url: 'https://doi.org/10.1017/S0033822200003672',
  },
  miyake2012: {
    name: 'Miyake et al. 2012',
    kind: 'paper',
    cite: 'Miyake, F., Nagaya, K., Masuda, K. & Nakamura, T. (2012). A signature of cosmic-ray increase in AD 774–775 from tree rings in Japan. Nature 486, 240–242',
    url: 'https://doi.org/10.1038/nature11123',
  },
  miyake2013: {
    name: 'Miyake et al. 2013',
    kind: 'paper',
    cite: 'Miyake, F., Masuda, K. & Nakamura, T. (2013). Another rapid event in the carbon-14 content of tree rings. Nature Communications 4, 1748',
    url: 'https://doi.org/10.1038/ncomms2783',
  },
  oHare2019: {
    name: 'O’Hare et al. 2019',
    kind: 'paper',
    cite: 'O’Hare, P., Mekhaldi, F., Adolphi, F., et al. (2019). Multiradionuclide evidence for an extreme solar proton event around 2,610 B.P. (∼660 BC). PNAS 116, 5961–5966',
    url: 'https://doi.org/10.1073/pnas.1815725116',
  },
  brehm2022: {
    name: 'Brehm et al. 2022',
    kind: 'paper',
    cite: 'Brehm, N., Christl, M., Knowles, T. D. J., et al. (2022). Tree-rings reveal two strong solar proton events in 7176 and 5259 BCE. Nature Communications 13, 1196',
    url: 'https://doi.org/10.1038/s41467-022-28804-9',
  },
  kuitems2022: {
    name: 'Kuitems et al. 2022',
    kind: 'paper',
    cite: 'Kuitems, M., Wallace, B. L., Lindsay, C., et al. (2022). Evidence for European presence in the Americas in AD 1021. Nature 601, 388–391',
    url: 'https://doi.org/10.1038/s41586-021-03972-8',
  },
  moonKit: {
    name: 'NASA CGI Moon Kit',
    kind: 'imagery',
    cite: 'NASA Scientific Visualization Studio, CGI Moon Kit (2019): the Lunar Reconnaissance Orbiter Camera’s colour mosaic of the Moon',
    url: 'https://svs.gsfc.nasa.gov/4720',
    licence: 'NASA, public domain',
  },
  messengerMap: {
    name: 'MESSENGER map of Mercury',
    kind: 'imagery',
    cite: 'NASA/JHU APL/Carnegie Institution of Washington, “A Global View from Orbit”, MESSENGER mosaic of Mercury, NASA Photojournal PIA15063 (2011)',
    url: 'https://science.nasa.gov/photojournal/a-global-view-from-orbit/',
    licence: 'NASA, public domain',
  },
  vikingMap: {
    name: 'Viking colour mosaic of Mars',
    kind: 'imagery',
    cite: 'NASA/JPL/USGS Astrogeology Science Center, Mars Viking Global Color Mosaic 925 m, from Viking Orbiter images of 1976–80',
    url: 'https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m',
    licence: 'USGS, public domain',
  },
  cassiniJupiter: {
    name: 'Cassini map of Jupiter',
    kind: 'imagery',
    cite: 'NASA/JPL/Space Science Institute, “Cassini’s Best Maps of Jupiter (Cylindrical Map)”, from the flyby of December 2000, NASA Photojournal PIA07782 (2006)',
    url: 'https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map/',
    licence: 'NASA, public domain',
  },
  cassiniSaturn: {
    name: 'Cassini map of Saturn',
    kind: 'imagery',
    cite: 'Li, L., West, R., Jiang, X. & Knowles, B. (2023). Cassini ISS Global Maps of Jupiter and Saturn, colour map of Saturn from 11 August 2011. NASA Planetary Data System',
    url: 'https://doi.org/10.17189/rkkb-6y30',
    licence: 'NASA, public domain',
  },
  kirschvink1997: {
    name: 'Kirschvink et al. 1997',
    kind: 'paper',
    cite: 'Kirschvink, J. L., Ripperdan, R. L. & Evans, D. A. (1997). Evidence for a large-scale reorganization of Early Cambrian continental masses by inertial interchange true polar wander. Science 277, 541–545',
    url: 'https://doi.org/10.1126/science.277.5325.541',
  },
  torsvik1998: {
    name: 'Torsvik, Meert & Smethurst 1998',
    kind: 'paper',
    cite: 'Torsvik, T. H., Meert, J. G. & Smethurst, M. A. (1998). Polar wander and the Cambrian (technical comment). Science 279, 9',
    url: 'https://doi.org/10.1126/science.279.5347.9a',
  },
  kent2015: {
    name: 'Kent et al. 2015',
    kind: 'paper',
    cite: 'Kent, D. V., Kjarsgaard, B. A., Gee, J. S., Muttoni, G. & Heaman, L. M. (2015). Tracking the Late Jurassic apparent (or true) polar shift in U-Pb-dated kimberlites from cratonic North America (Superior Province of Canada). Geochemistry, Geophysics, Geosystems 16, 983–994',
    url: 'https://doi.org/10.1002/2015GC005734',
  },
  muttoniKent2019: {
    name: 'Muttoni & Kent 2019',
    kind: 'paper',
    cite: 'Muttoni, G. & Kent, D. V. (2019). Jurassic monster polar shift confirmed by sequential paleopoles from Adria, promontory of Africa. Journal of Geophysical Research: Solid Earth 124, 3288–3306',
    url: 'https://doi.org/10.1029/2018JB017199',
  },
  sagerKoppers2000: {
    name: 'Sager & Koppers 2000',
    kind: 'paper',
    cite: 'Sager, W. W. & Koppers, A. A. P. (2000). Late Cretaceous polar wander of the Pacific plate: evidence of a rapid true polar wander event. Science 287, 455–459',
    url: 'https://doi.org/10.1126/science.287.5452.455',
  },
  mitchell2021: {
    name: 'Mitchell et al. 2021',
    kind: 'paper',
    cite: 'Mitchell, R. N., Thissen, C. J., Evans, D. A. D., Slotznick, S. P., Coccioni, R., Yamazaki, T. & Kirschvink, J. L. (2021). A Late Cretaceous true polar wander oscillation. Nature Communications 12, 3629',
    url: 'https://doi.org/10.1038/s41467-021-23803-8',
  },
  gts2020Polarity: {
    name: 'GTS 2020: Geomagnetic Polarity Time Scale',
    kind: 'dataset',
    cite: 'Ogg, J. G. (2020). Geomagnetic Polarity Time Scale. In Gradstein, Ogg, Schmitz & Ogg (eds.), Geologic Time Scale 2020, 159–192. Elsevier',
    url: 'https://doi.org/10.1016/B978-0-12-824360-2.00005-X',
  },
  pmagpy: {
    name: 'PmagPy',
    kind: 'model',
    cite: 'Tauxe, L., Shaar, R., Jonestrask, L., et al. (2016). PmagPy: software package for paleomagnetic data analysis and a bridge to the Magnetics Information Consortium (MagIC) database. Geochemistry, Geophysics, Geosystems 17, 2450–2463',
    url: 'https://doi.org/10.1002/2016GC006307',
    licence: 'BSD-3-Clause',
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
  /** The kinds of evidence a reconstruction rests on: what each tells, and a key paper. */
  readonly evidence?: readonly {
    readonly name: string;
    readonly says: string;
    readonly source: SourceId;
  }[];
  /** How sure each part is, from firmest to most illustrative. */
  readonly certainty?: readonly string[];
  /** Where a student might read on, in order. */
  readonly reading?: readonly SourceId[];
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
    sources: [
      'meeus',
      'elpmpp02',
      'de441',
      'vsop87',
      'deltaTSplines',
      'deltaTLongTerm',
      'paleBlueDot',
      'dayEarthSmiled',
    ],
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
    what: 'The Sun’s surface in the light picked, from the surface outward: its spots, its magnetic field, then ever hotter layers above it.',
    sources: ['sdo', 'helioviewer', 'lemen2012'],
    how: 'Images of 2024, days apart, stitched into one surface: the Sun of the date shown looked different, in ways unknown. The four hotter layers are seen in extreme ultraviolet, each through a filter that passes the light of one kind of atom at one temperature (helium in the chromosphere, iron in the corona). They are named by wavelength in ångströms (Å), a tenth of a nanometre: visible light is about 6,000 Å, these 131 to 304 Å. Earth’s air blocks this light, so only spacecraft see it.',
  },
  radiocarbon: {
    title: 'Carbon-14 in the air',
    what: 'How much carbon-14 the air held each year, as tree rings, corals and cave formations record it: the curve every radiocarbon date is read against.',
    sources: [
      'intcal20',
      'shcal20',
      'stuiverPolach1977',
      'miyake2012',
      'miyake2013',
      'oHare2019',
      'brehm2022',
      'kuitems2022',
      'holvol',
      'sigl2015',
      'lavigne2013',
    ],
    how: 'The line is the curve’s Δ14C: the air’s carbon-14 against a modern standard, per mille. IntCal20 for the northern hemisphere, SHCal20 for the southern, picked by where you stand. Living things take in the air’s carbon-14 and, once dead, lose half of it every 5,730 years; a laboratory measures what is left, as a radiocarbon age. Because the air’s carbon-14 rose and fell, that age is read against this curve to find calendar years: where the curve is steep, a narrow range; where it is flat (the Hallstatt plateau, about 800–400 BCE), centuries; where it wiggles, two or more ranges. Miyake events, sudden one-year rises from solar storms, let a tree ring be dated to its year. The curves end in 1950: after it nuclear tests nearly doubled the air’s carbon-14 (the bomb pulse). Under the line, each tick is an eruption the ice cores of Greenland and Antarctica record, as tall as the sulfur it sent into the stratosphere (HolVol, 9500 BCE to 1900 CE): its haze cooled the following summers, which tree rings record as frost rings and narrow rings. The ice cores were lined up with the tree rings by the same Miyake spikes, 774 and 993 CE, which left beryllium-10 in the ice as they left carbon-14 in the wood. Most eruptions are known only from the ice; the strip names those its sources do (Samalas, Tambora). Their dates are good to a few years over the last 2,500 years, to 5–15 years before that, and to about 66 years at 9500 BCE.',
  },
  carbonMade: {
    title: 'Carbon-14 made in the sky',
    what: 'Where cosmic rays make carbon-14 in the air, and how it reaches living things: the clock a radiocarbon date reads.',
    sources: [
      'kovaltsov2012',
      'usoskin2005',
      'korte2011',
      'ggf100k',
      'korte2019',
      'marine20',
      'intcal20',
      'godwin1962',
    ],
    how: 'Cosmic rays strike the air high up; neutrons from the shower turn nitrogen-14 into carbon-14. Earth’s magnetic field turns slower rays away, least near the poles, so several times more is made over the poles than over the equator. The rates are Kovaltsov et al.’s model, computed here from their yield function: by their own reckoning about 1.6 atoms per cm² each second on average over 1951–2010. A weaker field or a quieter Sun lets more rays in: with no field, about twice as much. By default the field is that of the moment shown, from the GGF100k model, back 55,000 years: it fell to about a third of today’s in the Laschamp excursion, 41,000 years ago, and models fitted to the excursion alone put it far lower (Korte et al. 2019). The glow is drawn about the spin axis, which the field lines up with when averaged over thousands of years; today it is tilted about 10°. Mixed through the air as carbon dioxide within a few years, carbon-14 enters plants, then animals; the ocean takes it in slowly, so a sea shell reads about 400–600 radiocarbon years older than a plant of the same year (Marine20 against IntCal20, the last 11,000 years). At death the intake stops and half is gone every 5,730 years. After about 50,000 years too little is left to measure.',
  },
  'close-up': {
    title: 'The Moon and planets close up',
    what: 'What the Moon and each planet look like near to: the missions’ own maps of them.',
    sources: [
      'moonKit',
      'messengerMap',
      'vikingMap',
      'cassiniJupiter',
      'cassiniSaturn',
      'archinal2018',
    ],
    how: 'Each map is wrapped on the body as published, shrunk for the web, and each planet is turned as it was at the moment shown, by the IAU’s rotation models, the light’s travel time allowed for: the face toward you is the one that faced you then (checked against JPL Horizons). Jupiter’s and Saturn’s turning is that of their interiors (System III): their clouds drift against it, so a cloud feature is not where it was that day. Venus shows its cloud tops as a plain colour, as from space the clouds hide the ground. Saturn’s map has gaps where Cassini could not see (the poles, and the strip in the rings’ shadow): they are filled with the colour of the nearest latitude imaged.',
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
  'delta-t': {
    title: 'ΔT',
    what: 'How far Earth’s turning had fallen behind a uniform clock by the date shown, and how sure that is. It moves where on Earth an eclipse was seen.',
    sources: ['deltaTSplines', 'deltaTLongTerm', 'morrison2004'],
    how: 'Splines fitted to ancient and modern observations from 720 BCE to 2015 CE, and a long-term parabola outside them (as Skyfield has them). The ± is an approximate standard error, 0.8 t² seconds for t centuries from 1820, at least a second.',
  },
  'earth-facts': {
    title: 'Poles, magnetic field, tilt, day and Sun',
    what: 'What Earth was like then, beyond its map: where its poles were, its magnetic field, its tilt, the length of its day and the Sun’s brightness.',
    sources: [
      'paleodem',
      'tarduno2010',
      'tarduno2015',
      'gts2020Polarity',
      'pmagpy',
      'steinberger2008',
      'torsvik2012',
      'sagerKoppers2000',
      'mitchell2021',
      'kent2015',
      'muttoniKent2019',
      'kirschvink1997',
      'torsvik1998',
      'laskar2004',
      'laskar1993',
      'iers',
      'wells1963',
      'williams2000',
      'deWinter2020',
      'gough1981',
      'saganMullen1972',
    ],
    how: 'Each fact names its source in its text. The day’s length is read between measurements (corals, a rudist shell, tidal rhythmites), and its ± is the source’s where it gives one. The magnetic field’s reversals of the last 83 million years are GTS 2020’s, as PmagPy carries them; before that, the superchrons, and between them a field reversing too often to draw here. The globe’s poles are the spin axis; magnetic north is marked at the pole a compass pointed to, averaged over thousands of years.',
    others:
      'Where sources disagree (a much larger Precambrian tilt; the faint young Sun paradox) the text says so.',
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
    sources: ['impactEarth', 'gplates', 'paleodem', 'collins2005', 'collins2020'],
    how: 'Places when they struck reconstructed on the PALEOMAP model by the GPlates Web Service. A crater’s card estimates the impactor’s size from the crater by Collins et al.’s scaling laws, under assumptions it states; “Play the impact” is an illustration, with Chicxulub’s approach from Collins et al. 2020 and the others assumed.',
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
    how: 'Elevation grids smoothed to 0.2°, seams repaired, and blended between the maps either side of the moment. The maps put the poles of their time at top and bottom, so “North pole then” and “South pole then” are the map’s own. Period names and dates from the ICS chart.',
    others:
      'Other reconstructions place the continents differently: turn on Plates to outline Cao et al. 2024’s over this one.',
  },
  'deep-evidence': {
    title: 'How do we know what Earth looked like?',
    what: 'The globe is a reconstruction: a model of where land and sea, mountains and shelves were, built from evidence that survives in rocks. Some of it is measured, some inferred, some the map-maker’s judgement. This is what it rests on.',
    sources: ['paleodem', 'torsvik2012', 'torsvikCocks', 'cao2024', 'merdith2021', 'muller2019'],
    evidence: [
      {
        name: 'Rock magnetism',
        says: 'Iron minerals in lava and sediment lock in the direction of Earth’s field as the rock forms. Their tilt gives the latitude where the rock formed, and they point to the pole of the time. They say nothing about longitude.',
        source: 'torsvik2012',
      },
      {
        name: 'Matching rocks and fossils',
        says: 'Mountain belts, rock sequences and the same land plants and animals (Glossopteris, Mesosaurus, Lystrosaurus) on continents now oceans apart show which ones were once joined.',
        source: 'torsvikCocks',
      },
      {
        name: 'Rocks that record climate',
        says: 'Glacial deposits, coal, salt and reefs form in particular climates, so they hint at latitude independently of magnetism. Where the two agree, the map is surer: the ice of the late Palaeozoic, for one, lay over the south pole the magnetism finds.',
        source: 'boucot2013',
      },
      {
        name: 'The ocean floor',
        says: 'Magnetic stripes and the ages of the sea floor record how oceans opened. But sea floor sinks back into the mantle: none older than about 180 million years survives in place, so older oceans are inferred.',
        source: 'seton2020',
      },
      {
        name: 'Longitude, by assumption',
        says: 'Since magnetism cannot give longitude, models fix it another way: hotspot tracks, or the deep mantle’s large hot regions held still beneath the plates, or plates moving as little as they can. Different choices, different maps.',
        source: 'steinberger2008',
      },
    ],
    certainty: [
      'Surer: the latitudes of the larger continents, and which continents were joined.',
      'Less sure: longitudes; the outlines of small blocks and of oceans now lost; anything before about 180 million years that would rest on sea floor.',
      'Illustrative: mountain heights and exact coastlines, drawn by the map-maker from rock types and sea-level estimates.',
    ],
    others:
      'Other reconstructions place the continents differently, the more so further back: Cao et al. 2024 (turn on Plates to outline it over this map), Merdith et al. 2021, Müller et al. 2019 (from the Triassic).',
    reading: ['torsvikCocks', 'torsvik2012', 'gplatesPortal', 'montanez2013'],
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

/**
 * What the why panel can show: one thing's why, every source ('all'), or what each layer has
 * at the place picked ('here').
 */
export type WhyView = WhyId | 'all' | 'here';
export const WHY_VIEWS: readonly WhyView[] = [...(Object.keys(WHYS) as WhyId[]), 'all', 'here'];

/** A source's DOI, when its link is one. */
export function doiOf(source: Source): string | null {
  const match = /^https:\/\/doi\.org\/(.+)$/.exec(source.url);
  return match?.[1] ?? null;
}

/** The reference to copy: the full citation, where to find it, and its licence. */
export function citation(source: Source): string {
  const licence = source.licence === undefined ? '' : ` Licence: ${source.licence}.`;
  return `${source.cite}. ${source.url}${licence}`;
}

/** Where to get a source's BibTeX, from Crossref, when it has a DOI. */
export function bibtexUrl(source: Source): string | null {
  const doi = doiOf(source);
  return doi === null
    ? null
    : `https://api.crossref.org/works/${doi}/transform/application/x-bibtex`;
}

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
  'radiocarbon',
  'carbonMade',
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
      : scene.focus !== 'earth' && scene.span === 'years'
        ? ['close-up', 'bodies']
        : scene.span === 'years'
          ? ['earth', 'bodies']
          : scene.span === 'ice'
            ? ['ice-surface']
            : ['deep-surface', 'deep-evidence'];
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
