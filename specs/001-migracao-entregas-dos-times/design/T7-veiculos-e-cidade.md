# Fase 7 — Veículos e cidade (desenho do architect/opus, 2026-10-24)

Perguntas do §7 decididas pelo padrão reversível (autopilot, 2026-10-24), listadas no PR.

## Summary

Phase 7 adds five packages, two content/data extensions and three test areas:

- **Vehicles (no new engine, plus three new packages):** `game-vehicles` gets the light mode hooks and the `damageables` API; `game-vehicles-fleet` gets `DIMS`, the paint palettes with colour by seed and the 69 design cards (`stats`); `game-vehicles-three` (new) fuses a vehicle into 6 meshes and carries the vehicles test module; `game-vehicles-driving` (new, no three) drives it, arcade first and then semi-simulation.
- **Vegetation:** `game-vegetation` takes the newer Viveiro (V8: piece geometry), `game-vegetation-species` gets `scatterRulesFor`, and `game-vegetation-three` (new) carries the vegetation test module.
- **City:** `game-urban` (new, no three) and `game-urban-three` (new): streets, sidewalks, the 5 poles, neighbourhood patterns, blocks, terrain (C3), and the composition of houses, vehicles and plants. The named valley stays in the game repository.
- **Camera:** `game-camera` takes the game's shoulder camera (V7): damping, FOV by zoom, death orbit, look shake, and the `smoothing` option is finally read.
- **Areas:** `examples/vehicles-test-area`, `examples/vegetation-test-area`, `examples/urban-test-area`; all three modules also load in `examples/interactables-test-area`.

Four findings shape everything else:

- **The Garagem artifact is the v4 site page, byte for byte, in code.** The 14 files of `artefatos/Xy9QydZTRyAfwxRMjzh1aT/` differ from the `<script>`s of `sources/veiculos__garagem.js` only by blank separator lines (3 per file). The "7,616 different lines" in `fontes.md` came from the artifact being split in files and the site being one page. So V2's premise ("new fleets of planes, boats, helicopters and military that the SDK lacks") does not hold: `game-vehicles-fleet` already registers the same 69 vehicles in the same 10 files (`planes-extra`, `boats-extra`, `helicopters-extra`, `military` and the others). T7.0 proves it with a table of 69 × 3 states, and nothing is ported for V2 except what really is missing (below).
- **What the Frota Leve really adds is smaller than the inventory said:** 13 `[LOD]` lines (5 in the core, 8 in family copies of `resample`, `sloft` and the loft tube), the `skipJogo` wrapper of 7 functions, the 6-class fusion, `DIMS`, the palettes and the `danificaveis` collector. Light mode is a build flag plus a post-pass, not a second fleet.
- **The team already wrote the vehicles test module against the SDK** (`sala-veiculos:43114-43407` calls `GameVehicles` and `GameVehiclesFleet`), so its golden runs the page's own module code on the SDK room and compares the event log with the TypeScript port.
- **Viveiro: the artifact is newer than the site in every difference** (V8). The 106 extra lines are real engine work (piece geometry `radius/length/axis/base` in `game-vegetation`, real wood thickness and tilt in the module, `hp 25` for the pot); the 19 lines the artifact lacks are older wording of the same lines. The union is the artifact.

## 1. Source map

Anchors: **G** = `artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js` (the current game); **FL** = `sources/veiculos__frota-leve.js`; **GAR** = `artefatos/Xy9QydZTRyAfwxRMjzh1aT/`; **SV** = `sources/veiculos__sala-de-testes__sala-veiculos.js`; **VIV** = `sources/vegetacao__viveiro.js` (site) and `artefatos/Bs3p84TFhG1A9YfdXSGZaQ.html` (newer); **GAL** = `sources/mapa__galeria-vale-cinzento.js`; **JA** = `sources/jogo__zombiada-jardim-aurora.js`; **FROTA** = `artefatos/3FqnqNJrEc4jLgAAvjGmnp.html` and `sources/veiculos__frota.js`.

