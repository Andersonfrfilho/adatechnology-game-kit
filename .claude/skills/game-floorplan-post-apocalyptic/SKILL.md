---
name: game-floorplan-post-apocalyptic
description: Use quando a casa gerada precisa estar fortificada (janelas tapadas, barricada, sacos de areia) ou abandonada (saqueada, portas abertas, sangue, roupas no chão) no game-floorplan. Pacote de gênero com os estados fortified e abandoned e a distribuição de sorteio por semente.
---

# @adatechnology/game-floorplan-post-apocalyptic

## Objetivo
Pacote de gênero do `game-floorplan`: os estados `fortified` e `abandoned` como plugin de estado, com seus tipos de item e marcas, e uma distribuição configurável do estado padrão sorteado pela semente (35% fortified, 45% abandoned, 20% normal).

## Quando usar e quando não usar
- Use quando a planta deve parecer tomada pelo apocalipse (casa de qualquer pacote de conteúdo).
- Não use para conteúdo da história de um jogo (nomes, facções): isso fica no repositório do jogo.
- Sem este pacote o motor só conhece `normal`.

## Como usar
```ts
import { engine } from '@adatechnology/game-floorplan'
import { register } from '@adatechnology/game-floorplan-post-apocalyptic'

register(engine) // distribuição padrão
register(engine, { distribution: { fortified: 1 } }) // sempre fortified, salvo state informado
register(engine, { distribution: null }) // padrão sempre normal

engine.generate('townhouse', { seed: 3, state: 'abandoned' }).stateItems
```
`generate` sem `state` sorteia um pela semente conforme a distribuição.

## API principal
| Função/tipo | Para que serve |
|---|---|
| `register(engine, { distribution? })` | Registra locales, itens, `fortified`, `abandoned`, o `registerWallTop('barbed_wire', 0.3)` e a distribuição |
| `defaultDistribution` | `{ fortified: 0.35, abandoned: 0.45, normal: 0.2 }` |
| `postApocalypticStates` | `['fortified', 'abandoned']` |
| `postApocalypticItems`, `fortifiedState`, `abandonedState` | Dados e plugins exportados |
| `enLocale`, `ptBrLocale` | Nomes traduzidos dos estados |

| Estado | Marcas | Itens em `stateItems` |
|---|---|---|
| `fortified` | portas `blocked`, janelas `boards`, itens `barricade` | `window_boards`, `barricade`, `sandbags`, `barbed_wire`, `razor_wire`, `canned_food`, `water_bottle_crates`, `water_jug`, `floor_mattress`, `lantern`, `candles` |
| `abandoned` | portas e portões `open`, itens `ransacked`, `doorOpen` | `open_doors`, `ransacked_drawers`, `open_suitcases`, `clothes_on_floor`, `fallen_chair`, `blood_stains`, `open_gates` |

A barricada marca também o item movido (`barricade`, `moved`) e a porta (`blocked`). O estado `abandoned` dessatura e escurece a paleta.

## Compõe com
- Depende só do tipo do motor `game-floorplan`; os estados se aplicam a qualquer modelo registrado por `-residential` e `-commercial`.
- Os tipos de item de estado têm builders em `game-props3d` (grupo `house_state`: `window_boards`, `barricade`, `sandbags`, `barbed_wire`, `razor_wire`, `blood_stains`...) para desenhar.

## Ambiente de teste
Este pacote hospeda a suíte de propriedades de todo o `game-floorplan` (precisa dos quatro pacotes), em `tests/floorplan.test.ts`:
```sh
pnpm --filter @adatechnology/game-floorplan-post-apocalyptic test # 25 sementes, cerca de 90 s
FULL=1 pnpm --filter @adatechnology/game-floorplan-post-apocalyptic test # as 200 originais
TPL='mansion' pnpm --filter @adatechnology/game-floorplan-post-apocalyptic test # só variantes que casam
```
Confere sobreposição, portas e janelas bloqueadas, caminhos, escadas, piscina, decoração, consistência de estado, contraste de paleta e determinismo.

## Cuidados
- `stateItems` não entram em `items`.
- Registrar com `distribution: null` muda o estado padrão de todas as plantas geradas depois: sempre `normal`.
- O sorteio usa a chave de semente `LEGACY_STREAMS.distribution`, para reproduzir o SDK antigo; não mude a distribuição esperando as mesmas plantas de antes.
- Nomes antigos: `protegida` é `fortified`, `abandonada` é `abandoned` (`MIGRATION.md`).

## O que vem pela migração (spec 001)
- Nenhuma decisão do consolidado cita este pacote diretamente. Indireto: os modelos novos (casas rurais, populares, interiores: C1, C4, C5, C8) passam a aceitar os estados, e os itens de estado devem ligar ao catálogo único (A9) quando fizer sentido.
- Sangue e marcas da horda do ZombiAdA ficam no repositório do jogo (G2); aqui só o genérico.
