# Fase 8 — Multidão, histórias e jogador (desenho do architect/opus, 2026-10-24)

Perguntas do §7 seguem pelo padrão reversível de cada uma; ficam listadas aqui e na evidência para o dono decidir.

## Summary

Phase 8 adds four packages and touches three existing ones:

- **`game-player`** (pure, no three): the game's player body. It ports the `player` object, `playerUpdate`, `shove`, `knife` and `frontZombies` of
  `jogo.js` literally: stamina, wounds and bleeding, an optional individual infection, being grabbed and breaking free, knock-downs, footstep noise,
  and the shove and knife answers. The world is reached through callbacks, and every number lives in `data/defaults.json` with its `sources`.
  The infection rule is **off by default** (normal world first, G7). The undead rule comes from `game-characters-undead`.
- **`game-crowd`** (pure): any crowd as a struct of arrays. It ports the game horde engine literally:
  - relevance bands R0-R3 with hysteresis, perception, the sliced flow field, separation, 6 attack slots, wandering and the chain alert;
  - doors and piles, abilities as traits, corpses, population and migration.
  - Civilians (`npcUpdate`/`npcMove`), the herd (`bichosUpdate`) and the flock (vultures and the Bancada birds) are behaviour kinds of the same engine.
  - `bindInfection` ties it to `game-infection` with `materialize`/`giveBack` (P12).
  - The zombie types are content: `game-characters-undead` gets `undeadCrowdTypes()`.
- **`game-crowd-three`**: the instanced renderer (port of `hordeRender`, which uses the `game-characters-three` variant batches) and the crowd test module.
- **`game-stories`** (pure; 🧠 opus): roles, seeded casting, stories as data that cross each other, a chronicle, and the **character sheet**:
  - The sheet has point-buy attributes, skill milestones, traits with exclusions, derived values as formulas, personality, memories and opinions.
  - It accumulates the decisions and stories the character lived through (P13).
  - The life simulation of Os Vivos do Vale (`life`, `world`, `apply`, `simulate`) is ported as a set of generic rules with options.
  - The ZombiAdA cast, its 47 events and its 13 actions stay in the game slice (`game-slice/stories/`) for the zombiada repository (P9).
