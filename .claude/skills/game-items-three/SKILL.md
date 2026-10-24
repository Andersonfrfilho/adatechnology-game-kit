---
name: game-items-three
description: Use quando precisar desenhar itens em three.js no tamanho real (lata de feijão, martelo, mochila, chave), com os 24 modelos do time de itens portados, 25 formas simples para todo o resto do catálogo, desgaste novo/usado/estragado, mescla por material, LOD, miniaturas (SVG e render) e a área de testes de itens. Termos, buildItem, setWear, forma simples, modelo 3D do item, prateleira, miniatura do item, orçamento de triângulos, items-test-area.
---

# @adatechnology/game-items-three

## Objetivo
Lado three.js do `@adatechnology/game-items`: desenha **qualquer item de um catálogo no tamanho real** (metros, y para cima, origem no centro da base). Os **24 modelos da vitrine do
time de itens** (Itens do Vale Cinzento) vêm portados literalmente (mesmas unidades, mesmos materiais por tag) e a escala em metros fica na raiz do grupo; todo item sem modelo ganha uma
das **25 formas simples** (`can`, `bottle`, `box`, `bag`, `tool`, `blade`, `long_tool`, `garment`, `backpack`, `jerrycan`, `tank`, `book`, `key`, `battery`, `plank`, `device`...) ajustada ao
`size`. Traz também o desgaste (novo, usado, estragado), a mescla por material, o LOD com orçamento, as miniaturas e a **área de testes de itens** como `TestableModule`.

## Quando usar e quando não usar
- Use para: pôr um item no mundo, na mão, numa prateleira, numa gaveta ou num inventário com a medida certa; mostrar comida estragando; gerar a miniatura; testar o catálogo na sala.
- Não use para: dados do item (é o `game-items-goods`), regras de idade, achados e receitas (é o `game-items`), arma como item (a arma na mão é do `game-weapons-three`).
- Modelo novo do time: registre com `registerItemModel(entry, builder)`; o `model` do item (`ItemDef.model`) é a chave.

## Como usar
```ts
import * as THREE from 'three'
import { createGoodsItems } from '@adatechnology/game-items-goods'
import { buildItem, buildItemLod, setWear, itemThumbnail, createItemsTestModule } from '@adatechnology/game-items-three'

const items = createGoodsItems()
const can = buildItem(THREE, items.get('canned_beans'))      // modelo do time, no tamanho real
scene.add(can.root)
setWear(can.root, 2)                                          // estragado
scene.add(buildItemLod(THREE, items.get('hammer')).root)      // mesclado, com LOD e distância de corte
itemThumbnail(items.get('rice'))                              // { render: true } (modelado) ou { svg } (os demais)
room.loadModule(createItemsTestModule({ catalog: items, translate: goodsText, locale: 'pt-BR' }))
room.openArea('items_area')
```
Para os itens do catálogo ganharem miniatura: `createItems({ patch: thumbnailPatch(items.list()) })`.

## API
| Exportação | Para que serve |
|---|---|
| `buildItem(THREE, item, { wear, simple, detail, kit })` | desenha o item (modelo do time se o `model` está registrado, forma simples se não); devolve `{ root, kind, shape?, size, materials }` |
| `setWear(objeto, 0 \| 1 \| 2)`, `WEAR_TARGET`, `WEAR_AMOUNT` | gasta os materiais do kit rumo à cor do desgaste, em sRGB, como a vitrine |
| `shapeOf(item)`, `drawShape`, `SHAPES`, `shade` | a forma de um item (dica `shape`, refinada por categoria e proporção) e as 25 formas |
| `mergeItem`, `buildItemLod`, `ITEM_BUDGETS`, `checkBudget`, `countTriangles`, `countDrawCalls` | mescla por material, 3 níveis (modelo ou forma, forma com metade dos segmentos, nada além de 30 m / 60 m) e os orçamentos da página (30 chamadas, 400 / 1200 triângulos) |
| `registerItemModel`, `itemModelEntry`, `listItemModels`, `SHIPPED_MODELS`, `MODEL_BUDGET_DEVIATIONS` | registro dos modelos (`models.json` gerado pelo `tools/items-catalog`) e os 7 que passam do orçamento por serem do time |
| `shapeThumbnailSvg`, `itemThumbnail`, `itemThumbnailSvg`, `thumbnailPatch`, `composeThumbnailScene`, `renderItemThumbnail` | miniatura SVG por forma (64x64) ou pedido de render (`Thumbnail`), cena enquadrada e render com o renderer do host |
| `createItemsTestModule({ catalog, locale, translate, seed, wear, provider })`, `shelvesLayout` | a área de testes e o cálculo puro das prateleiras |
| `createItemKit(THREE)` | os helpers (`mesh`, `cyl`, `bx`, `lathe`, `extrude`, `G`, `metal`, `wood`...) que os construtores do time recebem |

