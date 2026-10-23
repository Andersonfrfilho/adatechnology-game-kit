# adatechnology-game-kit

Engine-agnostic building blocks for games, published under the `@adatechnology/` scope. Each package is small, typed, has no game-specific
knowledge and takes everything it needs (the `THREE` instance, a `document`, callbacks, data) from the host.

All packages ship ESM with type declarations, plus an IIFE bundle (`dist/index.global.js`) that exposes a browser global, so a game that
concatenates plain scripts can use them without a bundler.

## Packages

| Package | Global | What it is |
|---|---|---|
| [`@adatechnology/game-camera`](packages/game-camera) | `GameCamera` | Shoulder, third-person and first-person camera rig plus first-person viewmodel for three.js |
| [`@adatechnology/game-destruction`](packages/game-destruction) | `GameDestruction` | Engine-agnostic destruction world: parts, joints, materials, damage, fire, melting, structural integrity |
| [`@adatechnology/game-destruction-three`](packages/game-destruction-three) | `GameDestructionThree` | three.js renderer for the destruction world: pieces, holes, cracks, fire and debris |
| [`@adatechnology/game-weapons`](packages/game-weapons) | `GameWeapons` | Arsenal of firearms, melee, fire, heat and tools with ballistics and tool state |
| [`@adatechnology/game-fluids`](packages/game-fluids) | `GameFluids` | Liquids in containers, streams, stains, drinking and item uses |
| [`@adatechnology/game-fluids-three`](packages/game-fluids-three) | `GameFluidsThree` | three.js renderer for the fluids world |
| [`@adatechnology/game-devtools`](packages/game-devtools) | `GameDevtools` | Free-fly mode, position HUD, notes and marks, control panel, scenarios runner and entity labels |
| [`@adatechnology/game-infection`](packages/game-infection) | `GameInfection` | Deterministic abstract epidemic model by regions (zombies, plague, rumours) |
| [`@adatechnology/game-props3d`](packages/game-props3d) | `GameProps3d` | Procedural low-poly props (decor, furniture, yard, house state) that only describe primitives through a host-provided api |
| [`@adatechnology/game-test-room`](packages/game-test-room) | `GameTestRoom` | First-person test room with a behaviour log and scenarios to verify destruction, weapons and fluids on your own catalogue |

Each package has its own README (English, with a short Portuguese section) and a `MIGRATION.md` mapping the old Portuguese names to the new
English ones, so the game adapter can be updated mechanically.

### Coming next

`@adatechnology/game-floorplan` (plus `-residential`, `-commercial` and `-post-apocalyptic`) is a placeholder: it will be migrated in a separate step
and does not exist in this repository yet.

## The layering rule

```
engine  ->  content packs  ->  genre packs  ->  game adapter
```

- **Engine** packages (camera, devtools, floorplan core, ...) are generic mechanics. They depend on nothing game-specific, and on three.js only as a
  peer dependency used for types.
- **Content packs** (props, floorplan-residential/commercial, ...) are data and builders for a kind of content. They may depend on engine packages.
- **Genre packs** (infection, post-apocalyptic, ...) carry the rules or flavour of a genre. They may depend on engine and content packs.
- The **game adapter** is not in this repository. It lives in the game, wires the packages together and holds everything that is specific to that
  game (names, texts, maps, tuning).

Dependencies only point to the left. A package never imports from a package to its right, and nothing in this repository may know about a particular
game. Only engine-agnostic code belongs here: if it names a game, a map or a character, it stays in the game.

## Working in the repo

Requires Node 20+ and pnpm (the version is pinned in `packageManager`; use `corepack enable`).

```sh
pnpm install
pnpm build        # tsup in every package: ESM + d.ts + IIFE
pnpm test         # vitest in every package
pnpm typecheck    # tsc --noEmit in every package
pnpm lint         # eslint
pnpm changeset    # describe a change for the next release
```

### Adding a package

1. Create `packages/<name>` (kebab-case, no `@adatechnology/` in the folder name), e.g. `packages/game-foo`.
2. Copy the `package.json`, `tsconfig.json` and `tsup.config.ts` of an existing package and adjust: name `@adatechnology/game-foo`, `description`,
   `repository.directory`, the IIFE `globalName` (`GameFoo`), and `peerDependencies` (only `three` if you use it at runtime; import it as a type).
3. Put the code in `src/` (exported from `src/index.ts`), tests in `tests/`, and write `README.md` (English; purpose, install, usage, API, and a short
   "Português" section at the end). If the code was ported from elsewhere, add a `MIGRATION.md` with a complete old-name to new-name table.
4. Keep `"type": "module"`, `publishConfig.access: "public"`, `"sideEffects": false` and the `exports` map.
5. Run `pnpm install`, then `pnpm build && pnpm test && pnpm typecheck && pnpm lint`.
6. Add a changeset (`pnpm changeset`), `minor` for a first `0.1.0`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the naming conventions.

## Releasing

Releases use [changesets](https://github.com/changesets/changesets): `pnpm changeset` per change, then `pnpm version:changeset` and
`pnpm publish:changesets`. Packages are public (`access: public`).

## License

MIT
