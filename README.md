# histeclipse

An interactive 3D explorer for solar and lunar eclipses across recorded history and into the future, built as a fully static site.

The site is static and hosted on GitHub Pages. Every computation either runs in the browser or is precomputed into static data files, so there is no server.

## Development

Requires Node.js ≥ 22.12 (see `.nvmrc`) and pnpm 10.

```sh
pnpm install
pnpm dev          # local dev server
pnpm check        # everything CI runs: format, lint, typecheck, tests + coverage, build
```

| Command             | What it does                                                               |
| ------------------- | -------------------------------------------------------------------------- |
| `pnpm test`         | Unit and property-based tests (Vitest + fast-check)                        |
| `pnpm coverage`     | Tests with coverage thresholds enforced (95%)                              |
| `pnpm test:e2e`     | Playwright smoke tests (desktop + mobile) against a local production build |
| `pnpm lint`         | ESLint with typescript-eslint `strictTypeChecked`, zero warnings           |
| `pnpm typecheck`    | `tsc -b` with `strict` plus every additional strictness flag               |
| `pnpm format:check` | Prettier                                                                   |

## Deployment

Each merge to `main` builds the site with its commit SHA stamped into a `<meta name="histeclipse-version">` tag and deploys it to GitHub Pages. The same Playwright suite then runs against **https://serroba.github.io/histeclipse/**, but only after the public URL is serving that exact commit. The live check also runs daily and can be started by hand (_Actions → Live smoke test_).

## Data pipeline

