# Fase 4 — Personagens e animais (desenho do architect/opus, 2026-10-24)

Perguntas do §6 decididas pelo padrão reversível (autopilot, 2026-10-24), listadas no PR.

## Summary

Phase 4 adds eight packages and one helper:

- **Engines (no three):** `game-characters` and `game-animals`.
- **three.js adapters:** `game-characters-three` and `game-animals-three`.
- **Content packs:** `game-characters-people` (civilians), `game-characters-uniformed` (generic forces) and `game-animals-species`.
- **Zombie-only layer:** `game-characters-undead`, which also holds the animal infection rule, so a GTA-style game never imports anything about zombies.
- **Helper:** a GPU "node skin" in `game-props3d`, generalised from the game's `bichoPele`.

Named people, their stories, the valley groups and 7º BIS go to the zombiada repo as a generated content slice.

Three decisions shape everything else:
- **P7 has a closed-form calibration.** It reproduces the Bestiário table exactly (9 mm hits 2 bodies, 5.56 hits 3, .308 hits 4) using only data `game-weapons` already has.
- **Two detail levels share one damage model.** The 11 segments use the Arsenal numbers (A4); the 6 crowd regions use the game's `zDamage` numbers. The game's bitmask layout stays as it is, so the GLSL ports verbatim.
- **Goldens re-run the team's own code.** Pure logic is cut from the source and run with the seeded RNG passed in, so most goldens match exactly instead of only structurally.

## 1. Source map

Anchors in G are exact. The inventory's `livre:` anchors are G + 4326 across this region (checked on 25 symbols).

