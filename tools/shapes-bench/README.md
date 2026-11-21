# shapes-bench (private tool)

Times every 3D builder of the kit in Node with three r160 and stub documents, and keeps a baseline so a change that makes a builder slower
fails CI. Spec: `specs/001-migracao-entregas-dos-times/design/T9-game-shapes-e-desempenho.md` §8.1.

```sh
pnpm --filter "@adatechnology/shapes-bench-tool..." run build
node --expose-gc tools/shapes-bench/dist/cli.js            # the table
node --expose-gc tools/shapes-bench/dist/cli.js --check    # fails on a regression
node --expose-gc tools/shapes-bench/dist/cli.js --update   # rewrites baseline.json
node tools/shapes-bench/dist/cli.js --baseline-from run.json  # baseline from another machine's run (the CI artifact)
```

## What is timed

| group | builders | how |
|---|---|---|
| `props3d` | the 57 types | `create().builders[type]` drawn through `createMeshApi` (quality high) and `finish()` |
| `household` | the 51 types | `createHousehold().build` through `createMeshApi`, `finish(spec)` |
| `items` | 24 models + 25 shapes | `buildItem` (model, or the simple shape) |
| `weapons` | the 99 models of `models.json` | `buildWeaponModelById` |
| `animals` | the 13 species | `createAnimalsThree().build` |
| `characters` | 12 people, 13 Bestiário bodies, 3 bakes, the instanced body | `createPersonBuilder().buildPerson`, `createBestBuilder().build`, `bakeBody`, `buildInstancedBody` |
| `vegetation` | the 18 plants of the module and the nursery | `item.build(THREE)` of `createVegetationTestModule`; `createNursery().plant` (seed 1) with colliders and walker |
| `urban` | 2 poles, a block, 2 props, the sample sheet | `createUrbanThree().draw(scene)` (the scene built once) |
| `houses` | the 7 typologies of the Visor (seed 3) | `create(THREE).build(plan, { quality: 'high' })` of `game-floorplan-three` (the plan drawn once) |
| `vehicles` | `compact_hatch`, `midsize_pickup`, `sport_bike` | `createVehiclesThree().build(key, { quality: 'lite' })` |
| `shapes` | the generators, the three namespace, a whole schema | `buildPrimitive` (cache cleared), `new T.CylinderGeometry`, `generate` |

## How

- Each builder is warmed up twice, then run until 100 ms or 200 runs (at least 5): the median is kept.
- The whole list runs 3 times (`--rounds`), after a collection per builder (`--expose-gc`); each builder keeps its best round.
- A calibration loop (trigonometry and typed arrays, no kit code) runs every 20 builders; its best time divides every median, so the ratios mean
  the same on a laptop and on a CI runner.
- `baseline.json` holds the ratios. A builder fails past `baseline × (1 + budget)` (budget 1, twice as slow; `overrides` per builder), is
  reported past `× 1.5` (`warn`), and is never failed under the noise floor (0.05 ms). A group of 8 or more builders fails when the sum of its
  ratios passes `× (1 + groupBudget)` (0.5). Builders over the warning, and every builder of a failing group, are timed 5 more rounds before
  the verdict.
- The CI job `shapes-bench` runs `--check`, writes the table to the job summary and uploads the run (`shapes-bench-run.json`).

Refresh the baseline (`--update`, or `--baseline-from` the CI artifact) in the commit that makes a builder faster or accepts a slower one, and
say why in the commit message.

## Baseline provenance

`houses/*` entries (2026-11-21): the median calibrated ratio of 20 CI runs (`shapes-bench-run` artifacts of runs 44853823865 to 44944445756, 2026-11-21, commits at or after `cd5113c71`; ids in `~/.cache/adatechnology-game-kit/medicoes/2026-11-21-shapes-bench-casas/ci-houses.json`), replacing the single fast CI sample of 2026-11-13 that made `pharmacy` and `apartment_basic` fail about one run in three. The houses are about 15% slower than on 2026-11-13 (local A/B, 5 alternated runs, group sum of ratios 387 to 444, every builder +9% to +26%) because wiring, pipe and drain runs became one piece per stretch (`ced4a5ed3`, `c69a17747`, `cd5113c71`); this was accepted on 2026-11-21 as the cost of new content. Known small waste left as a follow-up: `solidsOf` is rebuilt per run in `drains.ts`, `water.ts` and `electrical.ts`. Every other entry is unchanged.