`data-pipeline/` is a Python project that generates the static data files offline. It never runs on the site. It requires [uv](https://docs.astral.sh/uv/).

```sh
cd data-pipeline
uv sync
uv run ruff format . && uv run ruff check .   # format + lint (all ruff rules)
uv run mypy && uv run basedpyright            # two strict type checkers (see typings/README.md)
uv run pytest                                 # tests + property tests, 95% coverage gate

# Generate data (downloads ~600 MB of DE441 excerpts once, into data-pipeline/.cache/)
uv run histeclipse-pipeline fetch-ephemeris
uv run histeclipse-pipeline lunar-catalog --out ../public/data/lunar
uv run histeclipse-pipeline solar-catalog --out ../public/data/solar   # with Besselian elements
uv run histeclipse-pipeline delta-t --out ../public/data/delta-t.json
uv run histeclipse-pipeline calendars --out ../public/data/calendars   # Babylonian and Chinese months
```

Positions come from [JPL DE441](https://ssd.jpl.nasa.gov/planets/eph_export.html), via [Skyfield](https://rhodesmill.org/skyfield/). Results are checked against NASA's _Five Millennium Canon_ (Espenak & Meeus). Skyfield's ΔT model is the Morrison–Stephenson–Hohenkerk–Zawilski spline, and every catalog records which model it used.

## Contributing

- `main` is protected. Every change goes through a small, focused pull request.
- PRs merge by squash only, after the `CI OK` check passes and the branch is up to date with `main`.
- Dependencies are pinned to exact versions. pnpm refuses package versions younger than 7 days (`minimumReleaseAge`), and uv excludes releases newer than 7 days (`exclude-newer`), and Dependabot uses the same cooldown.
- GitHub Actions are pinned to commit SHAs and audited with [zizmor](https://github.com/zizmorcore/zizmor).

## Data sources and credits

- Planetary positions: [JPL DE441](https://ssd.jpl.nasa.gov/planets/eph_export.html) (NASA/JPL), via [Skyfield](https://rhodesmill.org/skyfield/).
- Eclipse validation: NASA _Five Millennium Canon_ (Espenak & Meeus).
- Babylonian leap months for 626–367 BCE and reigns as dated on tablets: R. A. Parker & W. H. Dubberstein, _Babylonian Chronology 626 B.C.–A.D. 45_ (SAOC 24, Oriental Institute, Chicago, 1942), Plate I and tables, read from the [Internet Archive scan](https://archive.org/details/saoc-24.-babylonian-chronology-626-b.-c.-a.-d.-45). Only facts are taken (which years had a leap month, which king's year a year was); attested and reconstructed leap months are marked apart. Reigns per Ptolemy's royal canon (Handy Tables) are shown beside them.
- Old Persian month names: Encyclopaedia Iranica, "Calendars" (A. Panaino), via Wikipedia's _Old Persian calendar_.
- Lunisolar months, computed from DE441: Babylonian months begin after the first evening the crescent is visible at Babylon by Yallop's q-test (B. D. Yallop 1997, _A Method for Predicting the First Sighting of the New Crescent Moon_, NAO Technical Note 69); close calls are flagged. Chinese months follow the rules in use since 1645 as set out by Reingold & Dershowitz, _Calendrical Calculations_ (Beijing local time before 1929, UTC+8 after); before 1645 they are approximate.
- Long-term precession: Vondrák, Capitaine & Wallace (2011), A&A 534, A22, ported from [ERFA](https://github.com/liberfa/erfa) (BSD 3-Clause, © NumFOCUS Foundation; derived from the IAU [SOFA](http://www.iausofa.org) library; full licence in [`licenses/ERFA.txt`](licenses/ERFA.txt)).
- Stars: Yale _Bright Star Catalogue_, 5th revised ed. (Hoffleit & Warren 1991), distributed by NASA's Astronomical Data Center; J2000 positions, proper motions, parallaxes and radial velocities for 9,096 naked-eye stars.
- Constellation figures and names: [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn (BSD 3-Clause, full licence in [`licenses/d3-celestial.txt`](licenses/d3-celestial.txt)), after the IAU's constellation charts.
- Earth imagery: [NASA Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/) (April 2004, topography and bathymetry), downscaled to 2048 × 1024. It shows today's coastlines and ice. The night side is deliberately a plain dark tint, because modern city lights would be anachronistic.
- Sun imagery: NASA's [Solar Dynamics Observatory](https://sdo.gsfc.nasa.gov/) (courtesy of NASA/SDO and the AIA and HMI science teams), rendered through [Helioviewer](https://helioviewer.org/) (NASA/ESA). Six channels from 8 May 2024 around 12:00 UT, at solar maximum: visible light and the magnetic field from HMI, and 304, 171, 193 and 131 Å from AIA. They show the Sun of that day. Its surface on any other date, and certainly in antiquity, was different and is unknown.
- Borders of past states and empires: [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) v0.2.1, Seshat Global History Databank (Bennett et al. 2025, _Scientific Data_ 12, 247), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). For this site the borders were simplified to about 10 km, holes and areas smaller than about 30 km across were dropped, consecutive periods with unchanged borders were merged, BCE years were converted to astronomical numbering, and the data was split into one file per century. As Cliopatria's authors note, the borders are one reading of the evidence; past borders are often uncertain or disputed.
- Constellations of other cultures: unmodified copies of [Stellarium](https://stellarium.org/)'s sky cultures (Babylonian MUL.APIN and Seleucid, Egyptian, Greek Almagest, Chinese, Indian, Arabic al-Sufi), each under its own licence (CC BY-ND 4.0, CC BY-SA 4.0 or GPL v2) and with its authors' credits; see [`public/skycultures/README.md`](public/skycultures/README.md). Positions for the stars they use come from the Hipparcos main catalogue (ESA 1997, Perryman et al.), via NASA's [HEASARC](https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/hipparcos.html).
- Planets (Mercury to Saturn): VSOP87 (Bretagnon & Francou 1988), via [astronomia](https://github.com/commenthol/astronomia) (MIT). Checked against DE441 positions from JPL's [Horizons](https://ssd.jpl.nasa.gov/horizons/) system (`test-vectors/planets.json`): since 1000 BCE every planet is within 0.5′. Before that, Jupiter drifts by up to 8′ and Saturn by up to 20′ by 4000 BCE, and the sky view says so. Magnitudes follow the Astronomical Almanac formulas given by Meeus (_Astronomical Algorithms_, ch. 41), with Saturn's rings.
- Planets in the space view: true sizes and shapes, and their poles, from the IAU Working Group on Cartographic Coordinates and Rotational Elements (Archinal et al. 2018); Saturn's ring radii from NASA's Saturnian Rings Fact Sheet. Their colours and bands are approximate impressions, not maps of the surfaces.
- A second view of past borders: [OpenHistoricalMap](https://www.openhistoricalmap.org/) (© OpenHistoricalMap contributors, [CC0](https://creativecommons.org/publicdomain/zero/1.0/)), its country-level borders and names read from its zoom-2 vector tiles, simplified to about 5 km and split by century. The map is edited daily; `public/data/ohm/index.json` records when it was fetched.
- Earth's surface over deep time: PALEOMAP PaleoDEMs, Scotese, C.R. & Wright, N. (2018), _PALEOMAP Paleodigital Elevation Models (PaleoDEMS) for the Phanerozoic_, [doi:10.5281/zenodo.5460860](https://doi.org/10.5281/zenodo.5460860), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: the 0.1° grids (every 5 million years, 540 Ma to today) are smoothed and halved to 0.2° and packed into 8-bit greyscale images (about 87 m per step under the sea, 51 m on land). Faults in the source are repaired: heights above 9.5 km in 20 grids, mostly over ocean trenches (the Challenger Deep reads +10,500 m at 0 Ma), are filled from their neighbours; each pole row takes the row beside it; the two copies of the 180° meridian take their neighbours' mean.
- Where the continents were, back to 1.8 billion years: Cao, X. et al. (2024), _Earth's tectonic and plate boundary evolution over 1.8 billion years_, _Geoscience Frontiers_ 15, 101922; model [doi:10.5281/zenodo.13628813](https://doi.org/10.5281/zenodo.13628813), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: its continent outlines are reconstructed every 5 million years, in its paleomagnetic reference frame, and drawn as 0.25° masks. The reconstruction uses [pyGPlates](https://www.gplates.org/) (GPL-2) in `data-pipeline/plates/`; pyGPlates makes the masks and is not part of the site.
- Surface temperature over deep time: Scotese, C.R. (2022), _Global Mean Surface Temperatures for 100 Phanerozoic Time Intervals_, [doi:10.5281/zenodo.5718392](https://doi.org/10.5281/zenodo.5718392), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), after Scotese et al. (2021), _Earth-Science Reviews_ 215, 103503, and Valdes, Scotese & Lunt (2021), _Climate of the Past_. Changes: two colour-scale anchors planted in each map's north-pole row (+50 °C and −55 °C) are removed; the maps are packed into 8-bit greyscale images (about 0.5 °C per step). The 65 Ma map is far colder than its neighbours and is kept as published, with a note on the site.
- A second model of surface temperature, the last 250 million years: Li, X., Hu, Y. et al. (2023), _Climate Variations in the Past 250 Million Years and Contributing Factors_, _Paleoceanography and Paleoclimatology_ 38, [doi:10.1029/2022PA004503](https://doi.org/10.1029/2022PA004503); data [doi:10.5281/zenodo.7322003](https://doi.org/10.5281/zenodo.7322003), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: the CESM Control runs' surface temperature, regridded from about 3.75° to 1° and packed into 8-bit images.
- Global sea level through time, four reconstructions side by side: van der Meer, D.G. et al. (2022), _Gondwana Research_ 111, 103–121, [doi:10.1016/j.gr.2022.07.014](https://doi.org/10.1016/j.gr.2022.07.014), Supplementary Table 1, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); Miller, K.G. et al. (2020), smoothed Cenozoic sea level, [doi:10.1594/PANGAEA.923139](https://doi.org/10.1594/PANGAEA.923139), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); Bintanja, R. & van de Wal, R.S.W. (2008), _Nature_ 454, 869–872, and Spratt, R.M. & Lisiecki, L.E. (2016), _Climate of the Past_ 12, 1079–1092, both from the [NOAA World Data Service for Paleoclimatology](https://www.ncei.noaa.gov/products/paleoclimatology). Changes: values rounded to 0.1 m; Bintanja & van de Wal thinned to 1,000-year steps and their sea-level fall turned into height above today.
- Today's coasts and continental shelves, for coastlines at past sea levels: ETOPO1 1 Arc-Minute Global Relief Model (ice surface), Amante, C. & Eakins, B.W. (2009), NOAA Technical Memorandum NESDIS NGDC-24, via [NOAA ERDDAP](https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.html); NOAA: "may be used and redistributed for free". Changes: every sixth node (0.1°), packed into an 8-bit image one metre a step from 200 m below to 55 m above today's sea level.
- Sea ice today: NSIDC Sea Ice Index, version 4 (Fetterer, F. et al., [doi:10.7265/N5K072F8](https://doi.org/10.7265/N5K072F8)), NOAA@NSIDC. Changes: the March and September concentration grids for 1981–2010 are averaged and resampled from NSIDC's polar stereographic grids to 1°.
- Sea ice at the Last Glacial Maximum: PMIP4/CMIP6 `lgm` runs of MPI-ESM1-2-LR (MPI-M), MIROC-ES2L (MIROC) and AWI-ESM-1-1-LR (AWI), sea-ice concentration (`siconc`), from ESGF; [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) since June 2022 per the [CMIP6 licence register](https://wcrp-cmip.github.io/CMIP6_CVs/docs/CMIP6_source_id_licenses.html). Changes: March and September means regridded to 1°. Between today and the glacial maximum the globe blends the two by how far the sea had fallen; that blend is a stand-in, not a reconstruction.
- Ice sheets over the last 80,000 years: PaleoMIST 1.0, Gowan, E.J. et al. (2021), _A new global ice sheet reconstruction for the past 80 000 years_, _Nature Communications_ 12, 1199, data [doi:10.1594/PANGAEA.905800](https://doi.org/10.1594/PANGAEA.905800), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: the 0.25° global ice-thickness grid is read out of the archive and packed into 8-bit images, 16 m a step.

## License

[MIT](LICENSE)
