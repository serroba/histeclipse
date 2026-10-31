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
```

Positions come from [JPL DE441](https://ssd.jpl.nasa.gov/planets/eph_export.html), via [Skyfield](https://rhodesmill.org/skyfield/). Results are checked against NASA's _Five Millennium Canon_ (Espenak & Meeus). Skyfield's ΔT model is the Morrison–Stephenson–Hohenkerk–Zawilski spline, and every catalog records which model it used.

## Contributing

- `main` is protected. Every change goes through a small, focused pull request.
- PRs merge by squash only, after the `CI OK` check passes and the branch is up to date with `main`.
- Dependencies are pinned to exact versions. pnpm refuses package versions younger than 7 days (`minimumReleaseAge`), and uv excludes releases newer than 7 days (`exclude-newer`), and Dependabot uses the same cooldown.
- GitHub Actions are pinned to commit SHAs and audited with [zizmor](https://github.com/zizmorcore/zizmor).

## License

[MIT](LICENSE)
