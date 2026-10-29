# @adatechnology/game-vehicles-three

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
