---
name: game-characters-undead
description: Use quando precisar dos dados de zumbi do kit, sem engine, como tipos de zumbi (lento, corredor, rastejador, brutamonte, farejador, saltador, inchado, espreitador, cego, gritador, carbonizado, afogado, devorador), idade da infecção, roupa do zumbi, colete e capacete, olho que brilha, andar, velocidade por momento, ferida que infecta, febre, delírio, reanimar, criança que vira zumbi. Camada só de zumbi sobre o game-characters.
---

# @adatechnology/game-characters-undead

## Objetivo
A camada **só de zumbi** sobre o `game-characters`, como **dado puro** (T4.2a da Fase 4): os 13 tipos do jogo (vida, velocidades por momento, dano,
chance de mordida, multiplicadores de cabeça/tronco/braços/pernas, percepção, olho da v17, postura, andar, parâmetros de habilidade, textos),
as 4 idades da infecção, as 4 roupas com proteção e achado, a linha do tempo da infecção e os multiplicadores de velocidade por momento.
Fica à parte para um jogo estilo GTA nunca importar nada de zumbi. O motor (`assign`/`turn`/`fromAgent`, velocidades × momentos, ganchos de
dano) vem na T4.2b; a regra de surto dos animais, na T4.3c. Os dados vêm de `tools/characters-catalog` (`catalog:check` acusa dado velho).

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

## Compõe com
- `@adatechnology/game-characters`: o motor que lê estes números (T4.2b); os ids de proteção são os do `game-items`.
- `game-infection`: o modelo de surto; aqui a linha do tempo é dado.

## Ambiente de teste
O módulo do `characters-test-area` (T4.4a) mostra os 13 tipos em fila, a idade 0 a 3 e a infecção acelerada. Por enquanto, `tests/data.test.ts` confere
os dados contra os goldens de sorteio (`game-spawn.json`: 650 sorteios).

## Cuidados
- Dado gerado: não editar `src/data/*.json` à mão; mude `tools/characters-catalog/decisions.json` e rode `catalog`.
- Chance de infecção: padrão do jogo (6 / 22 / 100 %); o Bestiário diz 20 % no arranhão (`alternatives`).
- Afogado: peso 1 com `requires: 'water'` (o jogo tem 0; o Bestiário 1 %). Noite ×1: o jogo não tem multiplicador.
- Os textos `en` foram escritos aqui (as fontes só têm pt-BR); `pt-BR` é cópia do catálogo e um teste confere.

## O que vem pela migração
Bestiário (13 fichas), jogo `CATS`, `IDADES`, `ROUPAS`, `INFEC`, `FERIDA` e o Elenco `STAGES`. Falta (T4.2b): `assign`/`turn`/`fromAgent`, velocidade × momento, criança, infecção de ferida.