- **`game-characters-people`** gets the generic content: pt-BR first-name, surname and baby-name pools and kinship words (`NM`, `RELW`), plus the sheet
  ruleset of the Personagens document (6 attributes, 24 skills with milestones, the 12 professions' skill bonuses and 18 traits). The 12 professions
  are the same ones it already has.

"Igual ao original" is checked the same way as in T4. The team functions are cut literally from the source (`@adatechnology/golden-tool/cut-source`).
They run in `node:vm` with the game's seeded `rng` and stub worlds, and the SDK must reproduce the recorded event sequence and states frame by frame.

## Analysis

### 1. Source map (line → destination)

**Game `jogo.js`** (`artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`, 70 946 lines; the most recent full game; G below)

| Lines | What | Destination |
|---|---|---|
| G 62004–62006 `FICHA` (all 5), `DERIV`, `INFEC`, `FERIDA`, `BANDS`, `HYST`, `CORPOS_MAX`, `CORPO_VIDA` | player vitals formulas; infection timeline; wound table; relevance bands | `game-player/data/defaults.json` (`derived` formulas, `wounds`, `infection`); `game-crowd/data/defaults.json` (`bands`, `hysteresis`, `corpses`) |
| G 62028–62034 `rng` (mulberry32), `R = rng(20261022)`, `pick` | the shared seeded stream | the game's `R` is one stream for everything. Each package takes `random: () => number` (default `createRng(seed)` from `game-characters`); the golden passes the same stream |
| G 61949–61963 `CATS` (13 types: peso, vida, vel, dano, bite, mult, perc, olho, noite, crawl, corpos, escala, porte), `IDADES`, `ROUPAS` | horde rule data | already in `game-characters-undead` (`types.json`, `ages.json`, `outfits.json`); new `undeadCrowdTypes()` maps them to `CrowdType` |
| G 62160–62170 grid `GC 0.5`, `occ` 0/1/2/3/4/5, `occH`, `cellOf`, `solidAt`, `fillRect`; G 63798 `doorAt`; G 63816 `setDoor`; G 64044 `doorHit` | navigation grid and doors | `game-crowd/src/grid.ts` (`createNavGrid`), `doors.ts` (door store, `hit` with the game's 30% sound draw, planks, break) |
| G 66717–66745 `Z` SoA (ZMAX 6000, 60 fields), `HC`, `hHead`, `hNext`, `flow`, `FLOW_R 192`, `noises`/`emitNoise`, `stats` | crowd store | `game-crowd/src/store.ts` (typed arrays, same field names in English), `spatial.ts`, `noise.ts` |
| G 66746–66773 `zSpawn` (draw order: type, age with runner ≤ 1, outfit, 3-draw gaussian height × escala, build band, sp/wsp jitter, hp, atkT, variant, yaw, ph, next, col, skin, then `zSpecialSpawn`) | spawner | `spawn.ts`, same draw order; type/age/outfit pickers are injected by the type pack |
| G 66774–66784 `zRemove` (swap with last, grab fix-up) | removal | `store.remove` |
| G 66785–66834 `flowStart`, `flowStep(budget)` (ms budget via `performance.now`), `losClear` | sliced flow field, line of sight | `flow.ts`, budget in **cells** by default, `clock` option for the game's ms budget (golden passes a fixed clock) |
| G 66835–66977 `hordeUpdate` | the main loop | `update.ts` literal port: bands, timers, perception (night, crouch, age, cone, LOS, smell), noises, screamer trigger, abilities, desired move, flow, pyramid, separation `0.31·(bi+bj)` / 1.26 / ×2.2, 6 slots, wander pauses, smoothing `1−exp(−dt·(b===0?9:5))`, blocked moves, jumps, pile steps, door hits (1.5 s, ×3 brute), frame, arms, phase `walkCad`, yaw |
| G 66979–66995 `groan` (chain alert 8 m, delay 0.2 + R·0.4; voice budget 0.25 s under 40 m), `screamAt` (150 m, boost 30 s) | alerts | `alerts.ts`; voices go out as `SoundRequest` (`groan`, `scream_hoarse`) through the host |
| G 66996–67009 `zAttack` (1.5 s; brute 35% wind-up 0.8 s; grab if `R() < bite·(crouch?1.3:1)`; hurt `dano·(crawl?0.6:1)`; charred burn 4 s) | attack on the target | `attack.ts`; target is an interface (`CrowdTarget`) that `game-player` implements |
| G 67010–67045 `zDamage` (region, helmet, vest, dismember) | damage per agent | `damage.ts`, SoA port of the rule that `game-characters` already ported per character; checked against the existing `game-damage-regions.json` fixture |
| G 67046–67097 `zKill`, `inchadoBurst`, `CP` corpses, `corpseAdd`, `corpsesUpdate`, `ZVAR` variants | death, corpses, variants | `kill.ts`; corpses use `createCorpseLedger` from `game-characters` (same swap rule); variants (`lento 4 / corredor 3 / rastejante, brutamonte 2 / others 1`, seeds `7000+c·101+v·13`) in `variants.ts` |
| G 67098–67140 `hordeRender` (LOD [18, 55] m, hysteresis 1.5, pose mapping, attack-pose hysteresis 1.6/2.2 m) | drawing | `game-crowd-three/src/renderer.ts`, on `BodyBatch`/`createVariantBatches`/`lodAt` of `game-characters-three` |
| G 67141–67179 `spawnAway`, `populate`, `populationUpdate` (target 1200, excess removal, migration of 120 every 90 s) | population | `population.ts`, numbers as options |
| G 67180–67400 abilities: pile (`PILE_STEP 0.48`, `PILE_TOP 3.7`, `PILE_MAX 160`), `groundAt`, `zBlockedAt`, `tryStep`, `stepRelease`, `pileBlast`, `POOL`/`inWater`, `TRAIL`/`trailUpdate`, `zSpecialSpawn`, `zAbility`, `zChaseSpeed`, `zHurtOther`, `killQ`, `zFrame` | the 13 types' special moves | `abilities/*.ts` as **traits** read from the type: `ambush`, `submerged`, `heavySwing`, `eatsCorpses`, `tracker`, `pounce`, `burst`, `caller`, `fire`, `water`, `vault`, `doorMultiplier`, `pile`. A `plugins` option adds custom traits |
| G 66592–66715 `bichoNovo` (`vAnda = walkHz·size·1.05+0.25`, `vCorre = runHz·size·2.2+0.8`, raio 8, medo 5), `bichoLivre`, `bichosPovoar`, `bichosUpdate` (companion 2.2 m behind; fear `medo`; alarm; moo; barks within 12 m; vultures circle the corpse centroid) | herd and flock | `behaviours/herd.ts`, `behaviours/flock.ts`; species numbers come from `game-animals-species` |
| G 68427–68640 `player`, `playerUpdate`, `frontZombies`, `shove` (1.6 m, cone 0.3, stun 0.9 s, 2.5 m/s), `knife` (region draw: 35% head …) | the player | `game-player` (§2) |
| G 70042–70170 `npcZombies`, `zChaseNpc`, `npcMorre`, `npcVira`, `npcMove` (whiskers 0, ±0.7, ±1.4; doors; lerp `dt·8`), `npcUpdate` (fear 3.4 m/s under 6 m else 1.3; child ×0.85; bitten ×0.8; group follows leader; routine by hour) | civilians | `behaviours/civilian.ts`; the bite timer uses `INFEC.morte` from the player defaults (`game-player` exports it) |
| G 65507–65508 `walkCad(v) = 0.5 + 0.3·v`, `walkGait`; G 67427 `solidAtA` | gait cadence; solid with height | `game-crowd/src/gait.ts` (re-exports the cadence the renderer needs) |
| G 68469 `PB` (Cícero, Sandra bodies), G 70172–70290 named-zombie patrol | the game's named NPCs | game content: `game-slice/stories/roles.json` turns them into roles (P9) |

**Bancada de Hordas** (`sources/jogo__bancada-de-hordas.js`)

| Lines | What | Destination |
|---|---|---|
| 53053–53300 `class Horde` (seeded; ms flow budget; `SEP_R 0.62`; 1 m grid; shot with penetration, brute costs 2) | the benchmark engine | the **benchmark target** for `game-crowd` (goals: 2 000 agents ≥ 30 FPS, 500 ≥ 60 FPS). Not a second engine: the game version is more complete and is the one ported |
| 53483–53643 map-vivo: 40 birds circling (`a = t·0.3 + i·0.4`, `r = 20 + (i%7)·4`, height `25 + sin(t+i)·2`), 20 survivors random-walking at 1.6 m/s, migration every 45 s | flock and wandering civilians | `flock.ts` `orbit` mode (literal formula); `civilian.ts` `wander` mode; migration interval option |

**Personagens** (`sources/zumbis-personagens__personagens.js`, 256 lines; design text in `site/pages/zumbis-personagens/personagens.html`)

| Lines | What | Destination |
|---|---|---|
| 6–13 `ATTRS` (6), 14–44 `SKILLS` (5 groups, 24 skills, milestones at levels 3/6/9), 45–58 `PROFS` (12: pts, sk, b, kit), 59–78 `TRAITS` (18: cost, exclusions) | sheet ruleset | `game-characters-people/src/data/sheet.json` (generic; profession ids map to the existing 12) |
| 137–145 `S`, `BASE_POOL 14`, `MAXC 8`, `MINC 1`, attributes start at 3; `spent`, `traitPts`, `pool` | point buy | `game-stories/src/sheet/point-buy.ts` (rule; numbers in the ruleset) |
| 178–190 `derived()` with trait modifiers (vida, fôlego, carga, corrida, raio, ruído, xp, compostura, dano) | derived values | `sheet/derived.ts` evaluates formulas from the ruleset |
| 79–136 `NPCS` (8 with personality, routine, goal, secret) | named people | game slice (`game-slice/stories/`) |
| design text: needs per hour, 7 body regions, wound types, infection chances (bite 100%, laceration 22%, scratch 6%, blood 3%), NPC LOD 80 m / 300 m / abstract, personality axes, memories ≤ 30, opinion −100..100 decaying (+60 joins, −60 hostile), data model | sheet and memory rules | `sheet/memory.ts`, `sheet/opinion.ts` (numbers as options with `sources`) |

**Os Vivos do Vale** (`sources/sobreviventes__os-vivos-do-vale.js`)

| Lines | What | Destination |
|---|---|---|
| 6–25 `GROUPS`, 26 `RISK`, 28–312 `NPCS`, 313 `EXTRA`, 316–335 `RELS`/`RELTYPES`, 336–347 `JOIN`, 348–350 `STATES`, 351–367 `ACTS`, 370 `START_Z`, 372–498 `EV` (47 events), 499–529 `FACT` | the ZombiAdA cast and its stories | already extracted to `game-slice/characters/`; Phase 8 converts `EV`/`ACTS`/`JOIN` into story data in `game-slice/stories/` |
| 606 `rng`; 607 `FEM`; 608 `REG`; 609 `EXPO`; 610–611 `NM`; 612 `RELW`; 613 `HOSTB`; 614 `CAP 104`, `ROOM 8`; 615 `COUPLES`; 617–618 `NICK`, `short` | life-sim tables | name pools and kinship words → `game-characters-people/data/names.json`; per-place risk, exposure, couples, caps → options of `createLifeSimulation` (the ZombiAdA values go to the slice) |
| 619–739 `world`, `life(d, S, F, R, W, log)` (timers, daily risk, bonds, couples, pregnancy, adoption, rivalry, fights, betrayal, food, caravans, raids, arrivals every 5 days) | life simulation | `game-stories/src/life/*.ts`, rule by rule; draw order preserved |
| 740–757 `apply`, `simulate(day, A, O)` | applying beats; running days | `life/simulate.ts` and `story/apply.ts` |

**Already in the SDK** (used, not rebuilt):

- `game-infection`: `materialize(region, n): Agent[]`, `giveBack(region, batch)`, stages `calm … overrun`.
- `game-characters-undead`: 13 types with abilities, ages, outfits, infection (`pickWound`, `woundInfects`, `createInfectionCase`), speed presets including `team-game`.
- `game-characters`: `createRng`, `createCorpseLedger`, the regions damage rule, `encodePoseHeight`.
- `game-characters-three`: `BodyBatch`, `bakeVariants`, `createVariantBatches`, `LOD_DISTANCES`, `lodAt`.
- `game-animals-species`: species numbers.
- `game-audio`: sound ids `step`, `flesh`.
- `game-weather`: `hearingScale`, `sightScale`, `footstepScale`.
- `game-contracts`: `TestableModule`, `ModuleHost`, bench, `SoundRequest`, `EffectRequest`.

**Missing in the deliveries** (questions, §7): civilian behaviour per outbreak stage ("Multidão civil" exists only as text); demo stories that are not
ZombiAdA; the voices of 7 types (T6.1g still open); the game's floors and roofs (`ANDARES`, `ROOF`) for the pile and roof logic.

### 2. `game-player`

```ts
export type PlayerInput = {
  forward: number; right: number; run: boolean; crouch: boolean; aim: boolean; yaw: number
  bandage?: boolean; push?: boolean; knife?: boolean; vault?: boolean
}
export type PlayerWorld = {
  inWater?(x: number, z: number): boolean
  blocked?(x: number, z: number): boolean
  vaultTarget?(x: number, z: number, yaw: number): { x: number; z: number; y: number } | null
  front?(range: number, cone: number): readonly CrowdHandle[]   // game-crowd implements it
}
export type PlayerOptions = {
  random?: () => number; seed?: number
  sheet?: Partial<Attributes>           // FICHA, default 5-5-5-5-5
  derived?: DerivedFormulas             // DERIV as data
  wounds?: WoundTable                   // FERIDA
  infection?: InfectionRule | false     // default false (normal world)
  numbers?: Partial<PlayerNumbers>      // every constant of playerUpdate, with sources
}
export type Player = {
  readonly state: PlayerState                      // hp, stamina, bleed, wounds, infected, grab, down, ...
  update(dt: number, input: PlayerInput, world?: PlayerWorld): void
  hurt(amount: number, kind: WoundKind | 'blunt' | 'fire'): void
  bite(by?: number): void
  grab(by: number, seconds?: number): void
  knock(seconds: number): void
  on(event: PlayerEventName, fn: (e: PlayerEvent) => void): () => void
  save(): PlayerSave; load(s: PlayerSave): void
}
export const zombieInfection: (pack?: UndeadInfectionData) => InfectionRule  // from game-characters-undead data
```

Events: `noise {x, z, radius}`, `sound {sound, position}` (`step`, `flesh`), `hurt`, `wound`, `infected`, `stage` (fever, delirium), `died`,
`grabbed`, `released {how}`, `knifeHit {target, region, damage, cut}`, `shoved {targets}`, `message {id}` (no text in the core).

### 3. `game-crowd` and `game-crowd-three`

```ts
export type CrowdType = {
  id: string; weight: number; health: number; speed: [wander: number, chase: number]
  damage: number; bite: number; perception: [sight: number, hearing: number, smell: number]
  eye?: number; night?: number; crawls?: boolean; bodies?: number; scale?: number; build?: number
  traits?: Readonly<Record<string, unknown>>        // ambush, pounce, burst, caller, tracker ...
}
export type CrowdOptions = {
  capacity?: number; random?: () => number; seed?: number
  types: readonly CrowdType[]; pickAge?(r): AgeRow; pickOutfit?(r): OutfitRow
  grid?: NavGrid; bands?: Band[]; flow?: { radius?: number; budget?: number; clock?: () => number }
  plugins?: readonly CrowdTrait[]; numbers?: Partial<CrowdNumbers>
}
export type Crowd = {
  readonly store: CrowdStore
  spawn(x: number, z: number, type?: number, extra?: SpawnExtra): number
  remove(i: number): void
  update(dt: number, ctx: { targets: readonly CrowdTarget[]; time?: number; nightF?: number }): void
  emitNoise(x: number, z: number, radius: number): void
  damage(i: number, hit: CrowdHit): CrowdDamageResult
  on(event: CrowdEventName, fn: (e: CrowdEvent) => void): () => void
}
export const createCivilians: (crowd: Crowd, options?) => Behaviour
export const createHerd: (crowd: Crowd, species, options?) => Behaviour
export const createFlock: (options) => Flock
export const bindInfection: (crowd: Crowd, infection: Infection, options: { region: string; typeFor?(agent): number }) => Unbind
```

`game-crowd-three`: `createCrowdRenderer({ THREE, scene, crowd, batches })` and `createCrowdTestModule()`. Effects go through `host.effects`
(`blood` on bites and kills) and sounds through `host.audio`.

### 4. `game-stories`

```ts
export type Role = { id: string; tags?: string[]; needs?: { age?: [number, number]; sex?: 'f' | 'm'; profession?: string[] } }
export type StoryBeat = {
  day: number; roles: string[]
  when?: Condition                       // on states, flags, actions, sheet values
  variants: { when?: Condition; text: string; changes?: Change[]; flags?: Record<string, unknown> }[]
  run?: string                            // id of a code beat registered by the game
}
export type Story = { id: string; roles: Role[]; beats: StoryBeat[]; crosses?: string[] }
export type World = {
  cast(options: { stories: Story[]; people?: Person[]; names: NamePools; seed: number }): Casting
  day(d: number, actions: ActionLog): DayResult             // beats + life rules, chronicle entries
  sheet(id: string): CharacterSheet
}
export type CharacterSheet = {
  attributes; skills; traits; derived(); personality; memories; opinions
  record(entry: { kind: 'decision' | 'story' | 'event'; id: string; day: number; weight?: number }): void
}
```

### 5. Goldens

| Golden | Harness (cut from) | Seed / input | What is compared |
|---|---|---|---|
| `game-player.json` | G `player`, `playerUpdate`, `frontZombies`, `shove`, `knife`, `DERIV`, `INFEC`, `FERIDA` | `rng(20261022)`; 6 scripted runs (walk, sprint to empty, crouch, bite + bleed + bandage, grab + 6 pushes, grab timeout, infection to death) | per-frame state (hp, stamina, bleed, wounds, infected, grab, down, x, z) and the event sequence |
| `game-crowd.json` | G horde section (`Z` … `zFrame`) with stub `ANDARES = []`, `ROOF.on = false`, fixed clock | `rng(20261022)`; 4 scenes (200 wander, chase a target, door hit, pile against a wall) | event sequence (spawn, alert, groan, attack, grab, kill) and an fnv1a hash of the SoA after N frames |
| `game-crowd-civilians.json` | G `npcUpdate`, `npcMove`, `npcZombies`, `npcVira` | same stream; 1 civilian group + 3 walkers | positions and turns |
| `game-crowd-herd.json` | G `bichoNovo`, `bichosUpdate` | same stream; cows, a dog and vultures | positions, alarms, calls |
| `game-stories-life.json` | Os Vivos `life`, `world`, `apply`, `simulate` with the canonical cast | `simulate(60, {}, {vivo: true, seed: 7})` and 2 more seeds | the daily log and the final `S` |
| scene hash | `tools/golden/scene-hash.ts` of the crowd test area | fixed seed | instanced matrices |

### 6. Test areas

- `examples/player-test-area` loads `createPlayerTestModule()` (in `game-player`, pure like `game-weather`). The camera is the player. Bench controls:
  infection on/off, grab now, bite, bandage. Metrics: hp, stamina, bleed, infection stage.
- `examples/crowd-test-area` loads `createCrowdTestModule()` (in `game-crowd-three`). Scenarios: horde 500 / 2 000, civilians fleeing, herd, flock,
  infection bridge (stage slider). Metrics: agents, FPS, flow cells per frame.
- `examples/stories-test-area` loads `createStoriesTestModule()` (in `game-stories`, a bench without 3D). The seed and the day slider show the
  chronicle and one sheet.
- All three load into `examples/interactables-test-area`.

### 7. Ordered tasks

| # | Commit | Model | Group |
|---|---|---|---|
| T8.0 | this design doc, tasks and evidence | opus | A |
| T8.3 | `game-player` core, defaults with sources, golden harness and fixture, test module, `examples/player-test-area`, site, CI, skill | sonnet | B |
| T8.1a | `game-crowd` core: store, grid, doors, flow, spawn, update, alerts, attack, damage, kill, corpses, population, abilities; golden | sonnet | C |
| T8.1b | civilians, herd, flock, `bindInfection`; `undeadCrowdTypes()` in `game-characters-undead`; goldens | sonnet | C (after a) |
| T8.1c | `game-crowd-three` renderer, test module, `examples/crowd-test-area`, site, CI, skill | sonnet | C (after b) |
| T8.2 🧠 | `game-stories` (casting, story data, chronicle, sheet, life simulation); name pools and sheet rules in `game-characters-people`; `game-slice/stories/`; golden; `examples/stories-test-area` | opus | D |

### 8. Business questions (each has a reversible default)

1. **Civilians per outbreak stage.** No code, only the "Multidão civil" text. Default: `calm` keeps the routine, `cases` speeds up the routine,
   `panic` makes them flee at 3.4 m/s (the game's fear speed), and `fallen`/`overrun` hide them indoors. Reverse: the `stageBehaviour` option.
2. **Demo stories for the kit bench.** Only ZombiAdA stories exist. Default: the bench loads the slice stories through a file input and ships
   two tiny stories written from the generic roles, marked as kit examples. Reverse: drop them.
3. **Package names.** `game-crowd`, `game-crowd-three`, `game-player` and `game-stories` (P9 said "ex. `game-stories`").
4. **Voices of 7 zombie types.** The crowd asks for `groan`/`scream_hoarse`/`runner_groan`. T6.1g is not on main yet, so the host decides what plays.
5. **Floors and roofs** (`ANDARES`, `ROOF`) are not ported; the crowd takes `groundAt`/`blockedAt` callbacks. The pile logic works on the grid only.
6. **More than one target.** The game chases a single player. The crowd takes a list of targets and picks the nearest (same as the game with one).
7. **Personagens skill milestones that mention hordes and zombies** (e.g. "Garrafa para distrair horda") stay literal in the generic ruleset.
   Reverse: move those milestone strings into the game slice.
8. **The infection rule of the player** is off by default. The zombie rule (`zombieInfection()`) uses the game numbers (`INFEC`, `FERIDA`).
   It draws `R` exactly like the game, including the draw when the chance is 1.

## Root Cause

The horde, the player and the people's lives live inside one 70 000-line file and two design pages. They share one random stream and talk through
globals (`player`, `Z`, `ANDARES`). Nothing could be reused by a second game. The fix keeps every team number and every draw order. It replaces the
globals with callbacks and typed options, and it moves the ZombiAdA-only content (named people, stories, factions) to the game slice.

## Recommendations

1. Port the game version, not the Bancada: the game has the abilities, doors, piles and civilians; the Bancada stays as the benchmark.
2. Keep one `random` per package instance; the game passes its single stream to all of them to keep its order.
3. Keep `game-player` free of the crowd: they meet through `CrowdTarget` and `PlayerWorld.front`.
4. Write the stories engine as data plus registered code beats, because some of the 47 `EV` events need code (`run(S, A, F)`).

## Trade-offs

- A literal SoA port is less idiomatic TypeScript but keeps the draw order and the speed (6 000 agents).
- The flow budget in cells instead of milliseconds makes the crowd deterministic; the game's ms budget stays available via `clock`.
- The life simulation keeps the team's tables as options. That means many options, but every game can tune them.

## References

- `CLAUDE.md` §1–4; `consolidado.md` P9, P12, P13, V6, G7.
- `inventario/personagens-animais.md` (horde source map, Bestiário scenes, Personagens and Vivos data).
- `inventario/veiculos-moveis-vegetacao-jogo.md` §1.10, §1.11, §3.4.
- `design/T4-personagens-e-animais.md` (vm goldens), `design/T6-som-e-clima.md` (format).
