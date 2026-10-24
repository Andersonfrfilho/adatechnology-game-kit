---
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-vehicles': minor
---

Módulo de teste dos veículos (spec 001, T7.1f): `createVehiclesTestModule` e `loadVehiclesTestModule` no `game-vehicles-three` põem os oito veículos do teste da Frota na sala, cada um com a própria destruição e os clipes de porta, capô e porta-malas, com os onze cenários da página do time, literais, e dois para os motoristas (`vehicles_drive_arcade`, `vehicles_drive_semi`). A bancada troca a qualidade, a pintura por semente e paleta, a direção e o piso; camadas de caixas danificáveis, zonas e eixos. Efeitos pedidos por id a `host.effects`. `buildVehicleItem` do `game-vehicles` ganha a opção `lod`. `examples/vehicles-test-area` e o módulo também na `interactables-test-area` (cenário `car_in_the_yard`).