| Team piece | Source (file:lines) | Destination |
|---|---|---|
| 13 types: weight, hp, speeds, damage, bite, `mult`, perception, `escala`/`porte`, eye | G 61950–61965 `CATS`; `bestiario:6-46` `Z` (text fields: role, ai, counter, voice) | `tools/characters-catalog` → `game-characters-undead/src/data/types.json` |
| Infection ages | G 61968 `IDADES`; `bestiario:2` table (adds perception), `bestiario:76-78` `SKIN/BLOOD/CLOTH` | `undead/data/ages.json` |
| Outfits with protection | G 61976 `ROUPAS` (vest `{pistola,fuzil}`, helmet, fire, `membro`, loot) | `undead/data/outfits.json` → item ids in `game-items` (`protection.ballistic`, below) |
| Region HP and calibres (game) | G 61984 `SEG`, 61987 `CALIBRES`, 61993 PEN cost note, 68699–68724 `shootRay` | `game-characters/src/presets/team-game.json` (golden preset only) |
| 11-segment HP, multiplier and bleed (Arsenal) | `arsenal:856-860` `BLEED/MULT/HPS/ZW`; `damage` 979–992; `sever` 967; `explodeSeg` 970; `legLost` 977; `splitTorso` 978; `addBleeder` 888; `exitWound` 930; `gouge` 953; `grenadeAt` 1004; `zWalk`/`zCrawl` 945/952 | `game-characters/src/damage/*` (rule); `-three/src/wounds/*` (dynamics) |
| Cut rule, broken bone, pendulum | `elenco:336-339` `segs`, 447 `BELOW`, 448 `FALLS`, 449 `sever`, 458 `breakBone`, 461 `WEAPONS` (cut), 463 `hit`, 593 `pends` | `game-characters/src/damage/hierarchy.ts`, `cut.ts`; `-three/src/wounds/pendulum.ts` |
| Crowd damage | G 67011–67045 `zDamage`, 67046 `zKill`, 67053 `inchadoBurst`, 67958 `fxLimb`, 67919 `fxBlood` | `game-characters` regions detail; burst hook in undead; `-three/src/instanced/flying-limbs.ts` |
| Spawn variance | G 66746–66779 `zSpawn` (height gaussian, build band, speed/hp jitter, age clamp for runner) | `game-characters/src/appearance/variance.ts` + undead `createUndead` |
| Speed modifiers | G 66907 scream ×1.2, 66918 crawl ≤ 0.4 / limp ×0.5, 67357 `zChaseSpeed` (stalker 4.0/1.4, drowned 3.0 in water) | `undead/src/speed.ts` + `data/moments.json` |
| Joints and proportions | G 65336 `J` (shoulders ±0.24); `elenco:244` shoulders ±0.305/±0.285 at y 1.475; guide text `elenco:2` | `game-characters/src/body/body-spec.ts` (`GUIDE` default, `TEAM_GAME` preset) |
| Instanced body | G 65341 `tagGeo`, 65354 `mergeBody`, 65367 `buildBody`, 65400 `bodyChunk` GLSL, 65473 `bodyMaterial`, 65507–65508 `walkCad/walkGait`, 65509 `BodyBatch`, 65541 `BODY_LOD` | `-three/src/instanced/*`; `walkGait` → `game-characters/src/gait/stride.ts` (pure) |
| Bestiário v17 builder | G 65787–66014 `BEST` (`TYPES` 65821, `OUTFITS` 65836, `build` seed streams `VR`/`BR` 65858–65859, `setLOD` 66013) | `-three/src/rich/best-builder.ts` (literal port) |
| Bake and variants | G 66017 `BAKE_NEUTRO`, 66019 `bakeBody`, 67079–67092 `ZVAR` (seeds `7000+c·101+v·13`) | `-three/src/instanced/bake.ts`, `variants.ts` |
| Survivor body | G 65546–65783 `buildRetrato`; `retratos:64-308` `build`, 309 `MOVES`, 320 `pose`, 339 `zombify` | `-three/src/rich/person-builder.ts` + accessory registry; `zombify` → undead visual hook |
| Human moves | `elenco:358` `MOVES`, 576–591 cascade, limp, crawl | `game-characters/src/gait/moves.ts` |
| Gait per type and cascade | `bestiario:97-112` `BASE/TYPES`, 286–300 `GAIT`, 301–320 `animate/animate0`, 322–323 `CASC/cascade`, 332/340 `setPose/lerpPose` | gait/pose data in undead `types.json`; animator in `-three/src/rich/animator.ts`; CPU math in `game-characters/src/gait/*` |
| Keyframed scene clips (grab and bite) | `bestiario` scene `HK`/`ZK`/`PH` and `sample` (smoothstep + `lerpPose`) | `game-characters/src/pose-clips/*` + `presets/pose-clips.json` (`grabbed_bitten_human`, `grab_bite_zombie`); player body in `-three/src/player/avatar.ts` (crouch/down/aim from `BODY_CHUNK`, camera from G `cameraUpdate` 76546-76558). Punch, shove, kick and shot clips: not delivered by any team; authored in the kit as data in `game-characters-people/src/data/attack-clips.json` (`ATTACK_CLIPS`: `punch_right`, `shove_two_hands`, `front_kick`, `recoil_rifle`, `recoil_pistol`, 2026-10-25), replace with the Elenco team's clips when delivered |
| Infection timeline | `elenco:67` `STAGES`, 374 `applyStage`; G 62015 `INFEC`, 62016 `FERIDA` | engine `ConditionTimeline` in `game-characters`; data and visual stage in undead |
| Corpses | G 62021 `CORPOS_MAX 400`/`CORPO_VIDA 900`, 67063 `corpseAdd`, 67070 `corpsesUpdate` | `game-characters/src/corpses.ts` (generic) |
| Professions and accessories | `elenco:14-39` `PROFS`; `retratos:114-299` hair, face, hats, ~80 accessories, hand items | `game-characters-people` (data) + `-three/src/rich/accessories/*` |
| Forces and ranks | `vivos:499-603` `FACT/RANKS/RANKRULE/LOOT/GENT` | `game-characters-uniformed` (generic forces); 7º BIS and named units → game slice |
| Named people, groups, life sim | `retratos:344-437` `PEOPLE`, `vivos:6-497`, `vivos:605-757` | `zombiada/content/characters/*` (via `--game-out`) |
| Animals | `bichos:9-75` `SPECIES`, 147 `Animal`, 162 `quad`, 235 `bird`, 280 `snake`, 299–342 `SPEC`, 345 `ORDER`, 362 `setInfected`, 373–374 `setJoint/setSplit`, 378 `GAIT`, 379/404/421 `anim*`; rule text at line 2 | `game-animals` (spec, gaits), `game-animals-species` (13), `game-animals-three` (literal port), rule → `undead/src/animals` |
| Animal GPU skin and behaviour | G 66146 `BICHOS` (copy of the page; ignored), 66536 `bichoPele`, 66592 `bichoNovo`, 66607 `bichosPovoar`, 66648 `bichosUpdate` | `game-props3d/src/node-skin.ts`; behaviour → Phase 8 `game-crowd`; povoamento → game slice |
| Abilities and horde | G 67257 `zSpecialSpawn`, 67266 `zAbility`, 66835 `hordeUpdate`, 67188 pile, 67234 `POOL` | Phase 8 (`game-crowd`); Phase 4 ships only ability **parameters** plus the damage-related hooks |

**The eight bodies (improvement 10): which version wins per piece**