| Team piece | Source (file:lines) | Destination |
|---|---|---|
| Light mode flag `LOD` (`on, fr, nb, sub, caixaPlana, segMin, lofSeg, estMin, estFr, grade, skipMats`) | FL 65; G 47568 (same) | `game-vehicles/src/lod.ts`: `kit.lod` (settings, all configurable) |
| `[LOD]` hooks in the core: flat box, fewer rounding rings, bigger subdivision triangles, fewer stations, fewer loft segments | FL 232, 233, 257, 1205, 1221 | `game-vehicles/src/geometry.ts`, `warp.ts` (`if (kit.lod.on)`) |
| `[LOD]` hooks in family copies (`resample`, `sloft`, tube rings `na/nu`) | FL 4243, 4269, 4300, 10450, 10499, 11294, 11320, 11351 | `game-vehicles-fleet/src/vehicles/{motorcycles-cars,motorcycles-extra,water-air}.ts` and the other loft copies the T7.1a grep finds |
| `skipJogo` wrapper of `interior, engineBay, seat, dashboard, steeringWheel, yoke, busRows` and `skipMats` | FL 14155–14170 | `game-vehicles` kit creation (`skipLite` on the meshes a call adds in light mode) |
| `three` r160 wrapper: `CanvasTexture` in sRGB, generators with fewer segments | FL 21–64 | `game-vehicles` (`colorSpace` on text and plate textures when it exists) and the light mode settings |
| `DIMS`: L × W × H of the 69 | FL 14171 | `game-vehicles-fleet/src/data/dims.json` by SDK id (through `legacyVehicleSeeds`) |
| `PALETA`, `PALETA_MIL`, `corDaSemente`, `mulberry`, `hashStr` | FL 14172–14192 | `game-vehicles-fleet/src/paint.ts`: `paintPalettes`, `colorFromSeed` |
| Fusion into 6 meshes (`pintura`, `acabamento`, `metal`, `vidro`, `luz`, `placa`), `classificar`, `corClasse`, `materiaisJogo`, prune under 3 cm | FL 14208–14310 | `game-vehicles-three/src/lite/*` (literal port) |
| `criarApi.construir` (output frame +z front, -x right, centred, ground at 0, `tris`, `drawCalls`, `L W H`, `liberar`) | FL 14311–14442 | `game-vehicles-three/src/lite/build.ts` |
| `coletarDanificaveis`, `tipoDaZona`, `marcarAlta` | FL 14406–14442 | `game-vehicles/src/damageables.ts` (`kit.damageables(c, matrix?)`) + the output-frame call in `-three` |
| Plugin of the game: `FUELS`, `GROUPS`, `PART_FX`, `ZONE_FX`, `FLUIDS` (zombie blood), `SCENARIOS` (horde), `frontBloodFx`, `hordeFx`, plate `ZMB4D23` | GAR `zombiada/plugin.js`; site 3998–4207 | `game-slice/vehicles/` (goes to the zombiada repo, G2); the generic parts (fuels, groups) are already in `game-vehicles-fleet` |
| Design cards: 69 × `{ g, n, c, d, insp, s[6], r, seats, tank, eff, fuel, auto, vmax, tags }`, noise radius `r`, `vmax` km/h | FROTA 6–1806 (`fleet` array) | `game-vehicles-fleet/src/data/stats.json` by SDK id; names and prose in the `en`/`pt-BR` locale |
| Arcade car: accel 5.5, brake 12 against motion, reverse 3, drag `exp(-0.5 dt)`, handbrake `exp(-3 dt)`, clamp -5..17 m/s, steer lerp `min(1, 5 dt)` to ±0.55, yaw `steer·v/2.6·dt`, 8-point corner collision, crash damage `sp·9` above 4 m/s, bounce ×-0.25, noise `25 + 2·sp` m, horn 120 m | G 70188–70290 `CAR`, `carCorners`, `carBlocked`, `carUpdate` (identical to JA 58616–58715 except the slice objective) | `game-vehicles-driving/src/arcade.ts` |
| Run-over: above 3 m/s knocks down (`hp -= sp²·2.5`, speed ×0.93), above 8 m/s kills and tears off, below 3 the horde holds the car (`v ×= exp(-2.5 dt)`) | G 70233 (loop on `Z`) | `game-vehicles-driving/src/run-over.ts` (pure, bodies come in by hook) |
| Semi-simulation: single rigid body, per-wheel raycast spring and damper, simplified tyre friction (longitudinal and lateral apart), automatic gearbox with simulated RPM, handbrake locks the rear wheels, surfaces (dry asphalt 1.0, wet 0.75 with aquaplaning above 90 km/h, dirt 0.65, grass 0.55, mud 0.4 and bogs without 4x4, blood and bodies 0.5), damage changes steering, consumption by RPM, load and engine state, run-over energy `0.5·m·v²` | FROTA text, section 03 · Condução e física, section 08 | `game-vehicles-driving/src/semi/*` (no team code exists: the document is the source) |
| Garagem app: stage, viewer, contact sheet, fuels table, `hitAt` | GAR `zombiada/app.js` (505 lines), site 14186–14693 | Not ported as an app: the viewer is `examples/vehicles-test-area`; the contact sheet is left as a question (7.3) |
| Vehicles test module: 8 items, 11 scenarios (`veiculos_9mm_parabrisa` … `veiculos_derreter`) | SV 43114–43407 | `game-vehicles-three/src/test-area/*` (literal port, English ids) + `examples/vehicles-test-area` |
| Viveiro newer engine: `tubes`, `pieceGeom`, `WOOD_KINDS`, `pieceGeometry` (radius, length, axis, base of each wood piece) | VIV artifact `GameVegetation` 328–329, 664, 743, 2765, 3710, 3770–3773, 3904–3990 | `game-vegetation/src/generate.ts`, `ctx.ts`, `types.ts` (piece `radius/length/axis/base`) |
| Viveiro newer module: young mango radii 0.1 / 0.17, real wood thickness and tilt, rotated bounds, pot `hp 25`, scenario `shot_breaks_pot` | VIV artifact `vegetation-module.js` (diff of 24 hunks against the site) | `game-vegetation-three/src/test-area/*` |
| `DEFS` (18 items), `buildObject`, `buildSpec`, `swayClip`, 13 scenarios `veg_*` | VIV 22960–23597 (site) / artifact script 5 | same |
| `rulesFor` (picks by context, drops vines, drops big trees in the front yard, splits trees / hedges / medium / ground, scatter rules) and the plot `AREAS` | VIV 77936–77963 | `game-vegetation-species/src/rules.ts`: `scatterRulesFor(region, context, seed, options)` |
| Lot demo (`LOT 12×20`, house, walls, path, `WAY`, walker that bends plants) | VIV 77910–78043 | the "nursery" area of the vegetation module (kept as a layer, see 4) |
| 5 poles: `poleLED` (9 m, double arm, white LED), `poleConcrete` (8 m, arm, sodium, optional transformer), `poleIron` (4 m, conical cap), `poleWood` (7 m, crossarm), `floodTower` (12 m, 3 floodlights); light budget `LB` | GAL 1126–1130 | `game-urban/src/poles/*` (data generators) |
| `road` (dashed centre line every 5 m), `walk` (0.15 m), `ground`, `streetGrid(B, n, rw)`, `fillBlock(cx, cz, size, hmin, hmax, pal, o)`, `FAC`, `building`, `windowsOn` | GAL 192–194, 185–187, 348–352 | `game-urban/src/streets.ts`, `block.ts` (`building` and `windowsOn` already exist in `game-floorplan/src/silhouettes`) |
| Neighbourhood patterns: 9 cells + military, each with typology, street width, pole, light colour, spacing | GAL 1143–1205 `buildPadraoRuas` | `game-urban/src/neighbourhoods/*`: schema + 10 default patterns (English ids); labels in locale |
| Terrain: `hW`, `dPoly`, `nearRiver`, `inBrejo`, `inQueimada`, `inRect`, `forestF`, `W2`, `buildWorld` (180×180 grid over 320 m, vertex colours) | GAL 240–330 | `game-urban/src/terrain/*` generic; the valley data (`RIOS`, `LAGOS`, `ESTRADAS`, `CITIES`, `VILLAGES`, `TRILHAS`) → `game-slice/urban/` |
| House typologies as far LOD (`sobrado`, `laje`, `colonial`, `chalet`, `companyHouse`, `stilt`, `farmhouse`, `house`, `building`) | already in `game-floorplan/src/silhouettes` (T2.5a) | reused by `game-urban`, not copied |
| Scene car, bus, container, watch tower, tent, pine, tree, fence, sandbags of the sample | GAL 169–184, 559 (`watchtower`), `container` | `car` and `bus` are replaced by the real vehicles through the composition hook (inventory item 32); `fence`, `tent`, `pine`, `tree`, `container`, `watchtower` are in `game-urban/src/props/*` as data generators on the silhouette vocabulary |
| Shoulder camera: damped distance / side / height (`1 - exp(-12 dt)`), FOV `65 / zoom` smoothed by `min(1, 12 dt)`, look sensitivity `0.0022 / √zoom`, three-ray wall collision with slow recovery (`1 - exp(-4 dt)`), death orbit radius 6 height 3.5 speed 0.2, fever and panic look shake | G 69043–69085 `cameraUpdate` (identical in JA 57480) | `game-camera/src/camera.ts` |

