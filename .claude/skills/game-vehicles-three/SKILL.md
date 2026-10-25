---
name: game-vehicles-three
description: Use quando precisar de um veículo pronto para colocar na cena do jogo com three.js, no modo leve de seis malhas ou em alta qualidade, com cor por semente, medidas reais e caixas de dano para tiro. Também veículos para uma cidade ou rua cheia de carros.
---

# @adatechnology/game-vehicles-three

## Objetivo
Entrega um veículo do `game-vehicles` (e da frota do `game-vehicles-fleet`) no quadro do jogo: frente em +z, direita em -x, centrado em x e z, rodas em y = 0. Porte literal da Frota Leve do time.

## Quando usar e quando não usar
- Use para: pôr carros, motos, barcos e aeronaves numa cena; muitos veículos de uma vez (modo `lite`, cerca de 20 mil triângulos e 6 chamadas por carro); saber onde um tiro acerta metal, vidro, borracha ou tanque.
- Não use para: dirigir (`game-vehicles-driving`) nem para dano por zona de um veículo detalhado (use o `kit` e o `context` que o modo `high` devolve).

## Como usar
```ts
const vehicles = createVehiclesThree(THREE, { kit })      // kit = createVehicleKit + installFleet
const carro = vehicles.build('midsize_sedan', { quality: 'lite', seed: 42 })
cena.add(carro.group); carro.damageables                  // [{ material, zone, part, side, box }]
```

## API principal
| Export | Para que serve |
|---|---|
| `createVehiclesThree(THREE, { kit, groupOf? })` | cria a fábrica; `build(chave, { quality, seed, color, state })` |
| `BuiltVehicle` | `group`, `damageables`, `triangles`, `drawCalls`, `length/width/height`, `pruned`, `context`, `dispose()` |
| `fuse`, `classify`, `liteMaterials` | o miolo do modo leve, caso um jogo queira outro agrupamento |

## Compõe com
`game-vehicles` (`kit.build(..., { lod: true })`, `kit.damageables`), `game-vehicles-fleet` (`colorFromSeed`, `fleetDims`), `game-urban-three` (carros da rua pelo provedor de veículos).

## Ambiente de teste
`createVehiclesTestModule({ locale, document?, three?, vehicles?, effects? })` (e `loadVehiclesTestModule(room, options)`, que aprende o three.js da sala sozinho para trazer os clipes de porta, capô e porta-malas) entra na sala com `room.loadModule` (`examples/vehicles-test-area`, global `VehiclesArea`). Itens: os oito da Frota (`hatch`, `sedan`, `pickup`, `sport_bike`, `box_truck`, `city_bus`, `battle_tank`, `attack_helicopter`), cada um com a própria destruição. Treze cenários: os onze da página do time, literais (`vehicles_9mm_windshield` ... `vehicles_melt`, com os ids da página em `PAGE_SCENARIO_ALIASES`), mais `vehicles_drive_arcade` e `vehicles_drive_semi`. Bancada: qualidade (alta ou leve, vale para os veículos postos depois), pintura pela semente e paleta, direção arcade ou semi, piso, ações repintar e percorrer a pista. Camadas: caixas danificáveis por material, zonas por tipo, eixos do quadro de saída. O módulo não desenha partículas: fogo, explosão, vidro, faíscas, vazamento e escapamento são pedidos por id a `host.effects` (`defaultEffectIds`), quando a sala tem. Tanque furado pede `leak` (`vehicle_leak`, só a poça e o pingar); quando o vazamento pega fogo (faísca, munição incendiária, fogo perto, explosão) o evento `ignite` do tanque pede `leakIgnited` (`vehicle_leak_ignited`, a sequência inteira da Garagem: fogo pela poça e a explosão). `tests/team-golden-module.test.ts` roda o `MODULO_VEICULOS` da página contra a sala do kit e confere os 11 cenários (checks e linhas do log).

## Cuidados
- O modo leve deixa de fora os interiores, o motor e as peças com menos de 3 cm; a placa mantém a textura.
- Peer `three >=0.160.0`: testado em r160 (desde o T9g).
- Sem `Math.random`: a cor vem da semente.
