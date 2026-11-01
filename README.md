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

## License

[MIT](LICENSE)
