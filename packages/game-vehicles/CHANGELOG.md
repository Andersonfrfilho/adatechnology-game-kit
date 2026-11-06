# @adatechnology/game-vehicles

## 0.6.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.6.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.6.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.6.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.6.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.6.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.6.1

### Patch Changes

- fb6d690: Explosions and fire sound like what happened. `createDestructionSound` plays the family of each explosion from its effect (grenade, big charge, fuel vessel, car, pipe bomb, rocket, flashbang, molotov; `BLAST_KIND_OF`, changeable by option), the far rumble past 60 m and the indoor tail when the blast was confined; fire has its ignition "whoomp" (at most two at once when many parts catch together), a gas leak while a punctured vessel vents, a lower roar and crackles at the burning points (`update(dt)`). The renderer sends the explosion's effect, radius and confinement with `explode` (`SoundDetail`). game-audio adds the `kit` mix (the art scene chain plus a soft limiter with a −1 dBFS ceiling), now the default: a blast with its debris no longer clips the output. The room passes the thrown explosive's id to the renderer and ticks the fire crackles.
  A car's fuel tank names its explosion (`car_fuel_tank`), so it sounds and looks like a car going up.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-shapes-three@0.3.1

## 0.6.0

### Minor Changes

- 3dbca8c: A shot at a vehicle lands on the drawn surface (`DestructibleImpl.surfaceRay`), not on the part's box. Hole marks belong to the panel and swing with its door, cracks start where the round landed, every drawn pane is glass, and an open door carries its rubber, inner card and edges.
- cbb20a2: The kit's deferred work can share one frame budget. `engine.deferredQueue()` (voices), `renderer.deferredQueue()` (destruction events and slices), `houseRenderer.deferredQueue()` (breach paint) and `createCreaseQueue()` with `VehicleDestructibleOptions.creaseQueue` (vehicle crease, one queue for every vehicle, round robin) give a `DeferredQueue` that `@adatechnology/game-runtime` runs inside its budget. Nothing changes without a budget: the queues keep draining by themselves and `deferredStart`, `eventBudgetMs`, `breachPaintBudgetMs` and `pump()` keep their meaning and defaults. The test room runs on the scheduler, registers the voice and destruction queues, lends `host.defer` and `onFrame(fn, { phase, order })`, and gains `frameBudgetMs` and `frameStats()`.
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 65ccb0c: `VehicleKitOptions.effects` (spec 005, A9): a function returning the host's effects world. With one, smoke, fire and dust puffs are played through it (`particle_puff`, `particle_glow`) with the colour, opacity, life and size the local puff would have had, and the kit's own cap (400) does not apply to them. Without one the kit draws its own sprites as before, with a one-time warning (deprecated). Solid debris (sparks, shards, scrap) stays local. The vehicles test area passes `host.effects`.

### Patch Changes

- 6168372: The rays that seat the windshield and rear window on the shell, `kit.probe` and `kit.surfaceAt` go through the triangle index of each mesh (`raycastIndexed` in `tri-index`): a ray visits only the blocks and triangles whose box it crosses instead of every triangle of the body, with the same triangle test as three.js, so the hits are the same (a test compares them ray by ray). A vehicle builds in about half the time; the vehicles test area tests no longer run past vitest's 60 s report timeout.
- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-shapes-three@0.3.0

## 0.5.0

### Minor Changes

- 379e44f: A shut car keeps the smoke out. The contracts get `Enclosure` and `EffectSink.enclose`: a closed space (a turned box with openings and a leak) that the
  host's smoke, dust, steam and gas go round. `game-vfx` holds them out in all three particle systems (`VfxWorld.enclose`: the puffs of blasts and
  fires, the carried sprite kinds `smoke`, `dust`, `steam` and `ash`, and the Workshop's light sprites); they cross a wall only through an opening,
  a bullet hole at its small rate, or the leak of the gaps, and what starts inside stays inside. `game-vehicles` gives the cabin of a car as one
  (`cabinEnclosure`): shut, it only seeps; an open door or lid, a shattered window, a door, glass or roof torn off open it; a bullet hole lets a little
  in at the hole, more for a bigger round. `game-vehicles-three` keeps the host told (`createCabinSmoke`) and the vehicles area uses it.

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.4.7

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0

