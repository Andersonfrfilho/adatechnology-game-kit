---
name: game-stories
description: Use quando precisar de histórias num jogo, como eventos por dia com papéis, condições e escolhas do jogador, escalação de quem faz cada papel, crônica, ficha de personagem com compra de pontos, derivados, memória e opinião, ou a vida sorteada de um grupo de pessoas (ferimentos, casais, filhos, brigas, traição, troca entre bases, saque, chegadas). Puro e determinístico por semente, sem three.js. Termos, histórias, crônica, ficha, NPC, vida simulada, createStoryWorld.
---

# @adatechnology/game-stories

## Objetivo
Histórias como dados (T8.2 da spec 001), porte literal de Os Vivos do Vale (`life()`, `simulate()`, o motor de eventos `EV`, `ACTS`, `fill`) e da
ficha de Personagens (compra de pontos, derivados, habilidades e marcos, memória e opinião). Todo número está em `src/data/life.json` e
`src/data/sheet.json` com a linha de origem; os textos da vida sorteada em `src/data/life-text.json` (pt-BR literal e en).

## Quando usar e quando não usar
- Use para: eventos que acontecem por dia e leem as ações do jogador, NPCs com ficha e memória, um grupo de pessoas que vive sozinho entre as
  histórias, a tela de criação de personagem (compra de pontos).
- Não use para: o corpo do jogador (`game-player`), a multidão (`game-crowd`), o contágio por regiões (`game-infection`), nem para guardar as
  histórias de um jogo (elas são conteúdo do jogo; o vale está em `specs/001-migracao-entregas-dos-times/game-slice/stories/`).
- Mundo normal primeiro: `life.numbers.infection` é `false`; a faixa de mordida vira ferimento e ninguém reanima.

## Como usar
```ts
import { createStoryWorld, createSheet } from '@adatechnology/game-stories'

const world = createStoryWorld({ people, stories, life: { groups, relations, couples }, fill: 80, seed: 7, locale: 'pt-BR' })
world.act('fix_well')
world.runTo(30)
world.chronicle.entries
world.sheet(world.cast('keeper')).history
createSheet({ profession: 'nurse', traits: ['athlete'] }).pool()
```

## API principal
| Export | Para que serve |
|---|---|
| `createStoryWorld(options)`, `simulateStories(days, options)` | O mundo: `act`, `advance`, `runTo`, `states`, `flags`, `chronicle`, `casting`, `life`, `person`, `people`, `nameOf`, `cast`, `sheet` |
| `castStories(stories, options)` | Escalação (P9): pessoa fixa, alguém que serve, ou alguém feito dos pools de nomes; papéis de mesmo id são a mesma pessoa |
| `runBeat`, `applyChanges`, `setState`, `holds`, `fillText`, `shortName` | O motor de eventos: variantes (a primeira que vale), condições, pedaços de texto, mudanças |
| `createLifeWorld`, `lifeDay`, `fillWorld` | A vida sorteada, linha a linha do `life()` do time |
| `createSheet`, `drawSheet` | A ficha: `pool`, `valid`, `derived`, `milestones`, `record`, `remembers`, `opine`, `decay`, `stance` |
| `LIFE_DEFAULTS`, `LIFE_TEXT`, `SHEET_DEFAULTS`, `lifeNumbersOf`, `lifeTextOf` | Números e textos com as fontes; o jogo troca por `life.numbers` e `life.text` |
| `createStoriesTestModule`, `STORIES_AREA_ID`, `STORIES_EXAMPLE` | A bancada (`stories_area`) e o conteúdo de exemplo do kit |

## Compõe com
`game-characters-people` (`SHEET_RULESET`, `NAME_POOLS`: a regra da ficha e os nomes), `game-characters` (o sorteio `createRng`), `game-contracts`
(`TestableModule`). O jogo junta as histórias com `game-crowd` (quem anda na rua) e `game-player` (a ficha do jogador).

## Ambiente de teste
`pnpm --filter @adatechnology/game-stories test --testTimeout=60000`: o golden `game-stories-life.json` (7 vidas inteiras, 40 por hash, 96 conjuntos de
ações sem vida sorteada, 48 fichas, gravado por `pnpm --filter @adatechnology/characters-catalog-tool golden:vm`) é refeito. A bancada abre em
`examples/stories-test-area` (`sala-historias.html`) e também no `examples/interactables-test-area`.

## Cuidados
- A escalação e cada ficha sorteiam de fluxos próprios (`seed ^ 0x9e3779b9`, `seed ^ fnv(id)`): a vida sorteada segue a sequência do time.
- A ficha de exemplo do kit e os grupos do exemplo são invenção do kit, marcados `example` (pergunta 16 do desenho).
- Perguntas abertas no desenho `T8-multidao-historias-jogador.md`: decaimento da opinião (1 por dia), que memória sai depois de 30, sorteio da ficha.
