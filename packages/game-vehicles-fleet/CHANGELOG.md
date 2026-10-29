# @adatechnology/game-vehicles-fleet

## 4.0.0

### Patch Changes

- Updated dependencies [d64e58a]
- Updated dependencies [bcceeaf]
  - @adatechnology/game-vehicles@0.4.0

## 3.0.0

### Minor Changes

- 3be5d21: Testes e ferramentas no three r160 (o pacote do three passa a pedir `>=0.160.0`); os goldens que o r160 muda foram regravados uma vez: torno dos pneus (ordem dos índices), cores misturadas no espaço linear, um tampo extrudado pelo earcut 2.2.4 e as cores do terreno urbano.

### Patch Changes

- Updated dependencies [d610199]
- Updated dependencies [3be5d21]
- Updated dependencies [c470a2c]
  - @adatechnology/game-vehicles@0.3.0

## 2.0.0

### Minor Changes

- 5718964: Medidas, tintas e cartões de projeto da frota (spec 001, T7.1b): `fleetDims`, `paintPalettes`, `paletteOf`, `colorFromSeed`, `fleetStats` e `fleetCard`, com os dados gerados por `tools/vehicles-catalog` (`DIMS`, `PALETA`, `PALETA_MIL` da Frota Leve e os 69 cartões da Frota). A cor por semente confere com o código do time para as sementes 0 a 499 e 40 textos.
- 1ea43bd: Modo leve e peças danificáveis (spec 001, T7.1a): `createVehicleKit({ lod })` e `kit.build(key, state, zonas, { lod: true })` desenham o mesmo veículo com menos triângulos (porte dos ganchos `[LOD]` da Frota Leve: caixa arredondada com um anel, lofts, grades e geradores do three mais grossos, interiores marcados com `skipLite`), todos os números configuráveis; desligado, nada muda e os 868 goldens da frota continuam idênticos. `kit.damageables(c, matriz?)` devolve as caixas de metal, vidro, borracha e combustível. O `game-vehicles-fleet` aplica os mesmos ganchos nas cópias locais de loft, para-lama e grade.

### Patch Changes

- Updated dependencies [1ea43bd]
- Updated dependencies [35c2caa]
  - @adatechnology/game-vehicles@0.2.0

## 1.0.0

### Minor Changes

- 82add98: Initial release (0.1.0): 69 procedural vehicles in ten groups, fuels, group names, generic crash texts and five damage scenarios for `@adatechnology/game-vehicles`, with English ids and an `en` / `pt-BR` locale table that reproduces the original strings.

### Patch Changes

- b82a6c0: `@adatechnology/game-vehicles` gains `createVehicleDestructible(kit, vehicleCtx, options)`, which makes any built vehicle follow the `DestructibleImpl` of `@adatechnology/game-contracts` (new dependency, types only): every damage zone is a part with a material (steel, aluminium, glass, plastic, rubber), joints (hinge, bolt, weld, glue, clip), new mechanical parts (battery, alternator, gearbox, brakes, steering, shock absorbers, oil pan, tyres, mirrors, pillars, optional tow hitch) with locale names (`mechanics.*`), hits mapped to dent, hole, crack, ricochet, detach, leak, ignite, melt and explode events, parts that really come off and fall, hidden mechanics that change `status()`, and open/close clips for doors, hood and trunk. `buildVehicleItem` builds a vehicle for a viewer that expects the front on +z. The fleet package adds contract tests on real vehicles.
- Updated dependencies [b82a6c0]
- Updated dependencies [7e4a80e]
  - @adatechnology/game-vehicles@0.1.0