**Where the version of the team wins** (one line per piece): the game's `cameraUpdate` over `game-camera`'s (it damps; ours does not read `smoothing`); the Frota Leve over the SDK for the light mode; the artifact over the site for Viveiro; the SDK over the Garagem for the engine, the fleet and the zone damage (same scene hash, V2 table); the SDK over `AdaptadorInterativos` and the valley's house massing (stay as they are).

## 2. Packages, types and dependencies

```
game-contracts ← game-vehicles ← game-vehicles-fleet
                               ← game-vehicles-three  (three peer; optional: game-test-room only as a dev dependency)
               ← game-vehicles-driving                 (no three; fleet stats come in by option)
game-vegetation ← game-vegetation-species (+ rules.ts)
               ← game-vegetation-three               (three peer)
game-floorplan, game-vegetation, game-vegetation-species ← game-urban (no three) ← game-urban-three (three peer)
game-camera (no new dependency)
```

There are no cycles. `game-urban` imports `game-floorplan` (silhouette vocabulary and the 9 typologies) and `game-vegetation`/`-species` (`scatter`, `scatterRulesFor`); vehicles and houses come in as **providers** (options), so the engine knows no fleet and no plan template. Content stays in registries (`mergeById`/`applyPatches` from contracts) with `packs`/`patch`/`remove`.