## 0.4.6

### Patch Changes

- 5a2f8e7: A car door that opens is the door itself: the first swing cuts the door's own skin out of the body and hangs it on the hinge, with its trim and side window, in place of the flat plate (the lid takes its skin too). The room moves a part's collision shape round the hinge its drawn group turns on, not round the shape's own centre, so a car door no longer stops against its own body. `sweepBox` with `ignore` also ignores the parts of an object hosted by an impl (a vehicle).
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.4.5

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

## 0.4.4

### Patch Changes

- 30133d3: A closed door or lid is the body's own surface: the flat hinged plate over it and the dark recess under it show only while it swings open or once it has come off, so closed vehicles no longer wear flat grey panels over their curved sides.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.4.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.4.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.4.1

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.4.0

### Minor Changes

- d64e58a: `kit.build(key, state, { scenario })` builds a vehicle with a registered damage scenario (id or name, e.g. the fleet's `burnt`) in one call: the scenario is computed on the vehicle being built, with no probe build, and an explicit `health` / `flags` given alongside override its result. An unknown scenario damages nothing, like `zoneScenario`. `buildVehicleItem(kit, key, { scenario })` passes it through. New type `BuildZoneState`.

### Patch Changes

- bcceeaf: Building a heavily damaged vehicle (the fleet's `burnt` scenario) is about four times faster, with the same result bit for bit: the decal rays of `zoneDecals` test only the triangles of the bodywork that they can reach (instead of every triangle of the shell per ray), `zoneDent` skips the vertices and triangles outside the zone box before transforming them, and `crease` (smooth normals) hashes numbers instead of strings and keeps the face normals in one typed array.

## 0.3.0

### Minor Changes

- d610199: A normal bullet that goes through a fuel tank, a jerrycan or a gas bottle now only leaks; it no longer blows the tank up by itself. The leak lights with a spark of a
  hard round on steel, an incendiary or tracer round, a fire near (a burning part or fuel stain) or a blast, and then the usual fire and explosion run.
  `game-contracts`: `IgnitionRules`, `DEFAULT_IGNITION_RULES`, `resolveIgnitionRules`, `ignitionChance`, `fillFactor`, `sparkTargetFactor` (the container side: a fill curve where a full
  tank mostly leaks and a nearly empty one lights easiest, what a spark needs to strike, the fire near). `game-weapons`: `rules.ignition` (chance of the core and the jacket of the round,
  built from the ammo table, plus the flame of incendiary and tracer) and `ammoIgnition`; the shot carries `ignition`. `game-destruction`: `DestructionOptions.ignition`, the roll in the
  ballistic hit of a container of `gas` or `fuel`, fire near and blast. `game-vehicles`: `VehicleDestructibleOptions.fuel` (starting level) and `ignition`; the `E > 1500` rule that
  heated the tank is gone. `game-vfx`: `vehicle_leak` is now the leak without the fire and the blast, and `vehicle_leak_ignited` is the whole Garagem sequence. `game-vehicles-three`:
  `defaultEffectIds.leakIgnited`, asked when the tank catches fire.
- 3be5d21: Testes e ferramentas no three r160 (o pacote do three passa a pedir `>=0.160.0`); os goldens que o r160 muda foram regravados uma vez: torno dos pneus (ordem dos índices), cores misturadas no espaço linear, um tampo extrudado pelo earcut 2.2.4 e as cores do terreno urbano.
- c470a2c: O three do kit é o `shapeGeometries(THREE)` do game-shapes-three (com o modo leve por cima): caixas, cilindros, esferas, toros, os tornos dos pneus e as extrusões retas saem do game-shapes, iguais bit a bit e com cache por parâmetros entre veículos. Nova dependência: `@adatechnology/game-shapes-three` (embutido no IIFE).

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [fcd0be6]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-shapes-three@0.1.1

## 0.2.0

### Minor Changes

- 1ea43bd: Modo leve e peças danificáveis (spec 001, T7.1a): `createVehicleKit({ lod })` e `kit.build(key, state, zonas, { lod: true })` desenham o mesmo veículo com menos triângulos (porte dos ganchos `[LOD]` da Frota Leve: caixa arredondada com um anel, lofts, grades e geradores do three mais grossos, interiores marcados com `skipLite`), todos os números configuráveis; desligado, nada muda e os 868 goldens da frota continuam idênticos. `kit.damageables(c, matriz?)` devolve as caixas de metal, vidro, borracha e combustível. O `game-vehicles-fleet` aplica os mesmos ganchos nas cópias locais de loft, para-lama e grade.
- 35c2caa: Módulo de teste dos veículos (spec 001, T7.1f): `createVehiclesTestModule` e `loadVehiclesTestModule` no `game-vehicles-three` põem os oito veículos do teste da Frota na sala, cada um com a própria destruição e os clipes de porta, capô e porta-malas, com os onze cenários da página do time, literais, e dois para os motoristas (`vehicles_drive_arcade`, `vehicles_drive_semi`). A bancada troca a qualidade, a pintura por semente e paleta, a direção e o piso; camadas de caixas danificáveis, zonas e eixos. Efeitos pedidos por id a `host.effects`. `buildVehicleItem` do `game-vehicles` ganha a opção `lod`. `examples/vehicles-test-area` e o módulo também na `interactables-test-area` (cenário `car_in_the_yard`).

## 0.1.12

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.1.11

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.1.10

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.1.9

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0

## 0.1.8

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0

## 0.1.7

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0

## 0.1.6

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0

## 0.1.5

### Patch Changes

- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-contracts@0.6.0

## 0.1.4

### Patch Changes

- Updated dependencies [d10c7f7]
- Updated dependencies [a569662]
- Updated dependencies [b3a5d99]
- Updated dependencies [9666008]
- Updated dependencies [9666008]
- Updated dependencies [f4da1a6]
- Updated dependencies [c0fcb62]
- Updated dependencies [85ac930]
  - @adatechnology/game-contracts@0.5.0

## 0.1.3

### Patch Changes

- Updated dependencies [71fb367]
  - @adatechnology/game-contracts@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [4babeca]
- Updated dependencies [5603151]
  - @adatechnology/game-contracts@0.2.0

## 0.1.0

### Minor Changes

- b82a6c0: `@adatechnology/game-vehicles` gains `createVehicleDestructible(kit, vehicleCtx, options)`, which makes any built vehicle follow the `DestructibleImpl` of `@adatechnology/game-contracts` (new dependency, types only): every damage zone is a part with a material (steel, aluminium, glass, plastic, rubber), joints (hinge, bolt, weld, glue, clip), new mechanical parts (battery, alternator, gearbox, brakes, steering, shock absorbers, oil pan, tyres, mirrors, pillars, optional tow hitch) with locale names (`mechanics.*`), hits mapped to dent, hole, crack, ricochet, detach, leak, ignite, melt and explode events, parts that really come off and fall, hidden mechanics that change `status()`, and open/close clips for doors, hood and trunk. `buildVehicleItem` builds a vehicle for a viewer that expects the front on +z. The fleet package adds contract tests on real vehicles.
- 7e4a80e: Add `@adatechnology/game-vehicles`: a generic procedural vehicle engine for three.js (cars, trucks, buses, bikes, tanks, boats, planes and helicopters) with zone-based damage in five bands, cracking glass, particles, fluids, rollover, explosions and a damage-map UI. `createVehicleKit({ THREE, locale })` returns a per-instance kit; fleets, fuels, scenarios and texts come from plugins. Strings live in `locales/en.json` and `locales/pt-BR.json`. See MIGRATION.md for the old-to-new name table.
