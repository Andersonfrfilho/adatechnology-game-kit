---
name: game-vegetation-three
description: Use quando precisar das plantas do Viveiro como itens destrutíveis na sala de testes (árvores que se cortam com machado e serra, cactos, vasos, cerca viva, grama), do canteiro de 12 x 20 m plantado pela tabela regional, ou das 13 provas de destruição de vegetação.
---

# @adatechnology/game-vegetation-three

## Objetivo
Põe a vegetação do `game-vegetation` e do `game-vegetation-species` na sala de testes (`TestableModule` do `game-contracts`): as 18 plantas do módulo do Viveiro como itens do mundo de destruição padrão, o canteiro com a casa e o caminhante que dobra as plantas, e as 13 provas `veg_*`. Porte literal do `vegetation-module.js` do time.

## Quando usar e quando não usar
- Use para: testar o que um machado, uma serra, um machete, um tiro de 9 mm ou o fogo fazem numa árvore, num cacto ou num vaso; ver o canteiro plantado por semente; medir triângulos e peças da vegetação.
- Não use para: gerar plantas (isso é o `game-vegetation`), sortear espécies por contexto (`scatterRulesFor` do `game-vegetation-species`) nem para a vegetação do jogo em si: o jogo usa os dois pacotes direto.

## Como usar
```ts
import { loadVegetationTestModule } from '@adatechnology/game-vegetation-three'
loadVegetationTestModule(room, { locale: 'pt-BR' })   // ou room.loadModule(createVegetationTestModule(options))
room.openArea('vegetation')                            // ?area=vegetation na sala
```

## API principal
| Export | Para que serve |
|---|---|
| `createVegetationTestModule({ locale?, GameVegetation?, GameVegetationSpecies?, materials?, seed?, nurseryOrigin? })` | o módulo; sem opções usa os dois pacotes do kit. Devolve também `placed`, `materials(THREE)`, `tick(t)`, `itemIds` |
| `loadVegetationTestModule(room, options)` | carrega o módulo numa sala |
| `PLANT_DEFS`, `createPlants(sdk, species, materials)` | as 18 definições e a fábrica (`buildObject`, `buildSpec`, `swayClip`, `items`) para quem quiser as plantas sem a sala |
| `scatterLot`, `createNursery`, `PLANTINGS`, `AREAS`, `WAY` | o canteiro: sorteio, cena e caminhante |
| `VEGETATION_ITEM_IDS`, `VEGETATION_SCENARIO_IDS` | ids dos 18 itens e das 13 provas |

## Itens e provas
Itens: `mango_tree`, `mango_young_15`, `mango_young_30`, `yellow_ipe`, `coconut_palm`, `banana_with_bunch`, `araucaria`, `dead_tree`, `hibiscus_shrub`, `boxwood_hedge`, `rose_bush_red`, `sunflower`, `mandacaru`, `prickly_pear`, `crown_cactus`, `potted_fern`, `potted_cactus`, `lawn_tuft`. Cada peça (tronco, galho, copa, fruto, braço, raquete, espinhos, vaso, terra) é uma malha de nome `sanitize(id da peça)` (`s{n}_` nas seções da cerca viva), com forma pela espessura real da madeira (`radius`, `length`, `axis` do SDK), juntas (`stem`, `tie`, `resting`), âncora na peça-raiz e o clipe `sway`. Provas: `veg_axe_fells_crown` (tronco de 15 cm em 8 a 15 golpes), `veg_axe_fells_30cm`, `veg_axe_cuts_branch_joint`, `veg_shot_cannot_fell`, `veg_saw_cuts_branch`, `veg_lighter_ignites_foliage`, `veg_shot_strips_leaves`, `veg_shot_breaks_pot`, `veg_machete_arm`, `veg_pad_pulled`, `veg_dead_burns_faster`, `veg_hedge_cut_pieces`, `veg_walk_on_grass`.

## Bancada
Controles: semente, qualidade (alta ou jogo), detalhe (LOD 0 a 2), condição, estação do canteiro; vento e rajadas; ações plantar o canteiro, tirar o canteiro, ligar o caminhante (mudar um controle replanta o canteiro que está de pé). Camadas: `colliders`, `piece_boxes`, `wood_axes`. Métricas: plantas, peças, triângulos, chamadas de desenho e os números do canteiro (triângulos, plantas, colisores, plantas por LOD, tempo de montagem).

## Compõe com
`game-vegetation` (gera, `buildLot`, `createLotObject`, materiais com vento), `game-vegetation-species` (espécies, nomes, `scatterRulesFor`), `game-test-room` (o `loadModule`), `game-urban-three` (a vegetação das casas e da rua).

## Cuidados
- O módulo não desenha partículas e não pede efeitos: os eventos das plantas (folhas, seiva, fogo) nascem no mundo de destruição padrão, que a sala mostra; um host com `game-vfx-three` liga os efeitos a esses eventos, não a este módulo.
- A sala dá tempo de saque a toda ferramenta; as provas esperam a ferramenta ficar pronta (`room.waitUntilReady`), o que a página do time não precisava.
- Peer `three >=0.128.0`; a sala precisa de r129 ou mais (`removeFromParent`), e o caminhante usa cápsula só de r139 em diante (cilindro antes).
- `tests/team-golden-module.test.ts` roda o módulo do artefato contra a sala do kit (18 specs e clipes iguais, 13 provas com os mesmos checks e linhas de log); `tests/team-golden-nursery.test.ts` roda o `buildLotVeg` da página.
