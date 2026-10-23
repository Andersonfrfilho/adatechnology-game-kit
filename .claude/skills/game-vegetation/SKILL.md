---
name: game-vegetation
description: Use quando precisar de árvore, planta, palmeira, cacto, flor, grama, arbusto, samambaia ou jardim procedural low-poly em three.js, determinístico por semente, com LOD, fusão de terreno, distribuição (scatter), vento e destruição por peça.
---

# @adatechnology/game-vegetation

## Objetivo
Vegetação procedural low-poly e determinística: 15 arquétipos (árvore folhosa e morta, conífera, palmeira, bananeira, arbusto, planta de flor, grama,
samambaia, roseta, três cactos, trepadeira, planta de vaso). Sombreamento facetado com cor por vértice, sem textura, sem asset, sem `Math.random`
(mesma semente, mesma planta). Zero dependências; `three` é peer opcional usado só pelo adaptador (`/three`), e o host passa o `THREE`.

## Quando usar e quando não usar
- Use para plantas isoladas (`generate`), terreno inteiro em até 3 malhas (`buildLot`) e posicionamento em polígono (`scatter`).
- As espécies prontas (~71, com nomes e mixes regionais) estão em `game-vegetation-species`; aqui só vai o motor e os arquétipos.
- Não ponha nome de espécie de um jogo nem bioma do jogo no motor.
- Não serve para floresta com milhares de plantas sem orçamento: use `quality: 'game'` e `triangleBudget`.

## Como usar
```ts
import { generate, scatter, buildLot, validateSpec } from '@adatechnology/game-vegetation'
import { createVegetationMaterials, createPlantObject, createLotObject } from '@adatechnology/game-vegetation/three'
import { toSpec } from '@adatechnology/game-vegetation-species'
import * as THREE from 'three'

const mats = createVegetationMaterials(THREE)

// uma planta; a cor em spec é inteiro 0xRRGGBB
const spec = { archetype: 'columnar_cactus', height: 4.6, ribs: 6, armStyle: 'candelabra', arms: [4, 6], color: 0x5a9a88, spineColor: 0xcdbf94 }
validateSpec(spec) // [] quando válido
scene.add(createPlantObject(THREE, generate(spec, { seed: 3, lod: 1 }), mats))

// um quintal: distribuir e fundir
const placements = scatter(
  { polygon: [[0, 0], [10, 0], [10, 8], [0, 8]] },        // ou { rect: { x, z, w, d } }
  [{ species: ['mandacaru', 'saguaro'], density: 0.1, minDistance: 1.5 }],
  { seed: 'yard' },
)
const lot = buildLot(placements, (id) => toSpec(id), { seed: 'yard', quality: 'game' })
scene.add(createLotObject(THREE, lot, mats))

// por quadro, sem alocar
mats.update(time); mats.setActors([{ x, y, z, radius }]) // até 4 atores dobram a planta
```
O arquivo roda no Node com o `dist` gerado (conferido: `generate`, `scatter`, `buildLot` e `validateSpec` respondem como acima).

## API principal
| Função/tipo | Para que serve |
|---|---|
| `generate(spec, { seed, lod?, condition?, season?, scale?, species? })` | `PlantMesh` (partes wood, foliage, flowers, fruit, spines; bounds; collider; `pieces`) |
| `archetypes()`, `validateSpec(spec)` | Lista de arquétipos; erros de um spec |
| `scatter(area, rules, { seed, exclude? })` | Posiciona plantas (`prefer`: `edge`, `center`, `any`); devolve `Placement[]` |
| `buildLot(placements, resolveSpec, options)` | Funde o lote em wood/foliage/flowers + colisores; `pieceTable`, `triangleCount` |
| `extractPlant(lot, i)`, `hideLotPlant(lot, i)` | Tirar uma planta do lote sem three |
| `createRng`, `hashString`, `pointInPolygon`, `polygonArea`, `regionPolygon`, `distanceToBoundary` | Utilitários |
| `DEFAULT_MATERIAL_IDS`, `resolveMaterialIds`, `materialKeyForPart` | Ids de material da destruição |
| `/three`: `createVegetationMaterials`, `createPlantObject`, `createLotObject`, `createInstancedPlants`, `lodObject`, `separatePlantFromLot`, `slicePiece`, `toBufferGeometry` | Adaptador three, vento e dobra por ator no vertex shader |

Opções: `condition` `healthy | dry | dead | overgrown`; `season` `spring | summer | autumn | winter` (padrão `spring`: ipê aparece florido, use `summer` para verde);
`lod` 0, 1 ou 2.

## Compõe com
- `@adatechnology/game-vegetation-species`: catálogo (`toSpec`) e mixes regionais (`pickForContext`) que alimentam `scatter` e `buildLot`.
- `game-destruction`: cada malha leva um id de material (`green_wood`, `foliage`, `flesh_fruit`, `ceramic`, `soil`, `cactus`; strings, sem dependência do pacote).
  Com `{ separable: true }`, `createPlantObject` gera uma malha por peça para quebrar tronco, galho, copa e fruto.
- `game-floorplan-*` usa a vegetação para o quintal; o jogo só junta.

## Ambiente de teste
Não há `examples/vegetation-test-area` ainda (V5). Conferência visual: `pnpm build && node scripts/render-contact-sheet.mjs out.png`
(não publicado; precisa de Chromium via Playwright). Testes: `pnpm --filter @adatechnology/game-vegetation test`.

## Cuidados
- Cor no spec é inteiro (`0x5a9a88`); no JSON de espécies é string `#rrggbb` e só `toSpec` converte.
- `scatter` recebe `Region` como `{ polygon }` ou `{ rect: { x, z, w, d } }` (x, z é o canto mínimo).
- `buildLot` em `game` limita em `triangleBudget` (padrão 20000) baixando as menores a LOD2 primeiro; plantas pequenas já usam LOD2.
- Cactos carregam `damage: 'thorns'` nos colisores; todo mesh tem `userData.damageable` e `userData.destructionMaterial`.
- Ao acertar planta fundida: `separatePlantFromLot` zera as faixas de índice (triângulos degenerados) e devolve a versão separável já posicionada.
- Planta `dry`/`dead` usa `wood_soft` em vez de `green_wood`.
- O artefato "jogo versão atual" quebra por não carregar `GameVegetation`; a versão do site é a completa.

## O que vem pela migração (spec 001)
- T7.2 / V8: juntar o Viveiro (as duas versões, artefato e site, mantendo o que cada uma tem a mais), `rulesFor` e o `vegetation-test-area`.
- V5: módulo de teste de vegetação (18 itens, 13 cenários) em `examples/vegetation-test-area`.
- Conferir `userData.destructionMaterial` com a regra de concreto/tijolo e o quintal das casas quando `game-floorplan-structure` chegar.
