# Contributing

## Language and naming

Everything in this repository is in **English**, except the Portuguese entries of the locale tables.

| Thing | Convention | Example |
|---|---|---|
| Package folder and npm name | kebab-case, scope `@adatechnology/`, prefix `game-` | `packages/game-camera`, `@adatechnology/game-camera` |
| IIFE global | PascalCase of the package name without the scope | `GameCamera` |
| Functions, methods, options, fields, variables | camelCase | `setMode`, `storageKey`, `aimDistance` |
| Types, interfaces | PascalCase | `CameraRig`, `PropItem` |
| Constants | UPPER_SNAKE_CASE | `DEFAULTS`, `TYPE_DEFS` |
| Data ids (type ids, mode ids, material ids, event actions, palette roles, group ids) | snake_case | `picture_small`, `move_population`, `fabric_main` |
| Files | kebab-case | `house-state.ts` |
| Commit messages, comments, docs | English | |

Data ids are values that end up in saved games, JSON or databases, so they are part of the public contract: renaming one is a breaking change.

### Portuguese

Portuguese lives **only** in locale files (`src/locale.ts`) and in the `Português` section at the end of each README (and in test names or fixtures
only where they assert a pt-BR string). A package that has user-facing default strings keeps them in a small locale table:

- `en` and `pt-BR` entries with the same keys;
- a `locale` option on the factory (default `en`; unknown locales fall back to `en`);
- `pt-BR` must read exactly like the original Portuguese strings of the game these packages came from.

Packages with no user-facing text (for example `game-infection`) have no locale table.

## Code

- TypeScript `strict`, `"type": "module"`, ESM output plus d.ts and an IIFE bundle (`tsup`).
- `three` is only a `peerDependency` and is imported **as a type**. The host passes its own `THREE` instance at runtime.
- No game-specific names, maps or texts. Behaviour is driven by options, callbacks and data.
- Exported types for every config object, returned API and callback.
- No runtime dependencies unless there is a strong reason.

## Tests

[vitest](https://vitest.dev). Put tests in `tests/*.test.ts`. DOM code is tested with `happy-dom` (`environment: 'happy-dom'` in the package's
`vitest.config.ts`); everything else runs in plain Node. When porting code, test against the original behaviour (same inputs, same outputs) and keep
the old test.

Before you push:

```sh
pnpm build && pnpm test && pnpm typecheck && pnpm lint
```

## Changesets and commits

- Every user-visible change needs a changeset (`pnpm changeset`). The first release of a package is a `minor` (0.1.0).
- Commits are small and logical, with English messages (conventional style is welcome: `feat(game-camera): ...`, `fix(...)`, `chore: ...`, `docs: ...`).
- A package ported from another codebase ships a `MIGRATION.md` with a complete old-name to new-name table (API names, options, fields and data ids).

### Releasing

- Every change adds a changeset with a semver bump: `patch` (fixes), `minor` (features) or `major` (breaking). While a package is 0.x, a `minor` may contain breaking changes.
- On merge to `main`, the Release workflow opens (or updates) a "chore: version packages" PR. It bumps the versions and writes each package's `CHANGELOG.md`. Internal dependencies between `@adatechnology/game-*` packages are bumped automatically.
- Merging that PR publishes the changed packages to npm and creates git tags and GitHub releases.
- The workflow needs the repository secret `NPM_TOKEN`: an npm automation token with publish rights on the `@adatechnology` scope. Without it the version PR is still opened, but nothing is published.
- Consumers update with `pnpm up "@adatechnology/*" --latest`. Browser bundles are served from the CDN: `https://cdn.jsdelivr.net/npm/@adatechnology/<pkg>@<version>/dist/index.global.js`.
