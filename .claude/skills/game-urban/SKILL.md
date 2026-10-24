---
name: game-urban
description: Use quando precisar dos postes de rua (LED, concreto, ferro, madeira, torre de refletor) com orçamento de luzes, ruas com faixa tracejada, calçadas, quarteirões de prédios com janelas ou dos adereços de rua (cerca, barraca, árvore, contêiner, torre de vigia, sacos de areia, placa, fios), como dados sem three.js.
---

# @adatechnology/game-urban

## Objetivo
O padrão urbano da Galeria do Vale Cinzento como dados: partes na linguagem das silhuetas do `game-floorplan` (caixas de borda arredondada, cilindros, prismas, linhas, placas) mais cones, copas, planos, letreiros e luzes. Não conhece three.js, jogo nem cidade: o vale e o posto de triagem ficam no repositório do jogo.

## Quando usar e quando não usar
- Use para: montar uma rua, um quarteirão ou uma fileira de postes que serve a qualquer jogo (zumbi ou GTA); trocar números dos postes; limitar as luzes reais de uma cena.
- Não use para: desenhar (use o `game-urban-three`), plantas de casas (`game-floorplan`), veículos (`game-vehicles`).

## Como usar
```ts
const urban = createUrban({ lights: { budget: 16 } })
const b = urban.builder({ seed: 7 })
urban.streets.grid(b, { block: 36, count: 2, width: 10 })
urban.block.fill(b, { cx: 0, cz: 0, size: 26, minHeight: 12, maxHeight: 36, lit: 0.05, shop: 0.5 })
urban.poles.get('led_double').build(b, { x: 18, z: 5, on: true })
const scene = b.scene()   // { parts, items, windows: { lit, dark } }
```

## API principal
| Export | Para que serve |
|---|---|
| `createUrban({ packs?, patch?, remove?, shapes?, lights?, streets?, facades?, props? })` | o kit: `poles`, `builder`, `streets`, `block`, `props` |
| `createUrbanBuilder(random, { budget? })` | o construtor de partes (box, cylinder, cone, prism, plane, crown, line, label, light, spot, item, fence, add) |
| `createLightBudget(n)` | o contador do time: `take()` é `left-- > 0` e `left` fica negativo |
| `DEFAULT_POLES`, `POLE_SHAPES` | os cinco postes e os construtores das suas formas |
| `drawRoad`, `drawWalk`, `drawGround`, `drawStreetGrid`, `fillBlock`, `drawBuilding`, `draw*` dos adereços | as mesmas funções soltas |

## Postes
`led_double` (9 m, luz branca 1,3 / 24 m), `concrete_arm` (8 m, sódio 1,3 / 20 m, `dir` e `transformer`), `cast_iron` (4 m, 1 / 14 m), `wood_crossarm` (7 m, 0,9 / 16 m), `flood_tower` (12 m, 1,6 / 34 m). Poste ligado tem lente brilhante e, enquanto o orçamento dura, uma luz real.

## Padrões de bairro
`urban.neighbourhoods`: `downtown`, `suburb`, `working_class`, `historic_street`, `industrial_port`, `railway_village`, `mountain_resort`, `stilt_village`, `military`, `rural`. Cada padrão é dado (`streetWidth`, `walkWidth`, `typologies`, `pole`, `lightColor`, `spacing`, `lit`, `marker`, `text` em pt-BR e en, `params` do compositor) mais a chave `compose` no registro de compositores. `get(id).compose(b, { x, z }, { locale?, providers? })` desenha a rua e o letreiro e devolve o plano (`houses`, `buildings`, `poles`, `vehicles`, `plants`). Provedores: `house` (padrão: silhuetas do `game-floorplan`), `vehicle` (padrão: nenhum; `createVehicleProvider()` estaciona veículos da frota do `game-vehicles-fleet`), `plant` (padrão: pinheiro e árvore dos adereços; `createPlantProvider()` sorteia espécies do `game-vegetation-species` pela tabela da região). Os dois provedores só acrescentam uma parte `placement` (`b.place`); quem desenha é o `game-urban-three` com resolvedores. A escolha vem do lugar, não de `b.random`. `composeSampleSheet(b)` desenha as dez células na ordem da página. `packs`, `patch`, `remove` e `composers` mudam o catálogo.

## Terreno
`urban.terrain(options)`: relevo por camadas (base ondulada, serra e mata funda com máscara, cidades niveladas, rios e lagos escavados), densidade de floresta e cor por regras em ordem. Responde `heightAt(px, py)`, `forestAt`, `colorAt`, `nearRiver`, `toWorld`/`fromWorld` e `grid(segmentos)` (coordenadas, alturas e cores da malha quadrada). `urban.drawTerrain(b, terrain)` põe a malha e o plano d'água. Os números do Vale Cinzento ficam em `game-slice/urban/valley-terrain.json` (repositório do jogo); o SDK só os usa como fixture de teste.

## Compõe com
`game-floorplan` (vocabulário das silhuetas, `createCityBuilding`, `boxRadius`, gerador `createSilhouetteRandom`), `game-contracts` (`mergeById`, `applyPatches`, `removeIds`), `game-urban-three` (desenho).

## Cuidados
- O compositor de cada padrão sorteia na ordem da página; trocar um provedor muda a sequência dali em diante.
- O gerador é um só e é sorteado na ordem da página: pôr `b.random` em outro lugar muda o quarteirão inteiro.
- `lights.left` fica negativo de propósito (como o `LB` da página).
- Um poste de forma nova precisa do construtor em `shapes`; sem ele `poles.get` avisa.
