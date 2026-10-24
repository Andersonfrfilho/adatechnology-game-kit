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
O módulo `createVehiclesTestModule` (T7.1f) e `examples/vehicles-test-area` (`?area=vehicles`).

## Cuidados
- O modo leve deixa de fora os interiores, o motor e as peças com menos de 3 cm; a placa mantém a textura.
- Peer `three >=0.128.0`: testado em r128 e r160.
- Sem `Math.random`: a cor vem da semente.
