---
name: game-floorplan-interactables
description: Use quando precisar transformar uma planta de casa gerada (game-floorplan) em objetos interativos do kit (portas, gavetas, geladeira, tomadas, interruptores, lâmpadas, botijão, torneiras, cadeiras em volta da mesa), ligar a instalação elétrica, de gás e de água da casa, preencher os móveis com os achados da planta, ou trocar/estender a tabela de móveis e de itens sem mexer no adaptador. É o adaptador padrão do `interactives` do game-floorplan-three.
---

# @adatechnology/game-floorplan-interactables

## Objetivo
Levar a planta (`engine.generate`) para o mundo de `game-interactables`: cada móvel vira um objeto de `game-interactables-household` com suas partes, a casa ganha a rede
(entrada de energia, medidor, quadro, circuitos, tomadas, interruptores e lâmpadas), o gás (botijão, tubulação), os pontos de água, as cadeiras em volta das mesas e o conteúdo dos
móveis (itens do catálogo de bens). Porte literal do `AdaptadorInterativos` v0.3.0 do time; nomes originais em `MIGRATION.md`.

## Quando usar e quando não usar
- Use para: montar a casa interativa no jogo ou em teste, sem three.js (com three.js use `game-floorplan-three`, que já traz este adaptador como padrão).
- Não use para: desenhar (`game-interactables-three`), gerar a planta (`game-floorplan*`), nem para regras de um jogo (histórias, facções): isso fica no repositório do jogo.

## Como usar
```ts
import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import { create } from '@adatechnology/game-floorplan-interactables'

const adapter = create({ GameInteractables, GameInteractablesHousehold, locale: 'en' })
const planned = adapter.plan(house, { seed: 1, night: true })
const world = adapter.createWorld(house, { seed: 1 })
adapter.add(world, planned, { isBlocked: adapter.blockedOf(house) })
```
Com o renderizador: `create(THREE, { interactives: { GameInteractables, GameInteractablesHousehold, GameInteractablesThree, adapterOptions: { typeMap: { fridge_large: null } } } })`.
Para usar um adaptador próprio: `interactives.adapter` (objeto com `plan/add/createWorld/blockedOf` ou fábrica com `create`).

## API principal
| Função | Para que serve |
|---|---|
| `create(options)` | cria o adaptador: `{ version, household, plan, createWorld, add, blockedOf, pointOf, ownSpec, registries }` |
| `plan(house, { seed, floor, externals, night, lightsOn, chairs, originX, originZ, inw, base })` | lista de objetos, ligações, fixtures, cadeiras, `unmapped`, `warnings` |
| `add(world, planned, { build, isBlocked, lightsOn })` | cria os objetos no mundo, encaixa as portas nas paredes |
| `TYPE_MAP`, `CONTENT_MAP`, `CONTENT_BY_GROUP`, `CHAIR_TABLES`, `PREFERENCE` | tabelas padrão; `mergeRegistry(base, override)` (chave `null` remove) |

## Opções e tabelas
Tudo é registro: `typeMap`, `contentMap`, `contentByGroup`, `contentFallback`, `groupOf`, `chairTables`, `fixturesOfPoint`, `substitutes`, `preference`, `ownTypes`, `frozenItems`,
`drawerItems`, `messages`, `seedKey`, `locale` (padrão `pt-BR`), `region` (padrão `br`).

## Armadilhas
- Sem o pacote de estrutura a planta não tem `utilities`: a casa vem só com os móveis.
- Os ids que o adaptador cria foram renomeados (`service_entrance`, `panel`, `meter`, `piped_gas`...): as sementes só batem com as do time com `seedKey`.
- Tipo de móvel fora de `typeMap` vai para `unmapped` e não aparece; confira `planned.unmapped`.
- Sem `Math.random`: toda sorte vem da semente.
