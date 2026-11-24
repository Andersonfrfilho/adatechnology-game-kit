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
  ratios passes `× (1 + groupBudget)` (0.5). A builder in a group of 5 or more (`peerMin`) fails only if it is also past the budget against the
  median change of the *other* builders of its group in the same run; otherwise it is a `warn`: a slow stretch of the runner moves a whole group
  (62 CI runs: 5 failed on one builder alone, 0 fail with this rule; a single builder made 2.5x slower is still caught in 90% to 100% of them,
  2.2x in 71% to 100%, the houses at the low end). A group with at least `peerMin` builders above the noise floor also fails when the median
  change of those builders passes `× (1 + groupMedianBudget)` (default `(groupBudget + budget) / 2`, i.e. ×1.75): this closes the 5–7 builder
  blind spot (`houses` and `urban`) when a shared slowdown hits most of the group while staying above the fast-runner shift (max median ×1.39 on
  the cached CI runs). Builders over the warning, and every builder of a failing group, are timed 5 more rounds before the verdict.
- The CI job `shapes-bench` runs `--check`, writes the table to the job summary and uploads the run (`shapes-bench-run.json`).

Refresh the baseline (`--update`, or `--baseline-from` the CI artifact) in the commit that makes a builder faster or accepts a slower one, and
say why in the commit message.

## Baseline provenance

`houses/*` entries (2026-11-21): the 25th percentile of the calibrated ratio over 20 CI runs (`shapes-bench-run` artifacts of runs 44853823865 to 44944445756, commits at or after `cd5113c71`; ids and values in `~/.cache/adatechnology-game-kit/medicoes/2026-11-21-shapes-bench-casas/ci-houses.json` on the measuring machine). The 25th percentile and not the median: CI is noisy on houses (`apartment_basic` ran from 38 to 81 on the same code), and a baseline at the median would move the fail line further than the slowdown justifies.

Why it moved: the houses are about 15% slower than on 2026-11-13 (local A/B of `337fcdedb` against main, 5 alternated runs, group sum of ratios 387 to 444, every builder +9% to +26%). The bisect puts it in two steps, around `ced4a5ed3`/`c69a17747` (wiring and pipe runs cut into one piece per stretch) and `cd5113c71` (drain and downpipe runs as pieces). That the cost is those extra pieces comes from reading the commits, not from timing each function. The owner accepted it on 2026-11-21 as the cost of new content.

What it does to the gate: the fail line (twice the baseline) moves from 74.8 to 86.7 for `apartment_basic` and from 52.7 to 68.6 for `pharmacy`, so a real slowdown of up to about 16% and 30% over the old baseline now passes there. Replayed over the 20 runs: the old baseline fails 2 runs and warns 13 times, this one fails 1 (`apartment_modern` at 139, which the old one failed too) and warns 7 times. `apartment_modern` goes down (68.2 to 59.2): its old value was a slow sample.

Known small waste left as a follow-up: `solidsOf` is rebuilt per run in `drains.ts`, `water.ts` and `electrical.ts`. Every other entry is unchanged.

## Cost of what is built (`--cost`)

Timing says how long a builder takes; the cost census says what its result costs to draw, every frame, for as long as it is on screen. Each
builder is run once and its result counted as `tools/kit-audit/cost.mjs` counts a piece in the room: one draw per mesh and material, one more
when the mesh casts a shadow, the triangles (times the copies of an instanced mesh) and the distinct materials. Hidden objects, meshes off the
camera layer (drawn inside a batch) and the lower levels of a `LOD` are left out. These are counts, the same on every machine, so there is no
noise and no calibration: the whole kit takes a few seconds. Besides the builders timed, it builds the rest of the fleet (`costOnlyEntries`).

```sh
node tools/shapes-bench/dist/cli.js --cost            # totals per group
node tools/shapes-bench/dist/cli.js --cost-check      # fails on a builder past its recorded cost (the CI job runs this)
node tools/shapes-bench/dist/cli.js --cost-update     # rewrites cost-baseline.json
```

`cost-baseline.json` holds the cost of every builder. `--cost-check` fails when a builder:

- has **no recorded cost** (a new piece): run `--cost-update` and commit the file, so the review sees what the piece costs;
- is **worse**: more draws or materials than recorded past `drawSlack` (10%, at least one more), or more triangles past `triangleSlack` (15%);
- is **over the draw limit of its group** (`limits`) and not accepted in `over`, or accepted and now above the draws accepted;
- is **gone** from the builders but still recorded.

`--cost-update` records the new builders and the cheaper ones, and prints every recorded cost it changes, before and after: that list goes in
the PR. It **refuses** to write anything when a builder got worse past the slack, went over the limit of its group or is gone; each of those
enters only by id, with `--cost-accept <id,id>`. So a cost that is meant is accepted by name, and no regression rides in with a new piece. A
piece accepted over the limit goes into `over`, where it may only go down. The limits are the 90th percentile of each group on 2026-11-23,
when 47 pieces were already over them; `urban` and `houses` are compositions and have no limit (their recorded cost still holds them).

A builder that returns geometries and no object (the baked bodies of the horde) counts one draw per geometry and its triangles. A small piece
may gain one draw without failing (1 to 2, 3 to 4): the slack never rounds to zero.

What it does not see: what a piece keeps hidden and shows later (the pipes inside a wall, shown when it breaks), the lights a piece brings (a light
that casts a shadow draws every caster again), the cost of a scene put together (how many pieces, what the batcher merges), the time of a frame, memory. Those are the
room's rulers (`tools/kit-audit/cost.mjs`, `tools/gpu/perf-gate.mjs`, `examples/test-room/leak.mjs`), which need a browser (CLAUDE.md §9).
