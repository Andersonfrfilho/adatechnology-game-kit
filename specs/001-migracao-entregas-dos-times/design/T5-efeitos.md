# Fase 5 — Efeitos (desenho do architect/opus, 2026-10-24)

Perguntas do §7 decididas pelo padrão reversível (autopilot, 2026-10-24), listadas no PR. Gore: `full` por padrão, opção `violence` só se o dono pedir.

## Summary

Phase 5 should add two new packages, `game-vfx` (pure, deterministic, no three.js) and `game-vfx-three` (renderer, bench module and screen overlay). They take a literal port of the Explosion Lab's layer compositor and its simulation loops, plus the VFX Workshop's particle systems and recipes, with the effects stored as data. The game's area cap (6 explosions per 4 s within 40 m, the extra ones at 0.3) and its distance LOD are layered on top. The test room creates one shared VFX world and passes it to destruction, fluids and weapons, and lends it to modules through a small generic `EffectSink` contract. `game-destruction-three/src/particles.ts` is deleted: its 15 kinds and the burst algorithm move as-is into `game-vfx`. `game-fluids` (T5.3) gets the Fluid Standard's thin-film simulation as a CPU simulation that runs only near the player, behind an interface a GPU version can replace later, with the team's values as the default liquids.

I read the sources from `origin/main` through `git show`, plus the Phase 2 and Phase 4 design branches and the four team sources. I did not record any golden or run any build: everything below is design.

---

## 1. Source map (team line → destination)

The sources are under `specs/001-migracao-entregas-dos-times/sources/` (`L` = Lab `efeitos__laboratorio-explosoes.js`, `W` = Workshop `efeitos__oficina-vfx.js`, `F` = Fluid Standard `efeitos__padrao-fluidos.js`). `G` is the game, `artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`.

### Explosion Lab → `game-vfx` / `game-vfx-three`

| Source | What | Destination |
|---|---|---|
| L16–18 `rnd`/`rr`/`rdir` (Park–Miller 16807) | Seeded random number generator | `game-vfx/src/random.ts` `lehmer(seed)` plus `streamFor(seed)` |
| L60–83 `groundH`, `dent`, `resetGround` | 60 m deformable ground patch, 33 cm cells | `game-vfx-three/src/ground-patch.ts` `createGroundPatch` (used by the test area; a terrain owner can adopt it later) |
| L116–129 `GL_NOISE`; L130–192 puff shader (5-band heat ramp, noise dissolve, banded light) | Fireball and smoke look | `game-vfx-three/src/shaders/puff.ts`, verbatim (only the r128 `encodings_fragment` → r160 `colorspace_fragment`, G6) |
| L193–238 `puff`, `SMOKE`, `WIND`, `updatePuffs` (mushroom-ring motion included) | Puff simulation | `game-vfx/src/pools/puffs.ts` (struct of arrays, stable order) |
| L239–293 sparks, streak shader, 5 kinds | Shrapnel and sparks | `game-vfx/src/pools/sparks.ts` + `-three/src/shaders/spark.ts` |
| L294–318 glows | Additive halos (flash) | `pools/glows.ts` + `shaders/glow.ts` |
| L319–348 `shock`, `ringMat`, `updateShocks` (pushes the puffs it meets) | Shock wave | `pools/shocks.ts` + `-three/src/shock.ts` |
| L349–365 4 blast lights + 2 fire lights, `updateLights`, `uGlow*` | Light pool | `game-vfx/src/lights.ts` (who gets the light) + `-three/src/lights.ts` |
| L366–400 `chunk`, `updateChunks`, `_hotCol` | Debris with embers, max 300 | `pools/chunks.ts` + `-three/src/chunks.ts` (two instanced meshes, rocks and plates) |
| L401–423 `body`/`updateBodies` | Loose bodies (car parts, limbs, wall blocks) | **Not VFX.** The physics belongs to destruction pieces and character limbs; only the trails (`fire`/`blood`/`smoke`) port, as `vfx.attach(trail, follow)` |
| L424–442 `fire`/`updateFires` | Lingering fire (grows, fades, smoke, embers) | `game-vfx/src/emitters/fire.ts` |
| L443–476 scorch/dirt textures, `conform`, `scorch`, `crater` (rim rocks), `bloodSplat` | Ground marks | `-three/src/marks.ts`. `crater` emits a `crater` side request (dent) to the host. Gib blood goes to `game-fluids` (T5.3) |
| L477–485 `layers`, `lodFor`, `evCount` | 6 layers, LOD bands, counters | `game-vfx/src/layers.ts`, `lod.ts` (`LOD_LAB`) |
| L486–587 zombies and `hitZombie`; L545–555 `gibs`, `headBurst`, `burnZ`, `charZ` | Damage and gore | Damage → `game-characters` (Phase 4). Only the gib, head-burst and burn visuals become effects (`gibs`, `head_burst`, `burning_body`) |
| L588–633 car, wall, barrel, P13, gas station | Scenario props | SDK items: `world_*` from weapons-three, the fleet car, the T2.2d wall specimen, the commercial gas station (T2.5) |
| L634–637 `at`/`task` | Scheduler | `game-vfx/src/schedule.ts` |
| **L639–714 `blast`** | Layer compositor (flash → fireball → own smoke → shock → dust → shrapnel → debris → marks/mushroom/lingering fire) | `game-vfx/src/explosion.ts` `composeExplosion`, a literal port that keeps the order of random draws. Windows (L708) and zombies (L710–713) become side requests (`blast_front`, `ignite`) |
| L716–721 `breakWindow` (delay d/340 s) | Glass at the speed of sound | `game-destruction` option `blastFrontSpeed: 340` (hand-off). The glass shards remain a VFX effect (`glass_burst`) |
| L722–735 `mushroom`, `updateRings` | Mushroom cloud | `explosion.ts` + `pools/puffs.ts` (ring mode) |
| L737–790 `throwArc`, `physThrow`, `rocket`, `backblast` | Projectiles | Physics is already in `game-weapons` (T1.5). The visuals (bounce dust, rocket trail, backblast) become effects `bounce_dust`, `rocket_trail`, `backblast` |
| **L792–812 `HE`, `PROF` (16 profiles)** | Explosion data | `game-vfx/src/data/explosions.json` (the 16, English field names, `sources`) |
| L814–997 `SC.*`, `ORDER` | 16 bench scenes | `examples/vfx-test-area/src/scenarios.js` (`posto`, `horda` as scenarios) |
| L1000–1021 `clearAll`, `applyCam`, `select` (seed `1000+i*97`) | Reset, camera, seed | VFX bench module: `distance` control → `bench.look`, seed per scene |
| L1031–1047 `renderFicha` (estimate vs 400, debris vs 40, lights vs 4+2, network) | Effect sheet | `estimateCost(def)` + metrics with `max` + `ModuleBench.sheet` |
| L1049–1052 `PH` strip | Layer timeline | `BenchSheet.timeline` |
| L1060–1070 `AUD` | Audit of the other pages | Not code. Goes to the inventory (R5) |
| L1077–1104 `frame` (dt ≤ 0.05, slow motion × 0.25, shake and flash) | Loop | `VfxWorld.update`, `screen()`; slow motion = the room's existing `setSlowMotion` (`room.ts:2140`, also 0.25) |