| Piece | Winner | Others |
|---|---|---|
| Proportions | Elenco guide (1.80 m, shoulders 0.61/0.57 m, head ≈1/6) | Game `J` 0.48 m kept as the `TEAM_GAME` golden preset; Mapa and Bancada dropped |
| Rich mesh with LOD and marked bones and eyes | `BEST` v17 (G) | Bestiário v0.1 is text and gait data only |
| Survivor detail, hands, accessories | Retratos (superset of Elenco), via G `buildRetrato` | Elenco's builder is not ported |
| Crowd execution | G `buildBody` + `bodyChunk` + `BodyBatch` + `bakeBody` | Bancada `buildZombie`: only its triangle budget (2,500/800/250) becomes a budget test |
| Segment tree | Arsenal's 11 segments (ids already in English) | Elenco has 8 kinds, game has 6 regions (the regions become the crowd detail level) |
| Cut, dangle, limp | Elenco hierarchy and pendulum | Bestiário `cut` presets become static poses for test scenes |
| Gore dynamics | Arsenal | — |
| Crowd damage | Game `zDamage` + bitmask | — |
| Mapa figures | Replaced by instanced LOD2 | — |

## 2. Packages, types and dependencies

```
game-contracts ← game-characters ← game-characters-{people,uniformed,undead}
               ← game-characters-three  (three peer, game-props3d; optional: game-fluids-three, game-items-three, game-weapons-three)
               ← game-animals ← game-animals-species
                              ← game-animals-three (three peer, game-props3d)
game-characters-undead → game-characters only; animals and game-infection are structural types, not imports
```

There are no cycles. The engines never import three, and neither engine imports `game-weapons` or `game-items`: everything goes through `game-contracts`.

**`game-contracts`** (new `body.ts`; all fields optional; minor bump):

```ts
export type BodySlot = 'head'|'eyes'|'torso'|'arms'|'hands'|'legs'|'feet'|'over'   // the ITE `slot` vocabulary; game-items imports it from here
export type SegmentKind = 'head'|'jaw'|'neck'|'torso'|'pelvis'|'upperArm'|'forearm'|'hand'|'thigh'|'shin'|'foot'
export type BodyRegion = 'head'|'torso'|'armL'|'armR'|'legL'|'legR'               // game regions 0..5
export const MISSING_BITS = { head:1, armL:2, armR:4, legL:8, legR:16, armLBroken:32, armRBroken:64, legLBroken:128, legRBroken:256, jaw:512 } as const  // = G 67017–67035; the shader depends on it
interface Hit { mass?: number /* projectile g */; cut?: number /* 0..1 */; part?: string /* resolved part, crowd raycast */ }
interface Shot { mass?: number }                                                  // game-weapons fills it from bulletGrams; shotToHit copies it
| (EventBase & { type: 'body'; part?: string; change: 'wound'|'broken'|'severed'|'destroyed'|'split'|'limp'|'crawl'|'stunned'|'killed'; cause?: 'head'|'vitality'|'bleed'|'explosion'; below?: string[]; exit?: Vec3 })
interface ObjectState { body?: { alive: boolean; vitality: number; missing: number; limp: boolean; crawl: boolean } }
```

The rest reuses existing events: `detach` (a severed limb, with `groups` = the parts that fall), `hole` with `exitPoint` (entry and exit wounds), `leak` with `fluid:'blood'` (bleeding), `fracture` (a segment destroyed into pieces).

**`game-characters`:**

```ts
createCharacters(o?: { packs?: CharacterPack[]; patch?; remove?; body?: Partial<BodySpec>; damage?: Partial<DamageRules>;
  penetration?: PenetrationModel | 'physical'|'team-game'; protection?: Record<string, ProtectionLayer>; gaits?; corpses?: { max: 400, seconds: 900 } }): CharacterKit
kit.create(spec: CharacterSpec): Character      // spec: { seed, kind:'person'|string, sex?, age:'child'|'young'|'adult'|'elder', height?, build?, outfit?, protection?: itemId[], traits?: Record<string,unknown> /* undead.type sets here */ }
Character: DestructibleImpl & { rig: Rig; segments: SegmentState[]; detail: 'segments'|'regions'; speedFor(moment, env): number;
  gait(speed): GaitSample; condition: ConditionTimeline; lootQuery(rng): FindsQueryLike; setDetail(d) }
BodySpec / Rig: joints hip, spine, neck, head, jaw, shoulderL/R, elbowL/R, wristL/R, hipL/R, kneeL/R, ankleL/R; the game bone ids 0–11 as a map
```

**Damage pipeline** (pure, one rng stream per character, `createRng(seed ^ hitCounter)`):

1. **Resolve.** `hit.part` (or a raycast against the `describe()` capsules) gives a segment, and the segment gives its region.
2. **Protection.** Item layers on the segment's `BodySlot`, from `game-items` `ItemDef.protection`. Phase 4 adds an optional `ballistic: { resistance, blunt, pass?, consumable? }`.
   - Layered `bite`/`scratch` stays the T3 formula.
   - Presets reproduce `ROUPAS`:

   | Preset | Resistance | Blunt | Pass | Other |
   |---|---|---|---|---|
   | Police vest | 14 | 0.3 | 0.8 | — |
   | Military vest | 28 | 0.5 | — | — |
   | Helmet | 9 | — | — | consumable (absorbs one pistol-class shot, then lost) |
   | Firefighter | — | — | — | fire 0.25, limbs ×0.8 |

