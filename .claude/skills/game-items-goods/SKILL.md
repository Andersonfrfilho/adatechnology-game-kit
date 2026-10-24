---
name: game-items-goods
description: Use quando precisar do catálogo pronto de itens do mundo real para um jogo (327 itens com tamanho em metros e peso real, categorias, lugares, recipientes, receitas, pools das casas, esgotamento, efeitos de uso, caixas de munição e textos pt-BR/en), para montar o catálogo com createItems/createGoodsItems. Termos, goods, catálogo de itens, itens do Vale Cinzento, lata de feijão, marreta, ração.
---

# @adatechnology/game-items-goods

## Objetivo
Conteúdo do `game-items`: 327 itens reais (tamanho em metros, peso em kg, raridade, durabilidade, validade, nutrição, proteção, carga, onde aparecem), 17 categorias, 24 lugares, 17 recipientes,
6 raridades, 7 armazenamentos, 33 receitas, 9 efeitos de uso, os pools explícitos dos móveis das casas, as tabelas de esgotamento e surgimento, as caixas de munição do jogo, alcance e ruído
do corpo a corpo, a rastreabilidade de cada item e os textos em pt-BR (nomes do time) e en. É dado mais um invólucro tipado: sem lógica, sem three, sem jogo.
Gerado por `tools/items-catalog` a partir das entregas do time e dos itens do household; `decisions.json` é a única parte mantida à mão (e `src/data/locales/en.json`).

## Quando usar e quando não usar
- Use para: dar a um jogo o catálogo base (`createGoodsItems`), consultar tabelas (`GOODS_TABLES`), traduzir nomes (`goodsText`), saber de onde veio um item (`GOODS_PROVENANCE`).
- Não use para: lógica de itens (é o `game-items`), desenhar (é o `game-items-three`), itens de história (documentos, chaves nomeadas: ficam na fatia do jogo).

## Como usar
```ts
import { createGoodsItems, GOODS_ARSENAL_RECORDS, goodsText } from '@adatechnology/game-items-goods'
import { createItems, itemsFromArsenal } from '@adatechnology/game-items'

const items = createGoodsItems({ patch: { hammer: { weight: 1.2 } }, packs: [itemsFromArsenal(arsenal, { records: GOODS_ARSENAL_RECORDS })] })
goodsText('item.hammer', 'pt-BR')   // 'Martelo'
```
Para controle total: `createItems({ packs: [goodsPack, ...], remove, include })`; a ordem dos pacotes decide quem vence por id.

## API
| Exportação | Para que serve |
|---|---|
| `goodsPack`, `createGoodsItems(options?)` | `ItemPack` (itens, categorias, lugares, recipientes, efeitos, receitas, pools) e `createItems` com ele primeiro |
| `GOODS_ITEMS`, `GOODS_CATEGORIES`, `GOODS_PLACES`, `GOODS_CONTAINERS`, `GOODS_RECIPES`, `GOODS_USE_EFFECTS` | dados tipados |
| `GOODS_HOUSE_POOLS` | pools por tipo de móvel do visor 3D e as chaves que repartem pool |
| `GOODS_TABLES` | raridades, armazenamento, esgotamento, surgimento e corpo a corpo, como lidos |
| `GOODS_ARSENAL_RECORDS` | caixas de munição e armas como item, para `itemsFromArsenal` |
| `GOODS_PROVENANCE` | origem do item (time, household, tipos do visor, ids do jogo, de onde vêm o id e a medida) |
| `GOODS_STRINGS`, `goodsText`, `pickGoodsLocale` | chaves `item.<id>`, `category.<id>`, `place.<id>`, `rarity.<id>`, `container.<id>`, `recipe.<id>` |

## Compõe com
- `@adatechnology/game-items`: dependência; define os tipos e consome o pacote.
- `@adatechnology/game-interactables-household`: pega daqui os itens e os textos `item.*` (T3.1g).
- `game-items-three` (T3.2): desenha por `size`; o `model` dos 24 modelados é dele.

## Ambiente de teste
`packages/game-items-goods/tests/`: o pacote valida em `createItems`, ids únicos em inglês, referências existentes, rastreabilidade completa, texto nos dois idiomas. O `tools/items-catalog` prova os dados contra as fontes e tem o `--check`.

## Cuidados
- Não edite `src/data/*.json` à mão (exceto `locales/en.json`): mude `tools/items-catalog/decisions.json` e rode `pnpm --filter @adatechnology/items-catalog-tool catalog`. O teste `catalog-up-to-date` falha se ficar defasado.
- `GOODS_HOUSE_POOLS` corta o pool para o que o `createItems` lê; `type`, `name` e `viewerCategory` do visor ficam em `data/house-pools.json`.
- Os 24 modelados têm a medida da caixa do time × escala real; 7 deles perderam a medida antiga do household (veja `decisions.json`, T3.1d).
- Itens de história (diário, ordem de evacuação...) não estão aqui: vão na fatia do jogo.

## O que vem pela migração
Entrou: T3.1f (pacote, textos, testes). Falta: household usando o goods (T3.1g), medidas e modelos 3D (`game-items-three`, T3.2), ligação das armas corpo a corpo (`weapon`, T3.1i), fatia do jogo (T3.1j).