### VFX Workshop → `game-vfx` / `-three` (and owners)

| Source | What | Destination |
|---|---|---|
| W168–220 `PSys` (`addP` 9000 additive, `norP` 9000 normal), `randUnit`, `coneDir`, ground modes 1/2/3 | Sprite systems | `game-vfx/src/pools/sprites.ts` (spawn draw order kept) + `-three/src/sprites.ts` |
| W223–245 `Streaks` (3000) | Line streaks | `pools/streaks.ts` |
| W248–263 debris (500) | Debris boxes | `pools/debris.ts` (shared instanced mesh with the Lab chunks; separate counters) |
| W265–306 decals + `FLUID` (creep, dry, evaporation, sheen) | Wet and dry decals | Fluid decals → `game-fluids` stains (T5.3). Holes and scorch → `-three/src/marks.ts` |
| W308–315 rings | Rings | `pools/rings.ts` |
| W317–331 rain, puddles | Rain | **Phase 6 `game-weather` (E6).** VFX only provides the primitives (streaks, rings, sprites) |
| W333–337 light pool (4) + 2 fire lights | Lights | `lights.ts` (same pool as the Lab) |
| W340–345 `Q` (level 0/1/2 → mult 1/0.5/0.2), `n()`, `burst`, `emit` | Quality and emission | `lod.ts` (`LOD_GAME` bands 0–15/15–40/40–80) + `schedule.ts` emit accumulators |
| W347–371 screen state `S` + overlays + lens | Screen effects | `game-vfx/src/screen.ts` (pure decays, same constants) + `-three/src/screen-overlay.ts` (DOM, inside the host's container) |
| W374–391 `IMP` + `impact` | Impact by material | Effect `impact_<material>` (concrete, metal, wood, glass, flesh, water) |
| W392–398 `bloodHit` (4 ages) | Blood mist and jet | Effect `blood_hit` with an `age` parameter; drops with `gnd:3` land into `game-fluids` |
| W399–405 `fireEmit`, `fireLight` | Workshop fire | `emitters/fire.ts` variant `workshop` (molotov, burning car, campfire) |
| W406–416 `explode` | Old explosion | **Superseded by the Lab (E1).** The Workshop entries with `lab:1` (W801/816/828/1139) point to the Lab profiles |
| W417–429 `muzzle` (4 weapons), `casing` | Third-person flash and casings | Effects `muzzle_<scale>`, `casing_*`. The first-person viewmodel stays in weapons-three (T1.3 goldens) |
| W449–561 zombies: `sangue`, `headshot`, `membro`, `inchado`, `grito`, `olhos`, `corpo`, `reanima` | Recipes | `game-vfx/src/effects/creatures/*.ts` (data); prop motion → `cue` steps for `game-characters-three` |
| W562–744 `fluidos` (160×448 film, `FT` with `spk`/`spd`) | Living fluids | **T5.3 `game-fluids` film** (`WORKSHOP_LAYOUT`) |
| W745–845 `muzzle`, `impacto`, `penetra`, `capsulas`, molotov/granada/barril | Weapons | `effects/weapons/*.ts`; molotov/granada/barril → explosion defs |
| W846–1053 `vidro`, `porta`, `desaba`, `parede`, `portametal`, `grade`, `cerca`, `pontos`, `pressao` | Destruction recipes | `effects/destruction/*.ts`, played by the destruction event map (§2.4). Mesh deformation stays in destruction / floorplan-three |
| W1054–1089 `incendio`, `chuva`, `neblina` | Map | `incendio` → `effects/world/building_fire.ts`; `chuva`/`neblina` → Phase 6 |
| W1090–1174 `faisca`, `motor`, `vazamento`, `explosao`, `parabrisa`, `farol` | Vehicles | `effects/vehicles/*.ts` (`farol` waits for weather); `explosao` → explosion `car_fuel_tank`; `parabrisa` mask → vehicles-three |
| W1175–1244 `dano`, `infeccao`, `panico`, `cegueira`, `fogueira`, `tosse` | Character and screen | `effects/screen/*.ts` (screen-state presets) + `campfire`, `breath` |
| W1245–1273 catalogue by team, `param`, `renderSheet` (q/v/b/r), replay, auto, quality | Panel | VFX bench (T5.2) |
| W1276–1295 loop (timers in **descending** index) | Runner | `schedule.ts` keeps the descending order (port invariant, tested) |

### Fluid Standard → `game-fluids` (T5.3)

| Source | What | Destination |
|---|---|---|
| F12–42 grid folded over wall/sidewalk/curb/road; bed `B`, pinning `PN`, `VERT`, `vnoise`/`hash2` | Layout | `game-fluids/src/film/layout.ts` (`PADRAO_LAYOUT`, `WORKSHOP_LAYOUT`, `layoutFromSurfaces`) |
| F17–18 `rng` (LCG 1664525/1013904223) | Random generator | `film/random.ts` |
| F45–56 `FL` (blood, old blood, bile, oil, gasoline) | Profiles | `game-fluids/src/data/film-profiles.json` |
| F60–92 `dep`, `blob`, `stroke`, `splat` | Deposit and splash by angle (1/sin) | `film/deposit.ts` (literal) |
| F94–114 `bbox`, `mob`, `step` (thin-film flow), `age` (dries from the edge, evaporation) | Running film | `film/simulate.ts` |
| F131–209 film shader (thickness → colour, normal, gloss, bile bubbles, oil iridescence, cracks) | Look | `game-fluids-three/src/film/material.ts` (verbatim + r160 fixes) |
| F250–278 drops in flight, `land` | Drops | `film/drops.ts` (pure) + instanced drops in `-three` |
| F279–297 drip, sources, drags | Drip, pour, drag smear | `film/sources.ts` |
| F298–335 `SCENES` (wall, source, drip, drag, shapes), seed formula | Bench scenes | Golden captures + fluids bench scenarios |
| W590–611 `fSplat` with `spk`; W691 oil/fuel land as blobs | Workshop variants | Profile fields `spikes` and `landsAsBlob` |

### Game (`jogo.js`) → caps and defaults

| Source | What | Destination |
|---|---|---|
| G68194–68202 `expRecent`, `near>=6 → lod 0.3`, area 40 m (1600 = 40²), window 4 s | **Area cap (E1)** | `game-vfx/src/area-cap.ts` `{ radius: 40, window: 4, count: 6, excessScale: 0.3 }` |
| G68203–68204 `q` bands (<15: 1, <40: 0.5, <80: 0.2, else 0.1; distance minus `esc`) | Distance LOD | `LOD_GAME` (default) |
| G68063–68072 `EXP`, `HEAT` | The game's reduced explosions | Comparison only (E1 picks the Lab) |
| G68074–68120 pools (260 fireballs, 120 debris, 2 lights) | Game budgets | `PROFILES.low` reference |
| G67745–67772 `PMAX 1500`, `GMAX 600` | Particle pools | `PROFILES.medium` reference |
| G67785–67856 decals 256+256 (kinds pool, footprint, run, scorch, bile) | Decals | `game-fluids-three` stains (pool size); scorch → `-three/marks.ts` |
| G67884–67918 `fluidsUpdate`, `fxDrip`, footprints (8 steps) | Drips and footprints | `game-fluids` (drip rate ≤ 10/s, footprint emitter) |
| G67919–67939 `fxBlood` (volume by age, fan toward the camera, satellites), `fxSpark`, `fxDust` | Blood and sparks | `blood_hit` variant `crowd` (cheap path for the horde) |
| G67945 `fxCloud` (bile cloud as puffs) | Bloater cloud | Effect `bloater_cloud` on the puff pool |
| G61968–61973 `IDADES` (colour, dry colour, dry time 600/360) | Age → blood | Character data (T4 `ages.json`); fluids accepts `tint` |

---

## 2. `game-vfx` and `game-vfx-three`

### 2.1 Package layout

```
packages/game-vfx/                 (no dependencies except game-contracts; pure, Node-testable)
  src/random.ts          lehmer(seed), lcg(seed), streamFor(eventSeed)
  src/pools/*.ts         puffs, sparks, glows, chunks, shocks, sprites(add|normal), streaks, debris, rings  (struct of arrays, stable compaction)
  src/lights.ts          4 blast + 2 fire slots, intensity curves L355–364
  src/emitters/fire.ts   Lab fire (L426) + Workshop fireEmit (W399)
  src/explosion.ts       composeExplosion (L642–714 literal)
  src/effects/runner.ts  timeline/emit/cue runner (W1280 descending-timer order)
  src/effects/{weapons,creatures,destruction,vehicles,world,screen}/*.ts   EffectDef data
  src/data/explosions.json   16 Lab profiles
  src/data/sprite-kinds.json 15 kinds moved from destruction-three particles.ts L35–50 (values unchanged)
  src/data/event-effects.json destruction/body event → effect id
  src/lod.ts             LOD_GAME, LOD_LAB
  src/area-cap.ts        game cap
  src/budget.ts          estimateCost (L1033), PROFILES (pool capacities)
  src/screen.ts          shake/white/red/dir/chroma/desat/gas/beat (W354–355) + Lab flash (L651–652) + shake (L655, L1092)
  src/world.ts           createVfx
  src/locale.ts          en, pt-BR (effect names and sheet texts: q/v/b/r, sequence, colours)
packages/game-vfx-three/            (three peer ^0.160; depends on game-vfx, game-contracts)
  src/renderer.ts        createVfxRenderer → implements EffectSink
  src/shaders/{puff,spark,glow,sprite,shock}.ts
  src/chunks.ts, lights.ts, marks.ts (scorch, dirt, holes, crater rim rocks), ground-patch.ts, screen-overlay.ts
  src/bench/module.ts    createVfxTestModule (T5.2)
```

### 2.2 Effects as data

```ts
// Lab profile, English names; data/explosions.json keyed by game-weapons ExplosiveDef.id
export interface ExplosionDef {
  readonly id: string
  readonly lethal: number; readonly injury: number; readonly visualRadius: number      // lethal, injury, vis
  readonly fireballs: number; readonly fuel?: boolean; readonly heat?: number; readonly heatLifeScale?: number  // fb, fuel, heat, hlK
  readonly smoke: { color: number; count: number; life: number; kind?: 0 | 3 }         // smoke, smokeN, smokeLife, smokeKind
  readonly dust: { color: number; count: number }                                        // dust, dustN
  readonly shrapnel: { count: number; kind: 0 | 1 | 2 | 3 | 4; speed: number; width?: number; embers?: number }
  readonly chunks: { count: number; colors: readonly number[]; plate?: boolean; hot: number; speed?: number; size?: number }
  readonly mark: { scorch?: number; crater?: number; dent?: number }
  readonly flash: { light: number; life?: number; color?: number; intensity?: number; blinding?: boolean }  // flash:true = flashbang
  readonly shock?: false | { duration: number }
  readonly shake: number; readonly push: number
  readonly mushroom?: { height: number; radius: number; count: number; stem: number; life: number; rise?: number; roll?: number }
  readonly residualFires?: readonly { dx?: number; dz?: number; radius: number; life: number; rate?: number; smoke?: number }[]
  readonly ignite?: number            // side request for characters (burnZ L713)
  readonly cone?: { angle: number; half: number; length: number }
  readonly directionBias?: number
  readonly sources: readonly string[] // "lab:L796"
}
export type VfxLayer = 'flash' | 'fire' | 'shock' | 'smoke' | 'shrapnel' | 'mark'      // L478 clarão/fogo/choque/fumaca/estilhaco/marca

// Workshop recipe
export interface EffectDef {
  readonly id: string
  readonly team: 'creatures' | 'weapons' | 'world' | 'destruction' | 'vehicles' | 'screen'
  readonly params?: { readonly id: string; readonly options: readonly string[]; readonly default: number }
  readonly budget: { particles?: number; debris?: number; decals?: number; lights?: number }   // W "≤ 70 part." etc., meter max
  readonly loop?: number; readonly view?: { eye: Vec3; target: Vec3 }
  readonly timeline: readonly EffectStep[]
}
export type EffectStep =
  | { at: number; op: 'burst'; system: 'add' | 'normal' | 'streak' | 'debris'; count: number | ParamTable; spawn: SpawnSpec }
  | { from: number; to: number; op: 'emit'; key: string; system: SpriteSystem; rate: number | Curve; spawn: SpawnSpec }
  | { at: number; op: 'ring' | 'light' | 'screen' | 'decal' | 'fluid'; args: Readonly<Record<string, unknown>> }
  | { at: number; op: 'cue'; cue: string; args?: Readonly<Record<string, unknown>> }   // prop motion for the owner (zombie_fall, car_jump)
  | { at: number; op: 'explosion'; explosion: string }
// SpawnSpec = W PSys.spawn options (p offset, r, flat, box, dir, cone, sp, v, life, size, grow, c0, c1, a, g, drag, fi, gnd, ds) + shape generators 'ring'|'disc'|'box' with Curve radii.
```

Recipes are registries: `createVfx({ explosions: patch(EXPLOSIONS, …), effects: { ...WORKSHOP_EFFECTS, mine } })`, so a game adds, changes or removes effects without touching the core (CLAUDE.md §2).

**Explosive id → Lab profile.** `m67`→granada, `molotov`, `pipe_bomb`→caseira, `propane_p13`→p13, `dynamite`, `c4`, `claymore`, `flashbang`→flash, `m79_40mm`, `m72_66mm`, `at4_84mm`, `pg7v`→rpg, `fuel_barrel`→barril, `car_fuel_tank`→carro, `fuel_pump`→bomba, `fuel_station_tank`→tanque. Two aliases: `carl_gustaf_84mm`→at4, `vog_25`→m79. The ids come from `packages/game-weapons/src/data/explosives.json`. `generic` is m67 scaled by `injury/15` (used for destruction parts that have no explosive id).

**LOD bands (data).**
- `LOD_GAME` (default): edges 15/40/80 m, scales 1/0.5/0.2/0.1, distance minus 1 × visual radius (G68203, W Q bands).
- `LOD_LAB`: edges 20/45/85 m, scales 1/0.5/0.2/0.08, distance minus 3 × visual radius (L481).
- The final scale is `band × (area over cap ? 0.3 : 1)`. The Lab's own floors stay: `max(k, .35)` for fireballs, `k > .15` for shock and dust, `k ≥ .5` for chunks (L659, L672, L678, L694).

**Budgets.**
- Per event: 400 GPU particles and 40 physics debris (the Lab meters, L1043–1044), 4+2 lights.
- Per Workshop entry: its `cost`.
- `estimateCost(def) = fireballs + smoke + dust + shrapnel + mushroom(count + stem) + embers` (L1033).
- A rare event may go past its per-event budget, never past the global pools (W1139 `explosao`).

**Global pools (`PROFILES`).**

| Profile | Puffs | Sparks | Glows | Chunks | Sprites (add/normal) | Streaks | Debris |
|---|---|---|---|---|---|---|---|
| `high` (bench, goldens; Lab caps L131/240/295/367) | 2600 | 3200 | 320 | 300 | 9000/9000 (W221) | 3000 | 500 |
| `medium` (game default) | 1300 | 1600 | 160 | 150 | 1500/600 (G67747/67762) | 1000 | 120 |
| `low` | 260 (G68074) | 800 | 80 | 120 (G68108) | 600/300 | 400 | 60 |

### 2.3 API

```ts
// game-vfx
export function createVfx(options?: VfxOptions): VfxWorld
export interface VfxOptions {
  readonly seed?: number
  readonly randomMode?: 'per_event' | 'shared'      // per_event = LAN-safe (Lab sheet: "visual local pela semente"); shared = Lab-equal goldens
  readonly profile?: 'low' | 'medium' | 'high' | VfxProfile
  readonly lod?: LodBands; readonly areaCap?: AreaCap | false
  readonly groundAt?: (x: number, z: number) => number
  readonly wind?: Vec3; readonly gravity?: number      // L203 [.55,0,.2], 9.8
  readonly explosions?: Readonly<Record<string, ExplosionDef>>; readonly effects?: Readonly<Record<string, EffectDef>>
  readonly onRequest?: (request: VfxSideRequest) => void   // crater | ignite | blast_front | cue | fluid_drop
}
export interface VfxWorld {
  explosion(id: string, point: Vec3, o?: { direction?: Vec3; seed?: number; scale?: number }): EffectHandle | null
  play(id: string, point: Vec3, o?: { direction?: Vec3; normal?: Vec3; seed?: number; param?: number; follow?: Follow }): EffectHandle | null
  fire(o: FireOptions): EffectHandle                       // area fire (molotov 4 m/9 s, burning part)
  attach(trail: 'fire' | 'smoke' | 'blood', target: Follow, o?: { seconds?: number }): EffectHandle
  burst(kind: SpriteKind, point: Vec3, normal: Vec3, count: number, speed?: number, o?: SpriteOptions): void   // old ParticleSystem.burst, same algorithm
  spawn(kind: SpriteKind, p: Vec3, v: Vec3, o?: SpriteOptions): void
  push(point: Vec3, radius: number, speed: number): void
  stop(handle: EffectHandle): void
  setLayer(layer: VfxLayer, on: boolean): void
  setCamera(position: Vec3): void; forceLod(scale: number | null): void
  update(dt: number): void
  screen(): Readonly<ScreenState>; stats(): VfxStats; pools(): VfxPoolsView; clear(): void
}
// game-vfx-three
export function createVfxRenderer(THREE: ThreeNamespace, o: {
  scene: Object3D; camera: Camera; vfx?: VfxWorld | VfxOptions; quality?: 'low' | 'medium' | 'high'
  pointScale?: number; overlay?: HTMLElement; reducedMotion?: boolean
}): VfxRenderer
export interface VfxRenderer extends EffectSink {          // EffectSink: game-contracts
  readonly world: VfxWorld
  update(dt: number): void; applyCamera(): () => void       // shake around render (L1092), restore after
  stats(): VfxStats & { drawCalls: number }; dispose(): void
}
export function createGroundPatch(THREE: ThreeNamespace, o?: { size?: number; cell?: number }): GroundPatch   // L60–83
export function createVfxTestModule(o: { locale: string }): TestableModule
```

**Port invariants** (each has a test):
- Pools iterate in insertion order and compact in place without allocating; when full, the oldest is evicted (`P.shift`, L196; chunks: the first resting one, else index 0, L375).
- Each puff spawn draws `seed: rnd()` even when overridden (L196).
- Due timers run in descending index (W1280).
- No allocation per frame. Colours are converted once, at spawn (the T0.3 fix, kept).

### 2.4 Composition: who calls `game-vfx` (CLAUDE.md §3)

**`game-contracts`** (additive, types only, generic):
- `src/effects.ts`:
  - `EffectRequest { effect: string; point: Vec3; direction?: Vec3; normal?: Vec3; seed?: number; param?: number | string; scale?: number }`
  - `EffectHandle = number`
  - `EffectSink { play(request): EffectHandle | null; stop(handle): void; configure?(settings: Record<string, ControlValue>): void; stats?(): Readonly<Record<string, number>>; catalog?(): readonly string[] }`
- `ModuleHost.effects?: EffectSink`.
- `HostEvent` `explosion` gets `explosive?: string`.
- `PartSpec.explodes.effect?: string`, and the `explode` event gets `effect?: string`.
- `ChoiceOption.group?: string`.
- `ModuleBench.sheet?(sheet: BenchSheet | null)`, with `BenchSheet { kicker?, title, body?, facts?: {label, value}[], steps?: {at, text}[], swatches?: {color, name}[], note?, timeline?: { segments: {name, start, end, color}[]; ticks: number[]; metric: string } }`.
- `checkBench` also checks `group`.

**`game-destruction-three`:**
- New `RendererOptions.vfx?: VfxWorld`. When absent it calls `createVfx({ profile })` plus its own three layer, so existing callers work unchanged.
- `onExplode` (`renderer.ts:819`) keeps the shove on pieces and fragments and the sound. Its five bursts and its light become `vfx.explosion(ev.effect ?? 'generic', p, { scale })`.
- Debris events (`renderer.ts:472–733`) call `vfx.burst` (same signature).
- Fires (`emitFire`, `renderer.ts:937`) call `vfx.fire({ follow: part box })` (Lab recipe). Leaks (L989) go through fluids.
- **`particles.ts` is deleted.** `ParticleKind` stays exported as an alias of `SpriteKind` from `game-vfx`. The points shader (L71–101) moves verbatim to `game-vfx-three/src/shaders/sprite.ts`.

**Phase 2 events, by string so there is no compile dependency on T2.3a** (`data/event-effects.json`):

| Event | Effect |
|---|---|
| `spall` | `impact_<layer material>` (W374–391) |
| `stage` 1 / 2 / 3 | `stage_crack` / `breach_dust` (W899, 60 sprites) / `collapse_dust` (W875) |
| `expose` | `rebar_expose` (dust + chips) |
| `collapse` | `collapse` (W875, ≤ 350 particles, 26 debris) |
| `explode` | `explosion` |
| `fracture` (glass) | `glass_burst` (W846) |

`game-destruction` gets the option `blastFrontSpeed: 340` (L708) for the glass-break delay. That is a hand-off to destruction, not VFX.

**`game-fluids-three`:** its `ParticlePool` (`particles.ts`, 210 lines) becomes the shared sprite pool through `options.vfx`. Splash droplets and steam use the `drips` and `steam` kinds. The film is T5.3.

**`game-weapons-three`:**
- The viewmodel flash and the Galeria smoke stay as they are (T1.3 goldens). The flash is the Galeria's (`fx/effects.ts`), and the backblast and flame are the Galeria's (`fx/heavy.ts`).
- The smoke puffs today allocate one `Mesh` + `SphereGeometry` per puff (`fx/effects.ts` `smoke`). Route them to `host.effects` with `muzzle_smoke` when it is lent, but only after confirming that the golden scene hash does not include the smoke. If it does, leave it for a follow-up.
- Third-person and world effects (W417 `muzzle_*`, W760 `impact_*`, W776 penetration, W790 casings for remote players) go through `host.effects.play`.

**`game-test-room`:**
- Creates **one** `createVfxRenderer(THREE, { scene, camera, overlay: container })` and passes `.world` to `createDestructionRenderer` and `createFluidRenderer`.
- Lends `host.effects` to every module.
- `explosives.ts:258` changes from `renderer.explode(...)` to `vfx.world.explosion(detonation.explosive, point, { direction: detonation.direction })`.
- Fills `explosive` in `emitHost` (`explosives.ts:267`, `room.ts:333`).
- Calls `applyCamera` around `gl.render`.
- Adds the screen overlay to the room container.
- Applies the `crater` side request to an optional ground patch.
- The `particles` metric reads `vfx.stats()`.

**Characters (Phase 4, `body` event, design line 88):**

| `body` change | Effect |
|---|---|
| `wound` | `blood_hit` (`age` from `ages.json`) |
| `severed` | `limb_jet` (W487) |
| `destroyed` with `cause:'explosion'` | `gibs` (L546) |
| `killed` with `cause:'head'` | `head_burst` (W474) |

- `leak` with `fluid:'blood'` (bleeding) goes to the T5.3 film or a drip, with `tint` from the age.
- The `ignite` side request lets `characters-three` start a burn, whose visual is `vfx.attach('fire', body)` (L554).

---

## 3. `game-fluids` (T5.3)

- **Running film:** `game-fluids/src/film/*` is a literal port of F60–114: the same rules for pin, front, mobility and the 180 Hz step limited to the wet bounding box, with at most 6 steps per frame (F370) or 9 (W720). Drops in flight land through `splat` with an elongation of `1/sin(angle)`, spikes, satellites and tails (F73–92, W598). Drips (F282), sources (F288) and drag smears (F291) are included.
- **Profiles (`data/film-profiles.json`):** `blood`, `old_blood`, `bile`, `motor_oil`, `fuel`, with the F46–55 values plus the Workshop's `spikes` (bile 0.3, W578) and `landsAsBlob` (oil and fuel, W691).
- **Team values as configurable defaults (E2), `data/liquids.json`:**

| Liquid | Change |
|---|---|
| `blood` | `stainColor` 0x3B1D14, `dryTime` 600 |
| `old_blood` (new) | 0x6C1C16 → 0x2A160E, `dryTime` 360 |
| `bile` (new) | 0x8A9A2A → 0x3E4220, 900 s |
| `fuel` | 60 s, evaporates, `leavesMark: false` |
| `water` | 180 s (Workshop rule table) |
| `motor_oil` | never dries (unchanged) |

  The old SDK values (blood 0x4A0506 / 1200 s, fuel 120 s with a mark) are listed in the changeset. A game overrides them with `createFluids({ liquids: patchLiquids(LIQUIDS, { blood: { dryTime: 1200 } }) })`.
  - Per-splash `tint?: { fresh: number; dry: number }`, so infection age is the characters' data and fluids stay generic.
  - Fix the README import (improvement 11: `DestructionEvent`, not `DamageEvent`).
- **Near the player instead of the whole texture every frame (improvement 8):**
  - `game-fluids-three/src/film/manager.ts` keeps at most 6 active grids of 2×2 m (160×160 cells). This is the Workshop's budget text: "até 6 grades … 0,3 ms" (W711).
  - Only within 30 m (W text: "a mais de 30 m não anima").
  - A sim budget in ms per frame. A grid that is far away or old (dry and still, or outside the budget) is **baked** into the existing stain decal with its final colour and shape, and freed.
  - Upload only the dirty bounding-box rectangle, through a small staging `DataTexture` and `renderer.copyTextureToTexture` (available in three 0.160).
  - Layouts: `layoutFromSurfaces(wall?, floor, curb?)` builds the fold from the host's `SurfaceSpec` (`types.ts:119`).
  - GPU compute (ping-pong fragment shader) is deferred to a follow-up behind the same `FilmSimulator` interface, with the CPU version as the reference golden.
- **Rain hook for Phase 6:** `film.setWeather({ rain: 0..1 })`. While it rains, drying stops and spread is ×1.5 (W text "Chuva lava…"). It is a no-op until `game-weather` drives it.

---

## 4. Goldens ("igual ao original")

The recording needs `--expose` in `tools/golden/bin/record.mjs`. Reuse the T2.2a flag if Phase 2 has merged; otherwise T5.0 adds it. The flag wraps the IIFE and publishes the named bindings, with getter and setter for each `let`: `seed`, `simT`, `lodNow`.

| Golden | Capture (`tools/golden/captures/`) | Recorded | SDK test |
|---|---|---|---|
| **Lab ×16** | `explosion-lab.js`: `--expose blast,PROF,P,S,GL,CH,FIRES,SHOCKS,RINGS,XL,FL,layers,clearAll,seed,simT,camera`. Per key: camera at the scene's `cam` ("perto"), `seed = 1000 + ORDER.indexOf(key)*97` (L1015), `clearAll()`, call `blast(point, profOf(key))` directly (not `run()`, so the throw physics is skipped), then `stepFrames` at 1/60 for 8 s, with `installPortableMath` | (a) spawn sequence: wrap `puff/spark/glow/chunk/fire/shock/boomLight/scorch/crater/mushroom`, first 400 spawns with fields rounded to 4 dp, then counts per frame; (b) per-layer first and last alive frame against `PH` (L1049); (c) at **0.08, 0.25, 0.5, 1, 2, 4 s** (the `comparacoes` instants): pool hashes (`pA/pD/pC`, `sA/sB/sE`, `gA/gB`, chunk matrices) + scene hash of the persistent meshes (shock, decals, crater rocks); (d) the `#mPv` sheet number | `game-vfx/tests/team-golden.test.ts` (pure: `randomMode:'shared'`, `lehmer(seed)`, `LOD_LAB`, `profile:'high'`); `game-vfx-three/tests/team-golden.test.ts` (scene hash) |
| **Workshop ×34** (38 minus rain, fog, headlights and fluids) × each `param` option | `vfx-workshop.js`: `--expose FX,select,startLoop,addP,norP,streak,DB,DC,RG,LP,Q,S,timers`. `Math.random = GoldenTool.createSeededRandom(hash(id, param))` before each `select` | spawn sequence (wrap `PSys.spawn`, `Streaks.spawn`, `debris`, `decal`, `ring`, `flash`), counts per frame, pool hashes at 0.1, 0.5, 1, 2 s and the end of the loop, screen state `S` samples. Props are not recorded (cues are recorded as events) | `game-vfx/tests/workshop-golden.test.ts` |
| **Fluid Standard** 5 scenes × 5 fluids (the valid combinations) | `fluid-standard.js`, using the page's seed (F333) with `runN = 0`, speed ×20 | hash of `h`/`dry` at 0.5, 1, 2, 5 and 10 s, wet-cell count, launches | `game-fluids/tests/film-golden.test.ts` (`PADRAO_LAYOUT`); the bile combination runs with `spikes: 1` (proves the setting can be changed) |
| **Workshop fluids** × 4 | `vfx-workshop.js` id `fluidos` | same as above | `WORKSHOP_LAYOUT` |
| **Area cap** | none (rule) | — | unit test: 7th blast within 40 m in 4 s → 0.3; at 41 m → 1; at 4.01 s → 1 (G68197–68202) |

**`comparacoes/explosoes`:**
- `capturar.mjs` adds the `sdk-vfx` source: the `vfx-test-area` page with a `window.__cmp` hook (`?fx=m67&freeze=t`).
- `index.html` shows Lab | game | SDK (new) | SDK (old, kept for one release).
- The README records the new findings.
- `consolidado.md` §8 and improvement 1 are closed.

---

## 5. VFX bench module (T5.2) and test areas

`createVfxTestModule({ locale })` (group `effects`, id `vfx`) uses `host.effects`. When a host does not lend it, the module creates its own renderer on `host.scene`.

| Panel element | Lab | Workshop | Bench declaration |
|---|---|---|---|
| Choice of effect | Arsenal list grouped by `g` (Throw, Charges, Launchers, Scenario) | Catalogue by team (6) | `choice effect`, options with `group` (16 explosions + 34 recipes) |
| Variation | — | `param` (age, weapon, material, cylinder, condition, phase) | `choice variant`; options swapped with `bench.patch(options)` |
| Detonate / replay | "Detonar de novo" | "Repetir" | `action replay` |
| Auto repeat | — | yes | `boolean auto_repeat` (default true) |
| Distance | Near / middle / far → camera | — | `choice distance` → `bench.look` (L1010–1012) |
| Forced LOD | (automatic) | 0–15 / 15–40 / 40–80 | `choice lod_band` (`auto`, `near`, `middle`, `far`) → `forceLod` |
| Pool profile | — | — | `choice quality` (`high` default on the bench) |
| Slow motion | × 0.25 | — | the room's existing button (same factor) |
| Layers | flash, fire, shock, smoke, shrapnel, mark | — | 6 layers (L478) |
| Metrics | puffs, sparks, debris, lights "x+y", LOD %, phase, t | particles n/max, decals | `puffs`, `sparks`, `debris` (max 40), `lights` (max 6), `budget_particles` (max 400, from `estimateCost`), `lod` (%), `phase` (L1076), `blast_time` (s); the room already measures fps and draw calls |
| Sheet | `renderFicha` (L1031) + strip (L1049) | `renderSheet` q/v/b/r (W1266) | `bench.sheet(...)`, with the timeline driven by `blast_time` |

- **Ragdolls** (a Lab metric) is not VFX. `characters-three` shows it when loaded.
- **`examples/vfx-test-area`** (`build.mjs`, `src/entry.js` with global `VfxArea`, `src/area.js`, `src/scenarios.js`, `test.mjs`):
  - The area puts the Lab ground patch and markers in place.
  - It loads the weapons module (thrown and launched explosives) and the world explosives (`world_fuel_barrel`, `world_propane_p13`, `world_car_fuel_tank`).
  - Scenarios: `posto` (gas-station chain, L968), `horda` (L989, needs Phase 4 characters; skipped with a log line otherwise), `c4_wall` (T2.2d wall specimen when merged; otherwise the default-destruction concrete wall), and one per Workshop team.
- **`examples/interactables-test-area`** (owner rule): `entry.js` also imports `createVfxTestModule` and calls `room.loadModule` (several modules live together; the furniture bench stays the active one). `build.mjs` checks that `game-vfx` and `game-vfx-three` are built and adds their aliases. The catalogue summary lists the effects area.

---

## 6. Ordered tasks

Header for `tasks.md`:

```markdown
## Fase 5 — Efeitos
> 🤖 Modelo: `sonnet` (T5.1a, T5.1c, T5.3b, T5.2e, T5.4, T5.5 → `haiku`)
```

| # | Commit | Model | Group |
|---|---|---|---|
| T5.0 | `tools/golden`: `--expose` (if T2.2a is not on main), captures `explosion-lab.js`, `vfx-workshop.js`, `fluid-standard.js`; record fixtures (Node 22 and 24) | sonnet | A |
| T5.1a | contracts: `effects.ts`, `ModuleHost.effects`, `HostEvent.explosion.explosive`, `explodes.effect` + `explode.effect`, `ChoiceOption.group`, `ModuleBench.sheet`/`BenchSheet`, `checkBench`; tests | haiku | A |
| T5.3b | `liquids.json` team defaults + `old_blood`, `bile`, `tint`; README fix; changeset (minor, old values listed) | haiku | A |
| T5.1b | `game-vfx` core: random generators, pools (stable order), lights, screen state, LOD, area cap, budgets/profiles, `composeExplosion` + update loops, fire emitter, schedule; unit tests | sonnet | B (after A) |
| T5.1c | `explosions.json` (16 + aliases + `generic`) with `sources`; test that `estimateCost` = sheet numbers | haiku | B (after b) |
| T5.1d | `game-vfx-three`: shaders (verbatim + r160), pools → meshes, marks, crater rocks, ground patch, lights, overlay, `createVfxRenderer`, stats | sonnet | B (parallel with c) |
| T5.1e | Lab goldens, pure + three, 16/16 | sonnet | B (last) |
| T5.1f | switch `game-destruction-three` (vfx option, `onExplode`, debris, fires; delete `particles.ts`; tests updated: layer names in `room.test` "grenade blast") + `blastFrontSpeed` in `game-destruction` | sonnet | C (after B) |
| T5.1g | switch fluids-three particles, weapons-three world effects via `host.effects`, test room (shared renderer, `host.effects`, `explosives.ts`, `explosive` on the explosion event, shake/overlay, crater) | sonnet | C (parallel with f) |
| T5.2a | effect runner (descending order, emit accumulators, cues, ParamTable) + creatures/weapons recipes | sonnet | D (after b) |
| T5.2b | destruction/vehicles/world/screen recipes + `event-effects.json` + locale (sheets q/v/b/r) | haiku | D (after a) |
| T5.2c | Workshop goldens (34 × params) | sonnet | D (after b) |
| T5.2d | bench module + room `bench-panel.ts` (groups as `optgroup`/grouped buttons, sheet card, timeline with playhead) | sonnet | D (after a; parallel with c) |
| T5.2e | `examples/vfx-test-area` + scenarios + load into `interactables-test-area` + Dockerfile/site wiring | haiku (scenarios sonnet if a cross-module scenario needs a decision) | D (last) |
| T5.3a | `game-fluids` film: layouts, deposit/splat, simulate/age, drops, drip, sources, drags; profiles | sonnet | E (after A) |
| T5.3c | `game-fluids-three` film renderer: material, strips, drops, grid manager (6 grids, 30 m, budget, bake, partial upload) | sonnet | E (after a) |
| T5.3d | film goldens (Fluid Standard 25 + Workshop 4) | sonnet | E (parallel with c) |
| T5.3e | bridges: `leak` (blood, fuel, oil) → film or drip; `body` → splat with `tint`; rain hook | sonnet | E (after c, d; the `body` part after T4.0 is on main) |
| T5.4 | `comparacoes/explosoes` (SDK-new column), README, `consolidado.md` §8/§9 | haiku | F |
| T5.5 | inventory/spec (R5), package READMEs, skills, changesets, PR | haiku | F (last) |

**Parallelism:** A (three tasks) together. B and E run in parallel after A. C after B. D after T5.1b (D's runner does not need the three layer until T5.2d). F last.

**Gates per task:** `pnpm -r typecheck`, the package tests, `pnpm lint`, one commit per task, entry in `evidence.md`.

**Dockerfile wiring** (lesson of #21):
- `site/Dockerfile` gets `COPY packages/game-vfx/package.json packages/game-vfx/`, `COPY packages/game-vfx-three/package.json packages/game-vfx-three/` and `COPY examples/vfx-test-area/package.json examples/vfx-test-area/`, in alphabetical order next to the lines that are there today (`site/Dockerfile:12–40`).
- `site/build-site.mjs` needs no change (it picks up `examples/*` and puts `test-room` first). Add the landing thumbnail with `site/capture-thumbs.mjs`.
- tsup IIFE globals: `GameVfx`, `GameVfxThree`; `three` external, `noExternal: [/^@adatechnology\//]`, same as `packages/game-destruction-three/tsup.config.ts`.
- New dependencies: `game-vfx-three` in `game-destruction-three`, `game-fluids-three` and `game-test-room`; `@adatechnology/golden-tool` as a devDependency of `game-vfx` and `game-fluids`.
- Every `-three` package that bundles `game-vfx-three` only bundles the code. The state is shared because the room injects the same instance.

---

## 7. Business questions (each has a reversible default)

1. **LOD bands:** the game's (15/40/80, far scale 0.1) is the default in the game; the Lab's (20/45/85, 0.08, minus 3× radius) is a preset used on the bench and in the goldens.
2. **Area of the cap:** 40 m, from the game's code. E1 gives no radius. Default 40 m, `areaCap` configurable.
3. **Bile spikes:** Workshop 0.3 (short spikes, F9 "grossa") is the default; the Fluid Standard's 1 stays available as a setting.
4. **Drying clock:** seconds of simulation time. The game scales time, and the Workshop says "calculada pela hora do evento".
5. **Flashbang white screen:** only for whoever is looking (Lab note, L843). Default local.
6. **Gore level** (GTA test, ratings): `violence: 'full' | 'reduced' | 'none'` on blood, gibs and screen effects? Default `full`. Add only if the owner wants it.
7. **Carl Gustaf and VOG-25** have no Lab profile. Aliases at4 and m79 by default.
8. **Pools:** `medium` in the game, `high` on the bench and in goldens.
9. **Rain, fog and rainy headlights** move to Phase 6 (E6). Phase 5 only provides the primitives and the fluids rain hook.
10. **GPU film:** after Phase 5, behind the same interface. The CPU version near the player is the shipped default.
11. **Weapons-three smoke puffs:** move to the shared pool only if the T1.3 Galeria golden does not hash the smoke; otherwise keep them and record the extra allocation as an improvement.

---

## Trade-offs

| Option | Pros | Cons |
|---|---|---|
| **A. Literal port with simulation in `game-vfx` and render in `-three` (chosen)** | Goldens run in Node and compare spawn order exactly; LAN can replay from the event seed; same split as destruction and fluids | Keeping the draw order is fragile: any reorder breaks the goldens; struct-of-arrays code is less readable |
| B. Port the Lab page code into `-three` only | Faster; closer to the source text | Not testable without WebGL; nothing pure to compare; no shared pools |
| **Workshop recipes as data + closed generator registry + cues (chosen)** | Configurable per game; serializable; testable | A few Workshop `tick`s with computed emitters need curve support; prop motion depends on other packages |
| Recipes as functions | Exact and flexible | Not data; cannot be patched without code (against "tudo configurável") |
| **CPU film limited to the region near the player (chosen)** | Golden-equal to the Fluid Standard; cost bounded (6 grids, 30 m); ships now | Still CPU; far fluids are static decals |
| GPU compute now | Much more headroom | No golden equality; WebGL2 float textures vary by device; one more spike |

## Consensus addendum

- **Antithesis (steelman):** the game is the integration target and already runs a lean version (260 fireballs, 120 debris). Porting the Lab at full fidelity, with goldens on spawn order, adds a large, fragile surface for detail that the cap at 0.3 and the LOD bands then throw away 90% of the time. A data port of the game's `EXP` with the Lab's look would be cheaper.
- **Tradeoff tension:** fidelity to the delivery (R2, CLAUDE.md §1, "Laboratório com o teto do jogo") against the cost of per-frame CPU simulation in a scene with 2000 zombies. This design keeps the Lab as the reference model and puts all the savings in data (profiles, bands, cap) instead of a second, simpler model.
- **Synthesis:** one simulator with three pool profiles. `high` is golden-equal to the Lab; `low` is close to the game's budgets. The comparison page shows both against the Lab and the game, so the owner judges the result visually rather than from the numbers.

## References

Repository: `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/preview-main`, read through `git show origin/main:` (and the phase branches).

- `specs/001-migracao-entregas-dos-times/tasks.md` (Fase 5) and `consolidado.md` §5 E1–E6, §8, §9 (improvements 1, 2, 8, 11): scope and decisions
- `specs/001-migracao-entregas-dos-times/sources/efeitos__laboratorio-explosoes.js`: L131 `PMAX`, L196 seed per puff, L481 `lodFor`, L642–714 `blast`, L795–812 `PROF`, L1015 seed per scene, L1031–1052 sheet and strip
- `specs/001-migracao-entregas-dos-times/sources/efeitos__oficina-vfx.js`: W179–221 `PSys`, W273–279 `FLUID`, W340–345 quality, W406 old `explode`, W463–1244 catalogue, W566–744 film, W1280 descending timers
- `specs/001-migracao-entregas-dos-times/sources/efeitos__padrao-fluidos.js`: F12–42 layout, F45–56 profiles, F60–114 simulation, F333 scene seed
- `specs/001-migracao-entregas-dos-times/artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`: G68194–68204 area cap and distance bands, G67747/67762 pools, G67919 `fxBlood`, G61968 `IDADES`
- `packages/game-destruction-three/src/particles.ts:35–50` (kinds), `:335` (`ParticleSystem`), `renderer.ts:165`, `:819–858` (`onExplode`), `:937` (`emitFire`)
- `packages/game-contracts/src/bench.ts` (bench contract to extend), `module.ts` (`HostEvent` `explosion`, `ModuleHost`), `destruction.ts:325–348` (events)
- `packages/game-test-room/src/explosives.ts:257–267`, `room.ts:202`, `room.ts:333`, `room.ts:2140` (slow motion 0.25)
- `packages/game-weapons/src/explosive-types.ts:23`, `data/explosives.json` (ids mapped to the Lab profiles)
- `packages/game-fluids/src/data/liquids.json` (blood 0x4A0506 / 1200 s today), `packages/game-fluids-three/src/quality.ts`
- `packages/game-weapons-three/src/fx/effects.ts` (viewmodel flash; smoke allocates one Mesh per puff)
- `feat/spec-001-fase-2:…/design/T2.1-casas-estrutura-e-destruicao.md` lines 106–110 (`spall`/`stage`/`expose`), 173 (`--expose` in T2.2a), 225 (Dockerfile lesson)
- `feat/spec-001-fase-4:…/design/T4-personagens-e-animais.md` lines 88–92 (`body` event, `leak` blood), 145 (bleeding)
- `specs/001-migracao-entregas-dos-times/evidence.md` T0.3 (`renderer.explode` fix, `rgbStart`/`rgbEnd`), T1.5 (chain timings)
- Team sources copied for reading: `/tmp/claude-1000/-home-miyazaki-Documents-personal-zombiada/c902afef-aca5-4dbc-b012-c593edf5bcd4/scratchpad/src/`