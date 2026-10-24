---
name: game-interactables-household
description: Use quando precisar dos móveis e aparelhos interativos da casa já prontos (geladeira, armário, guarda-roupa, gaveta, fogão, botijão, pia, chuveiro, vaso, tomada, quadro de luz, TV, sofá, cama, persiana, lixeira, caixa de correio, lareira, poço, fogueira). 51 tipos, 92 itens domésticos e tabelas de loot, sem renderer.
---

# @adatechnology/game-interactables-household

## Objetivo
Pacote de conteúdo do `game-interactables`: 51 objetos de casa, quintal, zona rural e camping modelados com profundidade real (porta articulada na borda da frente que não atravessa a parede, carcaça oca, gaveta de topo aberto, bandejas na porta). Cada tipo desenha por uma `api` que o jogo passa e devolve um `ObjectSpec` pronto para o `World`.

## Quando usar e quando não usar
- Use para montar a mobília interativa de uma casa ou quintal, com contêineres, loot, energia, gás e água já ligados.
- Não use para decoração sem interação (quadros, luzes de teto, estado da casa: `game-props3d`) nem para desenhar (`game-interactables-three`).

## Como usar
```ts
import { createHousehold, createRecorder } from '@adatechnology/game-interactables-household'
import { createWorld } from '@adatechnology/game-interactables'

const hh = createHousehold({ locale: 'pt-BR', region: 'br' })
const world = createWorld({ locale: 'pt-BR', strings: hh.strings, items: hh.items, loot: hh.loot, seed: 'house-1' })

const { api, primitives, parts } = createRecorder() // em teste/prévia; no jogo use a api do adaptador three
const spec = hh.build('fridge', { seed: 1, contents: { fridge: [{ type: 'milk_carton', qty: 2 }, null] } }, api)
world.add('fridge-1', spec, { x: 2, y: 0, z: 3, ry: 0 })
world.update(1 / 60)
world.target({ x: 2, y: 1.5, z: 5, yaw: 0, pitch: 0 })?.label // "Abrir o freezer"
```
Conferido: `parts` traz `door_fridge` e `door_freezer`; `primitives` traz o corpo estático. Com three, troque `createRecorder().api` por `gfx.createMeshApi().api` (ver `game-interactables-three`).

## API principal
| Membro | Para que serve |
|---|---|
| `createHousehold({ locale?, region? })` | `locale` `en`/`pt-BR`; `region` `br`/`us` (padrão `br` para pt-BR); região desconhecida lança erro |
| `hh.types` | `[{ id, name, group, w, d, h, y, solid }]` (nome localizado; `solid: false` para item de parede e fio) |
| `hh.items` | `ItemCatalog` com os 92 itens (mesmos ids), vindos do `game-items-goods`: tamanho, peso, empilhável, forma, cor, `category` (uma das 14 do `game-items`; a categoria antiga fica em `tags`). `HOUSEHOLD_ITEM_IDS` lista os ids |
| `hh.loot` | Tabelas: `fridge`, `freezer`, `kitchen_cabinet`, `kitchen_drawer`, `pantry`, `wardrobe`, `dresser`, `nightstand`, `bathroom_cabinet`, `under_sink`, `trash`, `mailbox`, `bbq_counter`, `garage_shelf` |
| `hh.strings`, `hh.region` | Textos (`type.<id>`, `item.<id>` vindo do goods, `prompt.*`) e dados da região (botijão, padrão de tomada, caixa de correio, varal) |
| `hh.build(type, item, api)` | Desenha e devolve o `ObjectSpec`; determinístico para o mesmo `item.seed` |
| `createRecorder()` | `{ api, primitives, parts }` para teste e prévia |
| `HOUSEHOLD_TYPES`, `HOUSEHOLD_REGIONS` | Ids dos tipos e regiões |
| `cornersOf`, `motionPoint`, `sweepOf` | Geometria de varredura |

`HouseholdApi` = `PropsApi` do `game-props3d` + `part(id, pivot, ry, draw)` (um grupo móvel por parte; `ry` é sempre 0 aqui). `HouseholdItem` estende `PropItem` com `contents`, `hinge`, `circuit`, `controls`, `requires`, `circuits`, `points`, `house`, `sag`, `flueHeight`, `chimneyHeight` e `variant` (ex.: `fridge` `'steel'`, `pantry` `'garage'`, `service_entrance` `'gato'`).

Grupos: storage (fridge, fridge_compact, kitchen_cabinet_base/wall, pantry, wardrobe, dresser, nightstand, bathroom_cabinet), kitchen/bathroom (stove, gas_bottle, sink_kitchen, sink_bathroom, shower, toilet, utility_sink), electrical (wall_socket, wall_switch, service_entrance, electrical_panel, power_meter, conduit_run, tv, microwave, washing_machine), seating (sofa, armchair, dining_chair, bed_double, bed_single, bunk_bed, bench), janela, quintal, rural e camp. Lista completa em `hh.types`.

## Compõe com
- Depende de `game-interactables` (`ObjectSpec`, mundo) e `game-props3d` (`PropsApi`, `PropItem`), ambos `dependencies`.
- `game-interactables-three` desenha o que `build` descreve; `game-floorplan*` decide onde cada tipo vai na casa.

## Ambiente de teste
`examples/interactables-test-area` (um item por tipo, cenários) e `examples/interactables-showroom` (showroom andável pt-BR); `node build.mjs` em cada um depois de `pnpm -r build`. Os testes do pacote estão em `tests/`.

## Cuidados
- A `api` é sua: sem uma `part`, nada de parte móvel; passe sempre uma que agrupe.
- Frente é `+z` local e assentos olham para `+z` (`ry = PI`, porque yaw 0 é `-z` no `game-interactables`).
- `gas_bottle` dentro de armário precisa de `requires: { object, part }` para a válvula só funcionar com a porta aberta.
- `electrical_panel`: um disjuntor por circuito (começa ligado, só com a porta aberta); sem `circuits`, um circuito `main`.
- Vidro do chuveiro e do vidro fixo são painéis macios, nunca colisores.
- `variant: 'gato'` em `service_entrance` é ligação clandestina: só fio, sem poste, subida nem caixa de medidor.
- Tipo desconhecido em `build` lança erro.
- Os itens vêm do goods: para mudar medida, peso ou nome, mexa em `tools/items-catalog/decisions.json` (ou use `patch` no `createItems`), não aqui. Oito itens mudaram de medida na fusão (`rice`, `water_bottle`, `juice_box`, `bandage`, `first_aid_kit`, `flashlight`, `batteries`, `hammer`; o martelo agora está em pé, na pose do modelo do time) e 18 mudaram de peso (vale o do time).

## O que vem pela migração (spec 001)
- A9 (feito, T3.1f/g): o catálogo único de itens (`game-items-goods`: 327 itens, 14 categorias, receitas, onde aparece) estende o `ItemDef`; os 92 itens domésticos se fundiram com ele (38 viraram o item do time com o id daqui) e `items.json` e as chaves `item.*` do locale saíram deste pacote. O pacote passa a depender do `game-items-goods`.
- C5/C8: interiores de lugares e o barraco com "gato" de luz usam estes tipos (o `service_entrance` com `variant: 'gato'` já existe).
- Os 57 tipos de móvel do time já são os do `game-props3d`; nada a portar além dos itens.
