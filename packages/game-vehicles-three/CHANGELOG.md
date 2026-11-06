# @adatechnology/game-vehicles-three

## 0.8.2

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-vehicles@0.6.6
  - @adatechnology/game-audio@0.9.2
  - @adatechnology/game-vehicles-driving@0.2.15
  - @adatechnology/game-vehicles-proving@0.1.6

## 0.8.1

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-vehicles@0.6.5
  - @adatechnology/game-audio@0.9.1
  - @adatechnology/game-vehicles-driving@0.2.14
  - @adatechnology/game-vehicles-proving@0.1.5

## 0.8.0

### Minor Changes

- 73d8a0a: Freio chiando (`brake_squeal`, nos últimos metros de uma parada sem derrapar), atropelamento (`hit(speed, posição, som?)`, `vehicle_hit_pedestrian`,
  com o id do jogo para outro corpo) e limite de motores audíveis (`createEngineBudget({ max, listener })`, passado em `createVehicleSound({ budget })`:
  só os veículos mais perto do ouvinte mantêm os laços). Sirene (`frame.siren`: `wail` ou `yelp`, varrendo 650–1500 Hz) e rotor de helicóptero (`frame.rotor`). A pista da sala passa o freio.

### Patch Changes

- c8b0e40: `AudioSink.preload(ids)`: o módulo pede para decodificar as gravações já ao carregar, e o primeiro uso toca o arquivo, não o sintetizado. A área de veículos
  pré-carrega `VEHICLE_PRELOAD_SOUNDS` (motor, partida, desligar, portas e porta-malas): a primeira porta de carro aberta na 4280 tocava a receita.

  `SampleAlias.only`: o recorte vale só para as tomadas cujo arquivo contém esse trecho. A partida e o desligar do carro foram medidos na tomada `_01` de
  `engine_start_run_stop`, mas o jogo também sorteava a `_02` (21,9 s, que começa com o motor já ligado), e em metade das vezes o desligar tocava
  marcha lenta. Agora os dois usam só a `_01`.

  `loadSamples(ids)` lembra os ids que ainda não têm arquivo (o manifest ainda carregando) e carrega assim que um banco os resolve: o pré-carregamento
  da área de veículos acontece antes de o manifest chegar, e a primeira partida ainda tocava a receita.

- Updated dependencies [9a44330]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-audio@0.9.0
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-vehicles@0.6.4
  - @adatechnology/game-vehicles-driving@0.2.13
  - @adatechnology/game-vehicles-proving@0.1.4

## 0.7.0

### Minor Changes

- 33c09f1: Sons de carro gravados por referência. `game-audio`: `SampleRef.offset`/`duration` (um trecho do arquivo, com fade no corte), `SampleSound.baseFrequency`
  (o laço gravado segue `set({ frequency })` pela taxa de reprodução), laço gravado com posição (queda e lado pelo ouvinte) e `SoundBank.sampleAliases`
  (um id do pacote toca as tomadas de um id do manifest, resolvido na consulta). `game-vehicles-three`: `VEHICLE_SAMPLE_ALIASES` liga o motor do carro
  (marcha lenta a 1 000 rpm, alta a 2 520 rpm) a `rpm / rpm gravado`, a partida e o desligar recortados de `engine_start_run_stop`, a porta e o
  porta-malas aos arquivos do jogo; sem os arquivos, tudo continua sintetizado.

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [63adb4c]
- Updated dependencies [78e76b0]
- Updated dependencies [33c09f1]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-audio@0.8.0
  - @adatechnology/game-vehicles@0.6.3
  - @adatechnology/game-vehicles-driving@0.2.12
  - @adatechnology/game-vehicles-proving@0.1.3

## 0.6.4

### Patch Changes

- Updated dependencies [2aae2ac]
  - @adatechnology/game-audio@0.7.0

## 0.6.3

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.6.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-audio@0.6.1
  - @adatechnology/game-vehicles@0.6.2
  - @adatechnology/game-vehicles-driving@0.2.11
  - @adatechnology/game-vehicles-proving@0.1.2

