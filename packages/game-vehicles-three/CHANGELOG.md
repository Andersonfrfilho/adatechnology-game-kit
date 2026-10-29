# @adatechnology/game-vehicles-three

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
