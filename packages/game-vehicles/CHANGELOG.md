# @adatechnology/game-vehicles

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
