---
name: game-characters-undead
description: Use quando precisar dos dados de zumbi do kit, sem engine, como tipos de zumbi (lento, corredor, rastejador, brutamonte, farejador, saltador, inchado, espreitador, cego, gritador, carbonizado, afogado, devorador), idade da infecção, roupa do zumbi, colete e capacete, olho que brilha, andar, velocidade por momento, ferida que infecta, febre, delírio, reanimar, criança que vira zumbi. Camada só de zumbi sobre o game-characters.
---

# @adatechnology/game-characters-undead

## Objetivo
A camada **só de zumbi** sobre o `game-characters`, como **dado puro** (T4.2a da Fase 4): os 13 tipos do jogo (vida, velocidades por momento, dano,
chance de mordida, multiplicadores de cabeça/tronco/braços/pernas, percepção, olho da v17, postura, andar, parâmetros de habilidade, textos),
as 4 idades da infecção, as 4 roupas com proteção e achado, a linha do tempo da infecção e os multiplicadores de velocidade por momento.
Fica à parte para um jogo estilo GTA nunca importar nada de zumbi. O motor (`createUndead`: `assign`/`create`/`turn`/`fromAgent`, `speedFor`, `infect`, ganchos de
dano) está em `kit.ts`, e a regra de surto dos animais (`createAnimalOutbreak`) em `animals/outbreak.ts`. Os dados vêm de `tools/characters-catalog` (`catalog:check` acusa dado velho).

## Quando usar e quando não usar
- Use para: sortear e descrever zumbis, montar a interface de um bestiário, configurar o jogo com os mesmos números do ZombiAdA.
- Não use para: corpo e dano (`game-characters`), desenho (`game-characters-three`), horda e IA (Fase 8, `game-crowd`).

## Como usar
```ts
import { UNDEAD_TYPES, UNDEAD_INFECTION, UNDEAD_LOCALES, childTypeIds, getUndeadType } from '@adatechnology/game-characters-undead'

const corredor = getUndeadType('runner')   // { health: 70, speed: { wander: 1.2, chase: 5.5, sprint: 6 }, eye: { color: 'E5392B' }, gait: {...} }
UNDEAD_INFECTION.wounds.bite               // { share: 0.1, infectionChance: 1 }  (arranhão 6%, laceração 22%, mordida 100%)
childTypeIds()                             // 11 tipos: criança vira qualquer um, menos brutamonte e inchado
UNDEAD_LOCALES['en'].typeText.walker.role  // textos em en e pt-BR
```

## API principal
| Export | Para que serve |
|---|---|
| `UNDEAD_TYPES`, `getUndeadType(id)` | os 13 tipos na ordem do catálogo; `requires: 'water'` no afogado (peso 1), `childEligible: false` no brutamonte e no inchado |
| `UNDEAD_AGES`, `getUndeadAge(id)` | `fresh`, `recent`, `old`, `decrepit`: probabilidade, sangue, velocidade, vida, dano de membro; e as paletas de pele, sangue e pano |
| `UNDEAD_OUTFITS`, `getUndeadOutfit(id)` | `civilian`, `police`, `military`, `firefighter`: probabilidade, ids de proteção do `game-items`, colete por classe, capacete, fogo, achado |
| `UNDEAD_INFECTION` | chance por ferida, tempos acelerados (febre, delírio, morte, reanimar) e os 5 estágios visuais |
| `UNDEAD_MOMENTS` | multiplicadores: alerta ×1,3, grito ×1,2, ferido ×0,5, rastejar até 0,4, água, noite ×1 |
| `UNDEAD_LOCALES` | `en` e `pt-BR`: textos dos tipos, idades, roupas, estágios e feridas |
| `childTypeIds()` | os tipos em que uma criança pode virar |
| `undeadCrowdPack()` | o pacote da multidão do `game-crowd`: os 13 tipos com os números da horda do jogo (`CATS`: cego 3,0, carbonizado 2,2, afogado 2,5 e peso 0, devorador 3,0) e cada habilidade como traço; idades, roupas, segmentos e paleta |

## O motor (`createUndead`)
```ts
import { createCharacters } from '@adatechnology/game-characters'
import { createUndead, createUndeadPack } from '@adatechnology/game-characters-undead'

const kit = createCharacters({ packs: [createUndeadPack()] })
const undead = createUndead(kit, { speedPreset: 'team-game', infectionClock: 'accelerated' })
const zombie = undead.create({ seed: 7 }, { type: 'runner' })      // altura em metros, vida, multiplicadores, proteção da roupa e velocidades em spec.traits.undead
undead.speedFor(undead.traitsOf(zombie)!, { moment: 'chase' })       // m/s absolutos (idade já aplicada)
const infection = undead.infect('bite', random)                    // caso com fases malaise, fever, delirium, dead, reanimated
const turned = undead.turn(person)                                 // mesmo corpo, mesmo olhar, mesmo membro faltando; criança vira nos tipos do `childTypePool`
```
`createAnimalOutbreak({ species, enabled, timeScale })` é a regra de surto dos bichos (morde, incuba, vira ou morre, carcaça que atrai). Tudo é opção: `patch`, `remove`, `types`, `rules`, `speedOverrides`, `childTypePool`.

## Compõe com
- `@adatechnology/game-characters`: o motor que lê estes números; `createUndeadPack()` põe os tipos como presets do kit; os ids de proteção são os do `game-items`.
- `game-infection`: o modelo de surto; aqui a linha do tempo é dado.

## Ambiente de teste
O módulo do `characters-test-area` (`createCharactersTestModule`, no `game-characters-three`) mostra os 13 tipos em fila, a decomposição 0 a 3, a mordida até virar e a multidão. O módulo do `animals-test-area` usa `createAnimalOutbreak`. `tests/data.test.ts` confere
os dados contra os goldens de sorteio (`game-spawn.json`: 650 sorteios).

## Cuidados
- Dado gerado: não editar `src/data/*.json` à mão; mude `tools/characters-catalog/decisions.json` e rode `catalog`.
- Chance de infecção: padrão do jogo (6 / 22 / 100 %); o Bestiário diz 20 % no arranhão (`alternatives`).
- Afogado: peso 1 com `requires: 'water'` (o jogo tem 0; o Bestiário 1 %). Noite ×1: o jogo não tem multiplicador.
- Os textos `en` foram escritos aqui (as fontes só têm pt-BR); `pt-BR` é cópia do catálogo e um teste confere.

## O que vem pela migração
Bestiário (13 fichas), jogo `CATS`, `IDADES`, `ROUPAS`, `INFEC`, `FERIDA` e o Elenco `STAGES`. O motor (`assign`/`turn`/`fromAgent`, velocidade × momento, criança, infecção de ferida) e a regra de surto dos animais estão neste pacote.