**`game-vehicles`** (minor):

```ts
interface LodSettings { on: boolean; fr: 0.5; nb: 1; sub: 2.2; flatBox: 0.22; minSegments: 14; loftSegments: 0.45; minStations: 20; stationFraction: 0.55; grid: 2.6 }   // = FL 65, every number overridable
createVehicleKit({ lod?: Partial<LodSettings> })      // kit.lod
kit.build(key, state, zoneState?, { lod?: boolean })  // lod:true sets kit.lod.on for that build only
kit.damageables(c, matrix?): Damageable[]             // { material:'metal'|'glass'|'rubber'|'fuel', zone, part, side:'center'|'left'|'right', box }
```

With `lod.on` false nothing changes, so every existing golden stays byte-identical. The kit wraps `interior`, `engineBay`, `seat`, `dashboard`, `steeringWheel`, `yoke` and `busRows` once, as FL 14155 does, to mark `userData.skipLite`.

**`game-vehicles-fleet`** (minor): `fleetDims(id)`, `paintPalettes` (`civil` 13 weighted colours, `military` 5), `paletteOf(group)`, `colorFromSeed(seed: number | string, palette)`, `fleetStats(id)`. All three are data files with the page ids mapped through `legacyVehicleSeeds`.

**`game-vehicles-three`** (new):

```ts
createVehiclesThree(THREE, { kit, document? }): VehiclesThree
vehicles.build(key, { quality: 'high' | 'lite', seed?, color? }): BuiltVehicle   // { group, damageables, tris, drawCalls, length, width, height, dispose() }
createVehiclesTestModule({ locale, kitFor, fleetItems, ... }): TestableModule
```

`quality: 'high'` returns the kit's vehicle in the page's output frame (+z front, centred, ground at 0, the pivot matrix of FL 14335), recoloured through the primary paint; `'lite'` runs the 6-class fusion. The colour comes from `color` or, when absent, `colorFromSeed(seed, paletteOf(group))`.

**`game-vehicles-driving`** (new, no three):

```ts
createArcadeDriver(o?: Partial<ArcadeSpec>): Driver     // spec defaults = G 70188–70290; every number an option
createSemiSimDriver(o: SemiSimSpec): Driver              // spec from fleetStats + mass + wheels
driver.step(input: { throttle, brake, steer, handbrake }, dt, world: DrivingWorld): DriverState
DrivingWorld { blocked(x, z, yaw): boolean; bodiesAt?(...): Body[]; ground?(x, z): { height; normal; surface } }
runOver(speed, body, rules): RunOverOutcome   // 'push' | 'knock' | 'kill'; thresholds 3 and 8 m/s are options
surfaces: Record<string, { grip: number; ... }> // registry; the document's table is the default
```

The driver emits events through `onEvent` (`crash`, `run_over`, `noise`), never touching a game. Damage coupling (flat tyre pull, engine under 30 %) reads a `VehicleCondition` object the host fills from `kit.zoneOverall` or from `createVehicleDestructible`.

**`game-vegetation-species`**: `scatterRulesFor(region, context, seed, options)` returns `{ rules, picks }` exactly as `rulesFor` (VIV 77943), with the large-tree rule, the 60 draws, the vine drop and the four groups as options.

**`game-vegetation-three`** (new): `createVegetationTestModule({ GameVegetation, GameVegetationSpecies, locale })` (DEFS, `buildObject`, `buildSpec` with real wood thickness, `swayClip`, 13 scenarios), plus the nursery layer.

**`game-urban`** (new):