3. **Penetration (P7, `physical` default).**
   - Force: `P = √(E·m / A)`, with E = `shot.energyAt(d)` in J, m = projectile g, A = πd²/4 in mm².
   - Resistance: segment R = Σ layer (tissue per cm × path cm) + protection. Calibrated so torso = 7.5 (flesh 22 cm × 0.25 + bone 2 cm × 1.0), head = 0.7×, limb = 0.5× (the game's `custo`), brute torso = 2× (`corpos:2`).
   - Rule: hit, then subtract `P -= R`; stop when P ≤ 0 (the game's semantics).
   - Energy carried to the next body: `× P/(P+R)`.
   - Checked against calibers.json, number of bodies hit:

   | Calibre | P | Bodies hit | Target |
   |---|---|---|---|
   | 9×19 | 7.67 | 2 | 2 (Bestiário) |
   | 5.56 | 16.56 | 3 | 3 (Bestiário) |
   | .308 | 26.67 | 4 | 4 (Bestiário) |
   | 7.62×39 | 18.52 | 3 | 3 (game pen 3.0) |
   | 00 buck | 4.35 | 1 | 1 (game pen 0.5) |

   - Energy kept per body: 0.51 / 0.69 / 0.78, against the Bestiário's 0.50 / 0.65 / 0.75. A test enforces the counts exactly and the energy within ±0.05.
   - The `team-game` preset is the game's pen points with ×0.75 per body, used only by the golden.
4. **Points.** Engine is in joules (A2). Default `points = 3.5·E^0.37` (9×19 → 35, 7.62×39 → 59, .308 → 71). Per-calibre tables override it; the ZombiAdA table lives in the game slice.
5. **Multipliers.** Segment `MULT` (Arsenal) × type `mult[head,torso,arms,legs]` × age `membro` × outfit `membro`.
6. **Severity per segment.**
   - At HP 0: **destroyed** (`fracture`, Arsenal `explodeSeg`) if explosive or damage ≥ 2×max; **severed** if `cut ≥ 0.5` or damage > 0.9×max (game and Elenco agree); otherwise **broken**.
   - Severing cuts at the joint above, and everything in `BELOW` falls with it (`detach.groups`).
   - Legs: ≤ 50% → `limp`; lost → `crawl`. Torso or pelvis ≥ 150 → `split`.
   - Head: the game rule (`cranio` distance, ≥ 20 kills, the helmet rule, bit 1 at > 60 or 12 ga under 5 m; non-lethal > 25 → 30% jaw, bit 512).
   - `cut` defaults by damage type: slash 0.85, blunt 0, explosive 1; ballistic from the Elenco table (pistol 0.15, buck 0.75, rifle 0.45).
7. **Death.** `deathRule: 'vitality-or-head'` (game, default) or `'head-only'` (Elenco/Bestiário "golden rule", available as an option).
8. **Bleeding.** Per segment from `BLEED` (rate, duration, spurt), scaled by the age's `sangue`; emits `leak` events.

**Dismemberment in 3 levels.** One rule, three fidelities. `rule` is pure and runs for everyone. `near` (rich path) is the Elenco stump, ring, flying piece and pendulum (springs −26 / −1.8), plus the Arsenal bleeders, exit wound, gouge, explode and split. `crowd` (instanced) is the bitmask in the shader plus G `fxLimb` capsules (max 40). At distance `LOD_D` 18/55 m, `setDetail` swaps `segments` ↔ `regions`. The aggregation is lossless one way only: regions HP = sum of the region's segments, rescaled to SEG.

**Gait (`game-characters/src/gait`).** Pure CPU math:
- `walkCad`/`walkGait` (G 65507);
- `GaitProfile` (f, a, k, arm, bob, sway, drag, special clip);
- a single `CASCADE` table (`bestiario:322`: hip 16, spine 11, shoulder 9, elbow 7, leg 14, knee 11, head 6);
- human `MOVES` with a continuous blend;
- the 8 game poses (walk, crawl, fallen, attack, scream, crouch, leap, eat);
- `strideFromSpeed: true` by default, so feet don't slide. It is `false` in the Bestiário golden preset.

**Also in `game-characters`.** `ConditionTimeline` (generic phases with hours, effects and an accelerated clock option). Corpses (generic, 400 / 900 s). An appearance generator (seed → traits; the `VR`/`BR` streams kept exactly as v17 draws them). `lootQuery` returns `{ place:'body', container: outfitId, state, rng }`, which the T3 `FindsProvider` already accepts, with no import.

**`game-characters-three`.**
- `rich/best-builder.ts`: literal port of v17.
- `rich/person-builder.ts` plus `accessories/` (a registry by id) and hands with fingers. Fingers render only at LOD0, in the rich path.
- `rich/animator.ts`: `animate0`, cascade, `setPose`, `lerpPose`.
- `instanced/`: `bodyChunk` GLSL verbatim, with only the joint uniforms parameterised; `BodyBatch`; `bakeBody`; `variants` (ZVAR rule); LOD 16/10/5.
- `wounds/`.
- `eyes.ts`: additive sprite plus emissive, and `dim`/`off`/`markable`.
- A fluids bridge: an optional `game-fluids-three` that is injected.
- Hand items: resolved through injected `game-weapons-three` or `game-items-three`. Only the items that exist in neither are ported (shovel, slingshot, bible, clipboard, microphone…).
- `createCharactersTestModule`.
- Voices: parameter events only (S3); the synth waits for `game-audio` in Phase 6.

**`game-characters-undead`** (P2, P3, P4, P5, P6, P11).
- **Data:**
  - `types.json`: 13 types — `walker`, `runner`, `crawler`, `brute`, `sniffer`, `leaper`, `bloater`, `stalker`, `blind`, `screamer`, `charred`, `drowned`, `devourer` — with the v17 eye colours (Devourer `B0122A`). Each type also carries postures and gait profiles, scale/build, ability params, `spawnWeight`, `nightShare` and `requires`.
  - `ages.json`: `fresh`/`recent`/`old`/`decrepit`, plus perception.
  - `outfits.json`: item ids.
  - `infection.json`: the Elenco hours, the game's accelerated preset and `FERIDA`.
  - `moments.json`.
- **API:**
  - `createUndead(kit, o)`.
  - `undead.assign(spec, { type?, age? })`: the type is a creation-time trait; when absent it is a weighted draw.
  - `undead.turn(character, { now })` keeps the person's body. Children turn too (P6). By default the type pool for children excludes `brute` and `bloater` (question 2).
  - `undead.fromAgent(agent: { state, seed }, region)`: the bridge from `game-infection`'s `materialize`.
  - `speedFor(type, moment, ctx)`.
  - The death and damage hooks run here: bloater burst cloud (4 m), charred fire immunity and water −30%, brute head area −40%, brute door ×3 (data).
  - Movement abilities (leap, stalk, scream, sniff) ship as data. `game-crowd` runs them in Phase 8.
  - `undead/animals`: `createAnimalOutbreak({ species })`. Outcome `turns`/`dies`/`immune`; turn time from the species data (10–30 min, rat 2 min, jaguar 1 h); a carcass lures zombies within 200 m for 1 day and vultures arrive in 10 min. The game switches it on or off.
- **Speeds (P3).** Absolute m/s per type: `wander`, `chase`, `frenzy`, `sprint`. For blind, charred, drowned and devourer, `chase` = the Bancada value (1.6 / 1.6 / 1.2 / 2.4) and `frenzy` = the Bestiário chase speed (3.0 / 2.2 / 2.5 / 3.0). Runner: `chase` 5.5, `sprint` 6.0. Moment multipliers (defaults):

  | Moment | Default | Source |
  |---|---|---|
  | wander | ×1 | — |
  | alert | ×1.3 of wander | — |
  | scream boost | ×1.2 | game |
  | injured (limp) | ×0.5 | game |
  | crawl | cap 0.4 m/s | game |
  | water | drowned 3.0 m/s; others ×0.6 | game (drowned) |
  | night | ×1 | game has no speed change at night |

  Age and build multipliers follow `zSpawn`.

**Content packs.**
- `game-characters-people`: 12 professions as generic presets (`nurse`, `police_officer`, `firefighter`, `mechanic`, `builder`, `cook`, `sport_shooter`, `farmer`, `electrician`, `courier`, `teacher`, `unemployed`), age presets (child height 0.52–0.70 relative, build 0.68–0.76), appearance pools, about 80 generic accessories. Locales `en` and `pt-BR`.
- `game-characters-uniformed`: 7 generic forces (`army`, `military_police`, `civil_police`, `highway_police`, `prison_police`, `special_forces`, `tactical_unit`), each with `region:'br'` and real pt-BR names. Also ranks with `RANKRULE` (the highest rank takes command; opinion below −20 allows disobedience) and loadouts as item and weapon ids. `vivos` `LOOT` becomes `FindsProvider` pools.
- **Game slice:** 44 people, 18 groups, relations, events, `life`/`simulate`, 7º BIS, `ZONES`/`TER`, the points table, and Cícero and Sandra as Phase 8 roles.

**Animals.**
- `game-animals`: `AnimalBodySpec` (`quadruped|bird|snake`, `L`, `R`, `span`, profile, `leg{fu,fl,hu,hl}`, neck, head, ears, tail, `walkHz`/`runHz`/`gallop`), the `GAIT` phase tables, `AnimalVisualState = 'alive'|'infected'|'dead'`, and sound ranges as data.
- `game-animals-species`: the 13 species, each with an optional `outbreak` field the engine ignores.
- `game-animals-three`: literal port of `profileGeo`/`quad`/`bird`/`snake`/`anim*`/`setInfected`/`setJoint`/`setSplit`, decoupled so that `dead` applies to every species (the page only uses it for `morre` species), plus instancing through the `node-skin`.

**Configuration per game.** Registries with `packs`/`patch`/`remove` (`mergeById`/`applyPatches` from contracts). Also configurable as options: `penetration` model and calibration, `deathRule`, protection presets, moment multipliers, the infection preset, the corpse cap, detail distances and the child type pool. Nothing in the engines is hard-coded except physical constants.

## 3. Goldens and RNG replacement

**Mechanism.** Pure logic is cut from G or the team pages (`cut-literal`) and evaluated with `new Function(..., 'R', slice)`, passing `R = createSeededRandom(seed)` per character. The SDK draws in the same order from its own per-character stream, so the match is exact. Pure logic runs in Node `vm`; scenes run in the Chrome recorder. three r128 vs 0.160 is handled with `installPortableMath` and `KNOWN_DEVIATIONS`, on Node 22 and 24.

| Golden | Capture | Records | SDK side |
|---|---|---|---|
| G-spawn | vm: G 66746 `zSpawn` + `CATS`/`IDADES`/`ROUPAS`/`SEG`, 13 types × seeds 1–50 | h, b, sp, wsp, hp, age, outfit, helmet, crawl, variant | `undead` with the `team-game` speed preset |
| G-damage-regions | vm: G 67011–67045 with stubbed fx (stubs record), scripted sequences (helmet + 9×19, vest + 7.62, limb to limp, crawl, 12 ga at 3 m on the head, jaw) | per hit: hp, segH/A/L, miss, limp, crawl, kill, headshot | `detail:'regions'` |
| G-penetration | vm: G 68699–68724 against lines of 5 bodies (mixed types, brute) | per body: damage, stop index | `team-game` preset exact; `physical` against the 2/3/4 table |
| G-damage-segments | Chrome: `arsenal:855-1015` with seeded `Math.random`, hit list per segment × `ZW` + `grenadeAt` at 0.5–2 m | sever, explode, split, legLost, limp, kill, bleeder (rate, duration, spurt) | `detail:'segments'` |
| G-cut-hierarchy | Chrome: `elenco` `hit`/`sever`/`breakBone` (R rebuilt per character) | BELOW/FALLS cascades, pendulum params, limp, crawl, death | rule module |
| G-body | Chrome: G `BEST.build` 13 types × decay 0–3 × seeds 1–5 × LOD {1, 0.5, 0.28}; `bakeBody` for the ZVAR seeds | scene hash; bone, pivot and vcol hash | `rich/best-builder`, `bake` |
| G-people | Chrome: `retratos` `build` for the 44 PEOPLE (fixture only, not shipped) | scene hash | `person-builder` |
| G-instanced | G `buildBody(16/10/5)` with `TEAM_GAME` proportions; `bodyChunk` byte-equal source test | geometry hash | instanced path; a second test checks `GUIDE` proportions (P1 is an assumed deviation) |
| G-gait | Chrome: `bestiario` `animate0` 13 types at t = 0…2 s; `elenco` `MOVES` blends; vm: `walkGait(v 0–6, h)` | joint rotations; numbers | animator with `strideFromSpeed:false`; `gait/stride` |
| G-animals | Chrome: `bichos` 13 species built, `anim*` × walk/trot/gallop, `setInfected` on/off; G `bichoPele` attributes | scene hash, colours, visibility | animals-three, `node-skin` |
| Source tests | catalog tool | types = Bestiário `Z` values; eyes = v17; ages, outfits, FERIDA, INFEC, SPECIES fields | `--check` |

**RNG by source.**

| Source | RNG use | Golden |
|---|---|---|
| BEST v17 | seeded `VR`/`BR` | exact |
| Retratos | `rng` ×8, no `Math.random` | exact |
| Bichos | `rng` ×3 | exact |
| Game zone | global `R=rng(20261022)` (G 62034, about 312 draws), replaced per character by injection | exact |
| Elenco | global `R=rng(77)` + 30 `Math.random` | exact for damage (one draw per hit); splats are structural only |
| Arsenal | 130 `Math.random` (splats, gouge, particles) | events exact; gore geometry is a known deviation |
| Bestiário v0.1 | 81 `Math.random`, all in effects and scenes | not ported; its animation path has none, so the gait golden is exact |

## 4. Test areas

Both modules live in their `-three` package, following §4 like `createWeaponsTestModule`. The examples only load them: `examples/characters-test-area` (`CharactersArea.loadInto(room)`, `?area=characters`) and `examples/animals-test-area` (`?area=animals`).

**characters-test-area**
- **Area:** the 13 types in a line, 12 professions, uniformed forces, child and elder, a shooting lane with 5 bodies, a crowd field.
- **Bench controls:**
  - Who: kind (person / undead type / profession / force / child).
  - Body: seed, decay 0–3, age, sex, height, build.
  - Gear and detail: protection (none, vest IIA/IIIA/III, helmet, firefighter, leather jacket); detail (`segments`/`regions`); path (rich, instanced LOD 0/1/2).
  - Damage: penetration model (`physical`/`team-game`); death rule; hit preset (9×19, 00 at 3 m, 7.62×39, .308, 5.56, machete, axe, M67 at 1/3/6 m), and the room's tool also works.
  - Movement: moment (7) with a speed readout; pose (8 + MOVES); cascade on/off.
  - Actions: line up 5, heal, kill, infect (accelerated timeline → turn), spawn 100/1000.
- **Layers:** segment colours (`paintParts`), hit capsules, joints, bleed emitters, missing-mask, eyes only, speed vectors.
- **Metrics:** FPS, draw calls, triangles, instances, bake time, bodies crossed and energy per body for the last shot, the selected character's per-segment HP, vitality, bleed rate.
- **Scenarios (stable ids):** region × calibre, cut at every joint, broken bone dangles, leg → limp → crawl, head kill, grenade by radius, penetration line, age 0–3, vest and helmet, bite → fever → delirium → turn (child included), 1000-body benchmark against the 2,500/800/250 triangle budget.

**animals-test-area**
- **Controls:** species (13), visual state (alive/infected/dead), gait and speed.
- **Layers:** joints, split, sound-range ring, carcass lure radius.
- **Actions:** outbreak rule on/off, bite → turn timer (accelerated).
- **Benchmark:** 40 animals via node-skin.
- **Metrics:** draw calls, triangles, nodes per skin, turned/dead counts.

**interactables-test-area** (owner rule).
- `entry.js` also loads `createCharactersTestModule` and `createAnimalsTestModule`; `build.mjs` checks their bundles.
- New cross-phase scenario `zombie_behind_door`: the character is registered as a `DestructibleImpl` in the furniture's `DestructionWorld`. A 7.62 shot crosses the fridge door and then the zombie, and the event sequence is checked.
- When the Phase 2 house area is present, one walker stands in its kitchen, using `House.collide` as the environment.
- The site's `catalog.mjs` gets both areas, plus thumbnails.

## 5. Tasks (ordered; model; parallel group)

| # | Task | Model | Group |
|---|---|---|---|
| T4.0 | Contracts `body.ts`, `Hit.mass/cut/part`, `body` event, `ObjectState.body`; `Shot.mass` in game-weapons + `shotToHit`; `BodySlot` moved into contracts with a re-export from game-items, plus `protection.ballistic` | haiku | A |
| T4.1a | `tools/characters-catalog`: extractors (game, bestiario, BEST v17, elenco, retratos, vivos, arsenal-body), `decisions.json` (English ids, P1/P3/P7 presets, protection presets, scope), `--check`, `--game-out` | sonnet | A |
| T4.1b | `tools/animals-catalog` (SPECIES, SPEC, GAIT, ORDER, ranges, outbreak) | haiku | A |
| T4.1c | Golden captures: 4 vm harnesses + 6 Chrome captures; record fixtures | sonnet | A (does not need SDK code) |
| T4.1d | `game-characters` skeleton: BodySpec (GUIDE/TEAM_GAME), rig, segment tree, registries, `createCharacters` | sonnet | B |
| T4.1e 🧠 | Damage model: penetration (physical + team-game) with calibration tests, protection, segments ↔ regions, severity, death rules, bleeding, DestructibleImpl; G-damage-*, G-penetration | **opus** | B (after d) |
| T4.1f | Gait/pose math, cascade, MOVES, `walkGait`; ConditionTimeline; corpses; appearance; G-gait (vm part) | sonnet | B ‖ e |
| T4.1g | `-three` instanced path: GLSL verbatim, BodyBatch, bake, variants, flying limbs; G-instanced | sonnet | C (after d) |
| T4.1h | `-three` rich builder: literal BEST v17 + person builder + accessories + hands; G-body, G-people | haiku → sonnet after 2 failed gates | C |
| T4.1i | `-three` animator + wounds (stump, pendulum, exit wound, gouge, explode, split) + eyes + fluids bridge; G-gait (Chrome) | sonnet | C (after e) |
| T4.2a | Undead data via the catalog (types, ages, outfits, eyes, gaits, infection, moments) | haiku | D (after a, d) |
| T4.2b | Undead engine: assign/turn/fromAgent, speeds × moments, damage hooks, children, wound infection; G-spawn | sonnet | E (after e, 2a) |
| T4.2c | `game-characters-people` (data + en/pt-BR) | haiku | D |
| T4.2d | `game-characters-uniformed` (data haiku; rank rule and loot pools sonnet) | haiku + sonnet | D |
| T4.2e | Game slice `zombiada/content/characters/` + README | haiku | D |
| T4.3a | `game-animals` engine + `game-animals-species` | sonnet / haiku | C ‖ |
| T4.3b | `game-props3d` node-skin; `game-animals-three` literal port; G-animals | haiku (port) / sonnet (node-skin) | C (after 3a) |
| T4.3c | `undead/animals` outbreak rule | sonnet | E |
| T4.4a | Characters test module + example | sonnet | F (after C + E) |
| T4.4b | Animals test module + example | sonnet | F |
| T4.4c | interactables-test-area loading, the cross scenario, catalog, thumbnails | haiku | F |
| T4.4d | Inventory and spec update (R5), 9 SKILL.md, changesets, `evidence.md`, PR | haiku | last |

**Order.** A runs first and fully in parallel. Then B. C and D start after T4.1d. E needs T4.1e. F comes last. Prerequisite: Phase 3's `game-items` is merged before T4.0's items edit. If it isn't, T4.0 lands `BodySlot` in contracts and T3 adopts it.

**Wiring (lesson from PR #21).**
- `site/Dockerfile`: COPY the `package.json` of the 8 new packages, 2 examples and 2 tools.
- `site/build-site.mjs`: examples build after test-room.
- IIFE globals: `GameCharacters`, `GameCharactersThree`, `GameCharactersPeople`, `GameCharactersUniformed`, `GameCharactersUndead`, `GameAnimals`, `GameAnimalsSpecies`, `GameAnimalsThree`, `CharactersArea`, `AnimalsArea`.
- three as a peer dependency, plus `RoundedBoxGeometry` (G6); `@adatechnology/golden-tool` as a devDependency.
- Changesets: 8 new packages at 0.1.0; contracts, weapons, items and props3d minor.

## 6. Business questions (each default is reversible)

1. **Infection chance from a wound.** The Bestiário says scratch 20%; the game's `FERIDA` says scratch 6%, laceration 22%, bite 100%. *Default:* the game's three wound types. One line in `infection.json`.
2. **Which types a child can turn into.** *Default:* every type except brute and bloater. It's the `childTypePool` option.
3. **Uniformed forces in the SDK under their real Brazilian names** (PM, PRF, Polícia Penal) as generic `br` content, with 7º BIS and the named units in the game repo. *Default:* yes, as in G5/C8.
4. **Drowned spawn.** The game has weight 0; the Bestiário has 1%. *Default:* weight 1 with `requires:'water'`, so it spawns only near water.

Decided without asking, and listed in the PR: the night speed multiplier is ×1 (the game has none); a dead visual for all 13 species; fingers only at LOD0; points in the zombiada slice (A2); P1 and P3 are assumed deviations, each covered by its team preset in the goldens.

## References

- `S/artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`: rule data 61950–62021, `R` 62034, `J` 65336, `buildBody` 65367, `bodyChunk` 65400, `walkGait` 65508, `BodyBatch` 65509, `buildRetrato` 65546, `BEST` 65787, `bakeBody` 66019, `BICHOS` 66146, `bichoPele` 66536, `zSpawn` 66746, speed modifiers 66907/66918, `zDamage` 67011, `ZVAR` 67079, `zChaseSpeed` 67357, `shootRay` 68699.
- `S/sources/armas-itens__galeria-3d-arsenal.js:856-1004`, `zumbis-personagens__elenco.js:244,336,447-463,593`, `zumbis-personagens__bestiario.js:6,97-123,286-323`, `animais__bichos-do-vale.js:9,147-421`, `sobreviventes__retratos-do-vale.js:64-437`, `sobreviventes__os-vivos-do-vale.js:499-603`.
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/spec001-fase-3/packages/game-contracts/src/{destruction.ts:171,impact.ts:12,weapons.ts,module.ts:150,registry.ts}`, `packages/game-weapons/src/data/calibers.json` (energies used for P7), `packages/game-infection/src/types.ts:160,203`.
- `S/design/T3-itens.md` (FindsProvider, `protection.slots`) and `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/spec001-fase-2/specs/001-migracao-entregas-dos-times/design/T2.1-casas-estrutura-e-destruicao.md` (House `collide`, navigation, the interactables-test-area rule).
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/spec001-fase-3/tools/golden/` (seeded mulberry32 equal to the SDK's `createRng`, the `cut-literal` capture pattern).