## Compõe com
- `@adatechnology/game-items`: o `ItemDef` (tamanho, `model`, `shape`, `color`), o `createFindsProvider`, `freshness`, `craft`; a área usa tudo isso.
- `@adatechnology/game-items-goods`: o catálogo que a área e os testes carregam (devDependency; a área recebe o catálogo por opção, o motor não conhece conteúdo).
- `@adatechnology/game-props3d`: `mergeByMaterial` (veio do `game-weapons-three`) junta as malhas por material.
- `@adatechnology/game-contracts`: `TestableModule`, `ModuleArea`, bancada, `Thumbnail`. `@adatechnology/game-test-room`: carrega a área (devDependency).
- `@adatechnology/game-interactables-household` / `examples/interactables-test-area`: a geladeira, os armários e o guarda-roupa mostram o conteúdo como itens reais.

## Ambiente de teste
`examples/items-test-area` (global `ItemsArea`, `ItemsArea.loadInto(room)`): 14 prateleiras por categoria com todo item no tamanho real, pedestal com os 24 modelos girando, régua de 1,55 m,
silhueta de 1,80 m e a mesa de achados. Bancada: categoria, desgaste, idade (0 a 400 dias), armazenamento e energia, lugar, recipiente, estado, dia do surto, semente, "sortear achados", receita e
"fabricar"; camadas rótulos, caixas e destaque das formas simples; contadores de itens, chamadas de desenho, triângulos e modelados/total; 7 cenários em pt-BR e en. Site: `/items-test-area/`.
Testes: `packages/game-items-three/tests/` (formas, desgaste, orçamentos, golden dos 24 modelos contra o three r128 da página, miniaturas, área com sala de testes de verdade).

## Cuidados
- Os 24 construtores são **literais**: não "melhore" um (o golden `items-showcase.json` compara cada nó); mude o `decisions.json` do `tools/items-catalog` para a escala e rode o `catalog`.
- Cor: o r128 da página guarda o hex como veio e o r160 converte para linear. O kit calcula `baseRgb` do hex e `setWear` mistura em sRGB; não leia `material.color` esperando o hex do time.
- Item sem `model` registrado cai na forma simples (nunca em caixa vazia). Os 233 sem modelo usam medida REF (referência) até o time entregar o modelo (`itens-modelos-3d.md`).
- A forma `bag`/`backpack` enche a caixa do item; os 7 modelos do time acima do orçamento estão em `MODEL_BUDGET_DEVIATIONS` e o teste os aceita só até o valor medido.
- `largeFrom` = 0,6 m (item grande: 1200 triângulos, corte a 60 m) é leitura nossa da página; mude em `ITEM_BUDGETS` se o time pensou outra coisa.
- O `diario` (`survivor_diary`) é item só do jogo: o modelo vem no SDK, o item não está no goods.
- three é peer (`^0.160`); o global do IIFE é `GameItemsThree` (leva os `@adatechnology/*` junto).

## O que vem pela migração
Entrou (T3.2a-c, T3.3a-b): kit, desgaste, formas, `buildItem`, mescla, LOD, orçamentos, os 24 modelos com golden, miniaturas, checklist 3D com tamanho real, área de testes, site e conteúdo real nos móveis.
Falta: os 233 modelos que o time ainda não desenhou; `RoundedBoxGeometry` (G6) só se algum modelo novo precisar.