```ts
createUrban(o?: { packs?; patch?; remove?; lights?: { budget: number } }): UrbanKit
kit.poles.get('led_double' | 'concrete_arm' | 'cast_iron' | 'wood_crossarm' | 'flood_tower').build(builder, { x, z, on, ry, flicker? })   // parts on the silhouette vocabulary
kit.streets.road(...), .walk(...), .grid({ block, count, width })
kit.block.fill({ cx, cz, size, minHeight, maxHeight, palette, k, gap, lit, shop }, rng)
kit.neighbourhoods.get('suburb').compose(rect, rng, providers): UrbanPlan   // street, walks, lots, poles, wires, labels
kit.terrain(options): Terrain  // heightAt(px, py), classify, mesh data (positions, colours) for a grid
kit.compose(plan, providers: { house?, vehicle?, plant? }): Placement[]    // data only
```

A `NeighbourhoodPattern` is data (`id`, `streetWidth`, `walkWidth`, `typologies[]`, `pole`, `lightColor`, `spacing`, `lit`, `burnt`) plus a `compose` key into a registry of composers, so a game replaces a number or a composer without touching the core. The default pack has 10 patterns: `downtown`, `suburb`, `working_class`, `historic_street`, `industrial_port`, `railway_village`, `mountain_resort`, `stilt_village`, `rural`, `military`. The terrain takes `base`, `layers` (`flatten` rectangles, `rivers`, `lakes`, `custom(px, py, h)`), `classify` and `seed`; the valley's numbers are not in the package.

**`game-urban-three`** (new): `createUrbanThree(THREE, { document? })` draws parts, windows (instanced, lit and dark), signs (canvas), roads, terrain meshes with vertex colours, and takes `providers` for houses (far LOD silhouettes by default; a `game-floorplan-three` house when it exists), vehicles (`game-vehicles-three` lite) and plants (`game-vegetation` lot). `createUrbanTestModule`.

**`game-camera`** (minor): new config `smoothing` (read), `aim: { fov, zoomPower, sensitivity }`, `wallRecovery: 4`, `deathOrbit: { radius, height, speed }`, `shake`; `update` takes `zoom`, `alive`, `deathT`, `time` and sets `cam.fov` when the camera has one; `lookSensitivity(zoom)` and `lookShake(...)` helpers. `smoothing: 0` is the old instant behaviour.

## 3. Goldens and RNG replacement

**Mechanism.** The same as Phase 4: pure logic is cut from the page with `cut-literal` and run in `node:vm` with the seeded RNG passed in; scenes are hashed with `golden-tool`; the Frota Leve and the Garagem run in Node on three r128/r160 with the repo's fake canvas (`tests/helpers/fake-dom.ts`), because they never touch WebGL. `installPortableMath` is on (the lofts use `pow`).

