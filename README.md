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

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm test`         | Unit and property-based tests (Vitest + fast-check)              |
| `pnpm coverage`     | Tests with coverage thresholds enforced (95%)                    |
| `pnpm lint`         | ESLint with typescript-eslint `strictTypeChecked`, zero warnings |
| `pnpm typecheck`    | `tsc -b` with `strict` plus every additional strictness flag     |
| `pnpm format:check` | Prettier                                                         |

## Contributing

- `main` is protected. Every change goes through a small, focused pull request.
- PRs merge by squash only, after the `CI OK` check passes and the branch is up to date with `main`.
- Dependencies are pinned to exact versions. pnpm refuses package versions younger than 7 days (`minimumReleaseAge`), and Dependabot uses the same cooldown.
- GitHub Actions are pinned to commit SHAs and audited with [zizmor](https://github.com/zizmorcore/zizmor).
