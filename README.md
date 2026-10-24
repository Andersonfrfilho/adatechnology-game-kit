# adatechnology-game-kit

Engine-agnostic building blocks for games, published under the `@adatechnology/` scope. Each package is small, typed, has no game-specific
knowledge and takes everything it needs (the `THREE` instance, a `document`, callbacks, data) from the host.

All packages ship ESM with type declarations, plus an IIFE bundle (`dist/index.global.js`) that exposes a browser global, so a game that
concatenates plain scripts can use them without a bundler.

## Packages

| Package | Global | What it is |
|---|---|---|
| [`@adatechnology/game-camera`](packages/game-camera) | `GameCamera` | Shoulder, third-person and first-person camera rig plus first-person viewmodel for three.js |
| [`@adatechnology/game-contracts`](packages/game-contracts) | `GameContracts` | The contracts every module depends on: destruction (`DestructibleImpl`, hits, events), shots, containers, item animations and `TestableModule`; types plus tiny checkers, no runtime deps |
| [`@adatechnology/game-destruction`](packages/game-destruction) | `GameDestruction` | Engine-agnostic destruction world: parts, joints, materials, damage, fire, melting, structural integrity |
| [`@adatechnology/game-destruction-three`](packages/game-destruction-three) | `GameDestructionThree` | three.js renderer for the destruction world: pieces, holes, cracks, fire and debris |
| [`@adatechnology/game-weapons`](packages/game-weapons) | `GameWeapons` | Arsenal of firearms, melee, fire, heat and tools with ballistics and tool state |
| [`@adatechnology/game-fluids`](packages/game-fluids) | `GameFluids` | Liquids in containers, streams, stains, drinking and item uses |
| [`@adatechnology/game-fluids-three`](packages/game-fluids-three) | `GameFluidsThree` | three.js renderer for the fluids world |
| [`@adatechnology/game-devtools`](packages/game-devtools) | `GameDevtools` | Free-fly mode, position HUD, notes and marks, control panel, scenarios runner and entity labels |
| [`@adatechnology/game-infection`](packages/game-infection) | `GameInfection` | Deterministic abstract epidemic model by regions (zombies, plague, rumours) |
| [`@adatechnology/game-audio`](packages/game-audio) | `GameAudio` | Sound as data: seeded recipes planned into sound plans, the teams' distance curves, pan, a voice limiter, loops and the game and art scene mixing chains |
| [`@adatechnology/game-weather`](packages/game-weather) | `GameWeather` | Pure seeded weather: states from clear to typhoon, climates in game time, lightning with thunder delay, ground wetness, sight and hearing effects, heat index, day and night |
| [`@adatechnology/game-player`](packages/game-player) | `GamePlayer` | Pure seeded player body: an attribute sheet, stamina, wounds and bleeding, the grab and breaking free, knock-downs, vaults, footstep noise, panic, shove and melee, an optional individual infection |
| [`@adatechnology/game-crowd`](packages/game-crowd) | `GameCrowd` | Pure seeded crowd as a struct of arrays: relevance bands, sight, hearing and smell, a sliced flow field, separation, attack slots, chain alerts, doors, piles against walls, abilities as type traits, corpses, population and migration |
| [`@adatechnology/game-props3d`](packages/game-props3d) | `GameProps3d` | Procedural low-poly props (decor, furniture, yard, house state) that only describe primitives through a host-provided api |
| [`@adatechnology/game-vehicles`](packages/game-vehicles) | `GameVehicles` | Procedural vehicle engine for three.js: bodies, glass, lights, interiors, zone-based damage in five bands, fluids, rollover, explosions and a damage-map UI; fleets and texts come from plugins |
| [`@adatechnology/game-vehicles-fleet`](packages/game-vehicles-fleet) | `GameVehiclesFleet` | Content pack for `game-vehicles`: 69 vehicles in ten groups (motorcycles to helicopters), fuels, group names, crash texts and five damage scenarios |
| [`@adatechnology/game-vegetation`](packages/game-vegetation) | `GameVegetation` | Deterministic procedural low-poly plants (trees, palms, shrubs, flowers, cacti, grasses, vines), LODs, scatter, lot merging and an optional three.js adapter with shader wind |
| [`@adatechnology/game-vegetation-species`](packages/game-vegetation-species) | `GameVegetationSpecies` | JSON content pack of 71 species (en / pt-BR) with regional planting tables for `game-vegetation` |
| [`@adatechnology/game-floorplan`](packages/game-floorplan) | `GameFloorplan` | Seeded procedural floor plans, lots, furniture slots, colour palettes, state plugins and urban zoning (engine), plus an offline 2D viewer |
| [`@adatechnology/game-floorplan-residential`](packages/game-floorplan-residential) | `GameFloorplanResidential` | Residential content for the floor plan engine: houses, apartments, furniture, decor, region `br` |
| [`@adatechnology/game-floorplan-commercial`](packages/game-floorplan-commercial) | `GameFloorplanCommercial` | Commercial content for the floor plan engine: market and pharmacy, commercial and industrial zones |
| [`@adatechnology/game-floorplan-post-apocalyptic`](packages/game-floorplan-post-apocalyptic) | `GameFloorplanPostApocalyptic` | Fortified and abandoned house states as a state plugin, with a configurable seed distribution |
| [`@adatechnology/game-floorplan-structure`](packages/game-floorplan-structure) | `GameFloorplanStructure` | Structure of every floor plan: construction systems, load path (roof, trusses, beams, pillars, walls, foundation, porches), destructible spec |
| [`@adatechnology/game-floorplan-three`](packages/game-floorplan-three) | `GameFloorplanThree` | three.js renderer of a floor plan (walls, doors, floors, stairs, roofs, lot, furniture, lights, mirrors, cars) bound to the destruction of its structure, plus the multi-floor navigator |
| [`@adatechnology/game-test-room`](packages/game-test-room) | `GameTestRoom` | First-person test room with a behaviour log and scenarios to verify destruction, weapons and fluids on your own catalogue |

Each package has its own README (English, with a short Portuguese section) and a `MIGRATION.md` mapping the old Portuguese names to the new
English ones, so the game adapter can be updated mechanically.

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

## Demo site

A static demo of the examples is built from `site/Dockerfile` and served by Caddy. Railway builds that Dockerfile on every push to `main` (see `railway.json`). The image runs `pnpm install --frozen-lockfile`, `pnpm build` and `node site/build-site.mjs`, which copies each example's self-contained HTML to `site/dist/<example>/index.html` and writes a landing page listing the examples and packages. To build it locally: `pnpm install && pnpm build && node site/build-site.mjs`, then serve `site/dist`.

## License

MIT