| Golden | Capture | Records | SDK side |
|---|---|---|---|
| G-garage | `tools/vehicles-catalog compare`: run GAR (artifact), the site v4 `<script>`s and the SDK in Node; 69 vehicles × intact / damaged / modified + the 5 scenarios | per vehicle and state: object count, vertex hash, material hash; a table of equal / different | `comparacoes/veiculos/README.md` + `game-vehicles-fleet` goldens untouched |
| G-fleet-regression | the existing `golden.json` (868 tests) | unchanged | must stay identical after T7.1a |
| G-lite | FL `FrotaLeve.criar({THREE}).construir(k, {qualidade, semente})` in Node (three r160): `hatch`, `seda`, `picape`, `onibus`, `leopardo`, `moto`, `blackhawk`, `trator` + one per group | tris, draw calls, `L W H`, per-class vertex count and position hash, pruned count, `danificaveis` boxes | `vehicles-three` `lite` |
| G-lod-high | FL `alta` against the SDK `high`: tris 193,908 for `hatch` and the object hash | the same hash with `lod.off` | `game-vehicles` |
| G-dims | cut `DIMS` from FL | 69 × L W H against the SDK vehicle measured in the output frame (1 mm) | `fleetDims` + measured box |
| G-colour | cut `corDaSemente` / `PALETA` / `PALETA_MIL`, seeds 0–499 and 40 strings, civil and military | colour hex | `colorFromSeed` |
| G-damageables | FL `coletarDanificaveis` on the 8 vehicles | list of `{ tipo, zona, parte, lado, caixa }` | `kit.damageables` + frame matrix |
| G-stats | cut `fleet` from FROTA | 69 × s[6], r, vmax, seats, tank | `fleetStats` (`--check`) |
| G-arcade | cut G 70233 `carUpdate` kinematics with stubs (`solidAt`, `Z`, `exploDamage`, `emitNoise`, `fxBlood`) and a scripted input (full throttle 6 s, brake, reverse, handbrake, steering sweep, wall hit, run-over of 3 bodies at 2, 5, 10 m/s) | per 1/60 s step: x, z, yaw, v, steer; events (crash, noise, kill, knock) | `createArcadeDriver` with the game's defaults: exact |
| G-semi | none exists | the document's numbers as tests: grip table, aquaplaning above 90 km/h, braking distance falls with grip, handbrake locks the rear, mud bogs a 2WD, energy `0.5·m·v²` and `perda_vel` | tests only (no golden claimed) |
| G-veh-module | run SV `MODULO_VEICULOS` (the page's own script) against the SDK room in vitest; record the event log of the 11 scenarios | event types and counts, pass / fail of each `expect` | the TypeScript module: same log |
| G-veg-pieces | run the VIV artifact `GameVegetation` bundle in Node (`generate(...).pieces`) for `mango_tree`, `coconut_palm`, `araucaria`, `mandacaru`, `prickly_pear`, `crown_cactus`, `banana_with_bunch`, `potted_fern` × seeds 1–5 | piece id, kind, parent, radius, length, axis, base | `game-vegetation` |
| G-veg-module | run the VIV artifact `vegetation-module.js` against the SDK room; record the 18 specs (parts, joints, shapes) and the 13 scenarios | spec hash per item, scenario log | the TypeScript module |
| G-rules | cut `rulesFor` (VIV 77943) and run it with the SDK species; 4 `AREAS` × seeds 1–20 × both `noLarge` | `rules`, `picks` | `scatterRulesFor`: exact |
| G-poles | Chrome recorder on GAL with `--expose` (`poleLED`, `poleConcrete`, `poleIron`, `poleWood`, `floodTower`, `road`, `walk`, `streetGrid`, `fillBlock`, `building`, `rng`, `R`, `root`, `LB`) | scene hash per case (lit and dark, rotated, with transformer) | `game-urban` parts drawn by `urban-three` |
| G-padrao | the same recorder, `buildPadraoRuas` with `car` stubbed in the page (its `R` draws are accounted for) | scene hash of the 10 cells | `neighbourhoods.compose` with the same seed |
| G-terrain | `node:vm` on GAL 240–275 with the valley data: `hW` over a 64×64 grid and `forestF`; Chrome for `buildWorld` vertex positions and colours hash | heights, colours | `terrain` configured with the valley data (fixture; copy in the game slice) |
| G-camera | cut G 69043 `cameraUpdate` with stubs (`worldRay`, `player`, `view`, `ARMAS`, `camera`); scripted: walk, aim, swap shoulder, crouch, wall, death, fever, panic | camera position and FOV per frame | `game-camera` with `smoothing: 12` and the game preset: exact |

**RNG by source.**

| Source | RNG use | Golden |
|---|---|---|
| FL | none (hash and `mulberry` by seed); the vehicles use the SDK seeds | exact |
| G `carUpdate` | none | exact |
| G `cameraUpdate` | one `R()` in panic shake, passed in | exact |
| VIV module | `SEED = 3` fixed, no `Math.random` | exact |
| VIV `rulesFor` | seed string into the SDK's `pickForContext` | exact |
| GAL | `R = rng(7)` global shared by every builder, drawn in the order of the page | exact when `R` is reset per case, as the silhouette golden does |
| FROTA doc | none (no code) | not applicable |

## 4. Test areas

All three modules live in their `-three` package (CLAUDE.md §4), and the examples only load them.

**vehicles-test-area** (`?area=vehicles`, global `VehiclesArea`)
- **Items:** the 8 of the page (`hatch`, `sedan`, `pickup`, `sport_bike`, `box_truck`, `city_bus`, `battle_tank`, `attack_helicopter`), each with its own `DestructibleImpl` and the door / hood / trunk clips.
- **Scenarios:** the 11, literal, with English ids (`vehicles_9mm_windshield`, `vehicles_shotgun_door`, `vehicles_ram_front`, `vehicles_engine_fire`, `vehicles_fuel_tank`, `vehicles_unbolt_wheel`, `vehicles_tear_bumper`, `vehicles_break_mirror`, `vehicles_kill_battery`, `vehicles_rollover`, `vehicles_melt`); the page ids stay as aliases in the report. Two added for this phase: `vehicles_drive_arcade` (the arcade driver on a lane that ends in a wall) and `vehicles_drive_semi` (braking on dry, wet and mud).
- **Bench:** quality (`high` / `lite`), colour seed, palette, driving mode (arcade / semi), surface; actions: repaint, drive the scripted lane.
- **Layers:** damageable boxes by material, zones, the output-frame axes.
- **Metrics:** triangles, draw calls, `L W H` against `DIMS`, damageables by material.

**vegetation-test-area** (`?area=vegetation`, global `VegetationArea`)
- **Items:** the 18 of the page; **scenarios:** the 13 `veg_*`, literal.
- **Bench:** species, seed, condition, season, wind; actions: plant the nursery lot (`scatterRulesFor` over the 12×20 m plot with the house, walls and path), start the walker that bends plants.
- **Layers:** collider, pieces, wood axes (the new `radius/length/axis`).
- **Metrics:** triangles per LOD, pieces, draw calls of the lot.

**urban-test-area** (`?area=urban`, global `UrbanArea`)
- **Area:** the 10 neighbourhoods in a 3×3 grid plus the military cell, the 5 poles in a row, a street grid with a block, a terrain patch.
- **Bench:** pattern, seed, hour (lights), burnt-out share, providers (silhouettes / real house; no cars / lite cars; no plants / lot).
- **Layers:** light budget, lots, pole radius.
- **Metrics:** draw calls, triangles, real lights, instances.
- **Scenarios:** pole heights and light colours, street dashes every 5 m, block heights by `pow(R, 1.6)`, neighbourhood determinism, terrain heights at the valley fixture points, composition counts (houses, cars, trees).

**interactables-test-area** (owner rule): `entry.js` also loads the three modules; `build.mjs` checks their bundles; the cross scenario `car_in_the_yard` puts the lite sedan beside the house furniture and shoots its door with the 7.62, checking that the door part loses hit points while the fridge world is untouched; the site `catalog.mjs` gets the three areas and their thumbnails.

## 5. Tasks (ordered; model; parallel group)

| # | Task | Model | Group |
|---|---|---|---|
| T7.0 | `tools/vehicles-catalog` (extractors for `DIMS`, palettes, `fleet` cards, plugin slice, `--check`), the Node harness that runs GAR, the site v4 and the SDK, `comparacoes/veiculos/` with the 69 × 3 table, `game-slice/vehicles/` | sonnet | A |
| T7.1a | `game-vehicles`: `kit.lod`, the 5 core hooks, `skipLite` wrapper, `colorSpace`, `kit.damageables`; `game-vehicles-fleet`: the 8 family hooks; fleet goldens identical | sonnet | B (after T7.0) |
| T7.1b | `game-vehicles-fleet`: `fleetDims`, `paintPalettes`, `colorFromSeed`, `fleetStats`; G-dims, G-colour, G-stats | haiku | B ‖ a |
| T7.1c | `game-vehicles-three`: fusion in 6 meshes, output frame, `quality`, `colorFromSeed`; G-lite, G-damageables, G-lod-high | sonnet | C (after a, b) |
| T7.1d 🧠 | `game-vehicles-driving` arcade: `createArcadeDriver`, run-over, noise; G-arcade | **opus** | B ‖ |
| T7.1e 🧠 | semi-simulation: surfaces registry, suspension, tyre, gearbox, damage coupling, consumption; document-number tests | **opus** | D (after d) |
| T7.1f | vehicles test module, `examples/vehicles-test-area`, G-veh-module, wiring, `interactables-test-area` | sonnet | E (after c, d) |
| T7.2a | `game-vegetation` V8 merge (piece geometry); `comparacoes/vegetacao/`; G-veg-pieces | sonnet | A ‖ |
| T7.2b | `scatterRulesFor`; G-rules | haiku | A ‖ |
| T7.2c | `game-vegetation-three` test module (artifact version), nursery layer, `examples/vegetation-test-area`, G-veg-module, wiring | sonnet | F (after a, b) |
| T7.3a | `game-urban`: poles, streets, block, props, light budget; G-poles | sonnet | A ‖ |
| T7.3b | neighbourhood schema + 10 patterns; G-padrao | sonnet | G (after a) |
| T7.3c | terrain (C3) with the valley data in the game slice; G-terrain | sonnet | A ‖ |
| T7.3d | composition (houses, vehicles, plants as providers) | sonnet | H (after b, T7.1c, T7.2b) |
| T7.3e | `game-urban-three`, urban test module, `examples/urban-test-area`, wiring | sonnet | I (after c, d) |
| T7.4 | `game-camera`: damping, FOV by zoom, death orbit, shake, `smoothing` read; G-camera | sonnet | A ‖ |
| T7.5 | inventory (R5), `evidence.md` Phase 7, skills not yet written, changesets, README of each package | haiku | last |

**Order.** A runs in parallel because nothing in it needs SDK code; B and C follow T7.0; the areas come last. Inside this execution the tasks run one after the other, one commit each, in this table's order, with the gates of `tasks.md` before each commit.

**Wiring (lesson from PR #21).**
- `site/Dockerfile`: COPY the `package.json` of the 5 new packages, the 3 examples and `tools/vehicles-catalog`.
- `site/build-site.mjs`: examples build after `test-room` (no change in the order logic; the new examples are picked up by directory).
- `site/catalog.mjs`: the three areas, the families `vehicles`, `vegetation`, `urban`, thumbnails.
- `.github/workflows/ci.yml`: the three `build.mjs` and `test.mjs` lines.
- IIFE globals: `GameVehiclesThree`, `GameVehiclesDriving`, `GameVegetationThree`, `GameUrban`, `GameUrbanThree`, `VehiclesArea`, `VegetationArea`, `UrbanArea`.
- three as a peer dependency (`>=0.128.0` for `game-vehicles-three`, because the kit is tested on r128 and the Frota Leve was written for r160; both versions are tested); `@adatechnology/golden-tool` as a devDependency.
- Changesets: 5 new packages at 0.1.0; `game-vehicles`, `game-vehicles-fleet`, `game-vegetation`, `game-vegetation-species` and `game-camera` minor.
- 5 `SKILL.md` under `.claude/skills/` and the updates of the 4 existing ones.

## 6. Open points found while reading

1. The Frota Leve page is not among the 27 artifacts (`fontes.md`); its code is on the site page and embedded in the game (G 47512–61900, same code). Its golden therefore runs from `sources/`, in Node.
2. `DIMS` of the Frota Leve are the `alta` output measured by the team. They are the golden for "same measurements"; a vehicle that the SDK draws 1 mm different is a finding, not a tolerance.
3. The Garagem contact sheet and `hitAt` click-to-crash are viewer features. The SDK already has `kit.impact` and the damage map; the contact sheet (thumbnails with a `localStorage` cache) is the part left without a destination.

## 7. Business questions (each default is reversible)

1. **Arcade or semi-simulation as the default driver.** The document asks for semi-simulation and the game ships arcade. *Default:* both exist (V4); `createArcadeDriver` is what the examples and the game slice use first; the semi driver is opt-in. One line in the example.
2. **Quality names.** The page says `jogo` / `alta`. *Default:* `lite` / `high` in code, `Leve` / `Alta` in the pt-BR locale.
3. **The Garagem contact sheet.** *Default:* not ported; the test area shows the same fleet through the item list. Say if you want the sheet as an example.
4. **Neighbourhood patterns as SDK content.** The 10 patterns use real-world kinds (downtown, suburb, industrial, rural) with the numbers of the Galeria (25 m LED, 35 m sodium, 20 m cast iron, 60 m floodlights, 40 m military), so a GTA-style game gets them for free. *Default:* in the SDK, English ids; the valley names stay in the game slice. The military cell is generic (watch towers, red lamp, sandbags, tents) and ships too; the zombie checkpoint does not.
5. **Light budget.** The Galeria spends 16 real point lights per scene (`LB = 16`). *Default:* `lights.budget` option, 16; the lamp that does not get a real light keeps the emissive lens.
6. **Valley terrain data.** The 4 rivers, 4 lakes, 10 roads, 3 railways, 5 cities and 14 villages are the valley. *Default:* they go to `game-slice/urban/`; the SDK test uses them as a fixture only.
7. **Plugin of the game for vehicles** (zombie blood, horde scenario, plate `ZMB4D23`, 14 zone texts). Question 1 of the old inventory. *Default:* `game-slice/vehicles/` as a source file for the zombiada repository, as G2 says.
8. **Cars of the street sample.** The Galeria draws its own box cars. *Default:* replaced by the lite fleet through the provider (inventory item 32); the golden stubs `car` in the page and says so.
9. **Camera look shake with the host's RNG.** The game uses its global `R`. *Default:* `shake` takes a `random` option; no `Math.random` in the package.
10. **Light mode three version.** The kit runs on r128 in its tests and the Frota Leve on r160. *Default:* the lite builder is tested on both; the package peer range is `>=0.128.0`.

## References

- `S/artefatos/Xy9QydZTRyAfwxRMjzh1aT/` (Garagem), `S/sources/veiculos__garagem.js`, `veiculos__frota-leve.js` (code 14155–14442), `veiculos__frota.js`, `veiculos__sala-de-testes__sala-veiculos.js:43114-43407`, `vegetacao__viveiro.js:22960-23597,77696-78256`, `mapa__galeria-vale-cinzento.js:149-194,236-356,1126-1205`, `jogo__zombiada-jardim-aurora.js:57480,58616-58715`.
- `S/artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`: `cameraUpdate` 69043, `CAR` 70188, `carUpdate` 70233, FrotaLeve 47512–61900.
- `S/artefatos/Bs3p84TFhG1A9YfdXSGZaQ.html` (Viveiro, newer than the site).
- `packages/game-vehicles-fleet/tests/team-golden.test.ts`, `tests/helpers/golden.ts`; `packages/game-animals-three/src/test-area/module.ts` (module pattern); `packages/game-floorplan/src/silhouettes/` (part vocabulary); `S/design/T4-personagens-e-animais.md` (format).