## 0.6.1

### Patch Changes

- Updated dependencies [6b44b4e]
  - @adatechnology/game-audio@0.6.0

## 0.6.0

### Minor Changes

- 4145cc9: Vehicle sounds that follow what the vehicle does. `game-audio`: a loop can carry a `falloff` and `pan`, and `set` takes a `position` (level and side from the listener, duller far away) and a `cutoff` (the first filter); the sink passes `params.cutoff` and the position through. `game-vehicles-three`: `VEHICLE_SOUND_BANK` and `createVehicleSound` — the engine as loops crossfaded by RPM at the firing frequency (car, truck, bike profiles), louder and brighter under load, an RPM guessed through gears for drivers without an engine model, the starter (catching with a flare, or failing), ignition off, tyres squealing on asphalt or hissing on dirt by slip, road noise by speed, crashes light / medium / heavy by speed, and car doors, trunk and hood. The vehicles area turns the key before the lane car pulls away. `game-test-room`: a leaf of an object tagged `vehicle` plays `vehicle_<door|trunk|hood>_<open|shut>`; `game-destruction-three` maps those to the car sounds, falling back to the old latch and metal shut when the vehicle bank is not loaded (`SoundKeyRule.fallback`).

### Patch Changes

- Updated dependencies [4dce01e]
- Updated dependencies [fb6d690]
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [784a6b0]
- Updated dependencies [5d614c6]
- Updated dependencies [29782fc]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
- Updated dependencies [4145cc9]
  - @adatechnology/game-audio@0.5.0
  - @adatechnology/game-vehicles@0.6.1
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-shapes-three@0.3.1
  - @adatechnology/game-vehicles-driving@0.2.10
  - @adatechnology/game-vehicles-proving@0.1.1

## 0.5.0

### Minor Changes

- ce94d04: New optional options that take content by option (spec 005, D1 and D7). Every call written before keeps working: the default is the content pack the adapter always used, it is deprecated, and it will be removed in the next major.

  - `game-characters-three`: `toRoomAvatar(avatar, { strikeClips, firstPersonClips })`; the defaults are `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`. Recommended: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`.
  - `game-floorplan-three`: `furnitureSpec(THREE, type, { catalog })`; the default is `residentialItems`. Recommended: `defaultFurnitureCatalog()`.
  - `game-vehicles-three`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` (`VehicleFleetContent`, `VehiclesTestFleet`); the default is the fleet of `game-vehicles-fleet`. Recommended: `defaultVehicleFleet()`.
  - `game-vegetation-three`: `createVegetationTestModule({ GameVegetationSpecies })` keeps its default `game-vegetation-species`; recommended `defaultVegetationSpecies()`.

  `game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.

- cbb20a2: The kit's deferred work can share one frame budget. `engine.deferredQueue()` (voices), `renderer.deferredQueue()` (destruction events and slices), `houseRenderer.deferredQueue()` (breach paint) and `createCreaseQueue()` with `VehicleDestructibleOptions.creaseQueue` (vehicle crease, one queue for every vehicle, round robin) give a `DeferredQueue` that `@adatechnology/game-runtime` runs inside its budget. Nothing changes without a budget: the queues keep draining by themselves and `deferredStart`, `eventBudgetMs`, `breachPaintBudgetMs` and `pump()` keep their meaning and defaults. The test room runs on the scheduler, registers the voice and destruction queues, lends `host.defer` and `onFrame(fn, { phase, order })`, and gains `frameBudgetMs` and `frameStats()`.
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.
- 65ccb0c: `VehicleKitOptions.effects` (spec 005, A9): a function returning the host's effects world. With one, smoke, fire and dust puffs are played through it (`particle_puff`, `particle_glow`) with the colour, opacity, life and size the local puff would have had, and the kit's own cap (400) does not apply to them. Without one the kit draws its own sprites as before, with a one-time warning (deprecated). Solid debris (sparks, shards, scrap) stays local. The vehicles test area passes `host.effects`.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [cbb20a2]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
- Updated dependencies [65ccb0c]
- Updated dependencies [6168372]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-audio@0.4.0
  - @adatechnology/game-vehicles@0.6.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-vehicles-driving@0.2.9
  - @adatechnology/game-vehicles-fleet@6.0.0

## 0.4.0

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
  - @adatechnology/game-vehicles@0.5.0
  - @adatechnology/game-audio@0.3.6
  - @adatechnology/game-vehicles-driving@0.2.8
  - @adatechnology/game-vehicles-fleet@5.0.0

## 0.3.7

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0
  - @adatechnology/game-vehicles@0.4.7

## 0.3.6

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [5a2f8e7]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-vehicles@0.4.6
  - @adatechnology/game-audio@0.3.5
  - @adatechnology/game-vehicles-driving@0.2.7

## 0.3.5

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-audio@0.3.4
  - @adatechnology/game-vehicles@0.4.5
  - @adatechnology/game-vehicles-driving@0.2.6
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.3.4

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [30133d3]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-vehicles@0.4.4
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-audio@0.3.3
  - @adatechnology/game-vehicles-fleet@4.0.0
  - @adatechnology/game-vehicles-driving@0.2.5

## 0.3.3

### Patch Changes

- 50d8074: `footprintBlocker` (game-contracts): the `ModuleHost.addBlocker` function of a solid object on the floor, a rectangle in the object's own space that turns and moves with it. The weather visual's lamp rig car now blocks the walking player with it (it stands in every area of the test room, and the player walked through it), and the vehicles test area uses it for its vehicles and the lane car.
- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-audio@0.3.2
  - @adatechnology/game-vehicles@0.4.3
  - @adatechnology/game-vehicles-driving@0.2.4
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.3.2

### Patch Changes

- 2e89152: The vehicles test area keeps the walking player out of every vehicle on the floor (and the car on the lane): each vehicle blocks by its own footprint, turned with it, and the parts above head height (a helicopter rotor) are walked under.
- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-audio@0.3.1
  - @adatechnology/game-vehicles@0.4.2
  - @adatechnology/game-vehicles-driving@0.2.3
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.3.1

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vehicles@0.4.1
  - @adatechnology/game-vehicles-driving@0.2.2
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.3.0

### Minor Changes

- d64e58a: The vehicles area of the test room has the burnt wrecks `sedan_burnt` (Burnt sedan / Sedã queimado) and `hatch_burnt` (Burnt hatch / Hatch queimado), built with the fleet's `burnt` scenario through `kit.build(key, state, { scenario })`. The list is the `wrecks` option of `VehiclesTestOptions` (`{ key, vehicle, scenario }`, default `DEFAULT_TEST_WRECKS`, `[]` lays none), and the new scenario `vehicles_burnt_wreck` checks the burnt flag and the glass at 0.

### Patch Changes

- Updated dependencies [d64e58a]
- Updated dependencies [bcceeaf]
  - @adatechnology/game-vehicles@0.4.0
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.2.0

### Minor Changes

- d610199: A normal bullet that goes through a fuel tank, a jerrycan or a gas bottle now only leaks; it no longer blows the tank up by itself. The leak lights with a spark of a
  hard round on steel, an incendiary or tracer round, a fire near (a burning part or fuel stain) or a blast, and then the usual fire and explosion run.
  `game-contracts`: `IgnitionRules`, `DEFAULT_IGNITION_RULES`, `resolveIgnitionRules`, `ignitionChance`, `fillFactor`, `sparkTargetFactor` (the container side: a fill curve where a full
  tank mostly leaks and a nearly empty one lights easiest, what a spark needs to strike, the fire near). `game-weapons`: `rules.ignition` (chance of the core and the jacket of the round,
  built from the ammo table, plus the flame of incendiary and tracer) and `ammoIgnition`; the shot carries `ignition`. `game-destruction`: `DestructionOptions.ignition`, the roll in the
  ballistic hit of a container of `gas` or `fuel`, fire near and blast. `game-vehicles`: `VehicleDestructibleOptions.fuel` (starting level) and `ignition`; the `E > 1500` rule that
  heated the tank is gone. `game-vfx`: `vehicle_leak` is now the leak without the fire and the blast, and `vehicle_leak_ignited` is the whole Garagem sequence. `game-vehicles-three`:
  `defaultEffectIds.leakIgnited`, asked when the tank catches fire.
- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.
- 3be5d21: Testes e ferramentas no three r160 (o pacote do three passa a pedir `>=0.160.0`); os goldens que o r160 muda foram regravados uma vez: torno dos pneus (ordem dos índices), cores misturadas no espaço linear, um tampo extrudado pelo earcut 2.2.4 e as cores do terreno urbano.

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
- Updated dependencies [3be5d21]
- Updated dependencies [c470a2c]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-vehicles@0.3.0
  - @adatechnology/game-vehicles-fleet@3.0.0
  - @adatechnology/game-audio@0.2.1
  - @adatechnology/game-vehicles-driving@0.2.1

## 0.1.0

### Minor Changes

- 35c2caa: Módulo de teste dos veículos (spec 001, T7.1f): `createVehiclesTestModule` e `loadVehiclesTestModule` no `game-vehicles-three` põem os oito veículos do teste da Frota na sala, cada um com a própria destruição e os clipes de porta, capô e porta-malas, com os onze cenários da página do time, literais, e dois para os motoristas (`vehicles_drive_arcade`, `vehicles_drive_semi`). A bancada troca a qualidade, a pintura por semente e paleta, a direção e o piso; camadas de caixas danificáveis, zonas e eixos. Efeitos pedidos por id a `host.effects`. `buildVehicleItem` do `game-vehicles` ganha a opção `lod`. `examples/vehicles-test-area` e o módulo também na `interactables-test-area` (cenário `car_in_the_yard`).
- 537b5b0: Novo `@adatechnology/game-vehicles-three` 0.1.0 (spec 001, T7.1c): `createVehiclesThree(THREE, { kit }).build(chave, { quality, seed, color })` entrega o veículo no quadro do jogo (frente em +z, centrado, rodas em y = 0) em alta qualidade ou fundido em seis malhas (porte literal da Frota Leve), com a cor pela semente, as caixas danificáveis e as medidas. Confere com a página do time (triângulos, chamadas, vértices por classe, caixas) e com o `DIMS` dos 69 veículos.
- 0aafb73: game-vfx: `GAME_EFFECTS` ganha `vehicle_fire`, `vehicle_exhaust` e `vehicle_leak`, as receitas `engine_smoke` e `fuel_leak` da Garagem escritas em torno de um carro (âncora no carro da Oficina) para tocar no ponto do veículo. game-vehicles-three: o módulo pede a `host.effects` ids que existem (`car_fuel_tank`, `glass_burst`, `impact_metal` e as três acima), no formato do `EffectSink`.
- 8d50353: O módulo de veículos usa `host.audio`: registra o banco da biblioteca do `game-audio`, toca o motor da pista (`engine_saw`, volume 0,035 + velocidade x 0,003 e frequência 38 + velocidade x 7, valores do jogo) e a buzina (`horn`, ação "Buzinar" da bancada), e o som de batida (`sfx_impact`) quando o carro da pista bate. Vidro, impacto e explosão já saem do som de destruição da sala.

### Patch Changes

- Updated dependencies [4ed1cc7]
- Updated dependencies [5304161]
- Updated dependencies [5718964]
- Updated dependencies [1ea43bd]
- Updated dependencies [35c2caa]
  - @adatechnology/game-vehicles-driving@0.2.0
  - @adatechnology/game-vehicles-fleet@2.0.0
  - @adatechnology/game-vehicles@0.2.0
