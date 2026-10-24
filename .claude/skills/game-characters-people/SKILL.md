---
name: game-characters-people
description: Use quando precisar de pessoas genéricas num jogo, sem engine, como profissão (enfermeira, policial, bombeiro, mecânico, pedreiro, cozinheiro, atirador esportivo, agricultor, eletricista, motoboy, professor, desempregado), criança, idoso, aparência de pessoa, penteado, chapéu, acessório, item na mão, pool de aparência. Pacote de conteúdo do game-characters com nomes en e pt-BR.
---

# @adatechnology/game-characters-people

## Objetivo
Pessoas **genéricas** para o `game-characters` (T4.2c da Fase 4): as **12 profissões** do Elenco como presets (`nurse`, `police_officer`,
`firefighter`, `mechanic`, `builder`, `cook`, `sport_shooter`, `farmer`, `electrician`, `courier`, `teacher`, `unemployed`) com visual, acessórios, o que
levam e a proteção que vestem; **4 faixas de idade** (criança: altura 0,52 a 0,70 e porte 0,68 a 0,76 do adulto; lidas das pessoas da página de Retratos);
os **pools de aparência** (tons de pele, penteados, cores, chapéus, detalhes do rosto) e os **ids dos acessórios** que o construtor de Retratos conhece
(cabelo, chapéu, rosto, vestido, mão). Gente nomeada, histórias, grupos do vale e vida simulada ficam no jogo (`game-slice/characters/`).

## Quando usar e quando não usar
- Use para: povoar uma cidade com gente comum, sortear aparência, montar a tela de criação de personagem, dar profissão a um NPC.
- Não use para: desenhar (o `game-characters-three` lê `look` e `accessories`), nem para zumbi (`game-characters-undead`) ou forças (`game-characters-uniformed`).

## Como usar
```ts
import { createCharacters } from '@adatechnology/game-characters'
import { createPeoplePack, getProfession, getAgePreset, APPEARANCE_POOLS } from '@adatechnology/game-characters-people'

const kit = createCharacters({ packs: [createPeoplePack()] })
const enfermeira = kit.create({ seed: 5, kind: 'nurse' })       // sex 'female'; traits.look e traits.accessories para o desenho
const policial = kit.create({ seed: 6, kind: 'police_officer' }) // protection ['vest_police']
getProfession('firefighter')?.look.hat                            // { kind: 'fire', color: '9A2A20' }
getAgePreset('child')                                             // { height: [0.52, 0.7], build: [0.68, 0.76], ... }
APPEARANCE_POOLS.hairStyles                                       // ['afro', 'bald', 'bun', 'buzz', 'long', 'pony', 'short']
```

## API principal
| Export | Para que serve |
|---|---|
| `PROFESSIONS`, `getProfession(id)` | as 12 profissões: nome `en`/`pt-BR`, `female`, `points`, `protection`, `look`, `accessories`, `hand`, `leftHand`, `carries` |
| `createPeoplePack()` | `CharacterPack` com um preset por profissão para `createCharacters({ packs })` |
| `AGE_PRESETS`, `getAgePreset(id)` | `child`, `young`, `adult`, `elder`: faixas de altura, porte e curvatura |
| `APPEARANCE_POOLS` | valores que as profissões e as 44 pessoas usam: pele, cabelo, chapéu, rosto, mangas, roupa, sapato |
| `ACCESSORIES` | id e encaixe (`hair`, `hat`, `face`, `worn`, `hand`) de cada acessório do construtor |
| `PEOPLE_LOCALES` | `en` e `pt-BR`: faixas de idade e encaixes |

## Compõe com
- `@adatechnology/game-characters`: o kit que cria o personagem; `game-items`: os ids de proteção (`vest_police`, `turnout_gear`).
- `game-characters-three` (T4.1h): o construtor de pessoa e os acessórios leem `look` e `accessories`.

## Ambiente de teste
O `characters-test-area` (T4.4a) mostra as 12 profissões em fila, criança e idoso. Por enquanto, `tests/people.test.ts` confere os dados e o pack, e o
`tools/characters-catalog/tests/people.test.ts` confere contra a fonte.

## Cuidados
- Dado gerado por `tools/characters-catalog` (`catalog`); não editar `src/data/*.json` à mão.
- `points` é o número que a página imprime na criação de personagem; o sinal vem da fonte, o kit não o usa.
- `ACCESSORIES` tem mais de 100 ids (o desenho dizia cerca de 80): são todos os casos do construtor, e alguns só aparecem em gente nomeada do jogo.
- Cores são `RRGGBB` sem `#`.

## O que vem pela migração
Elenco `PROFS`, Retratos (construtor: cabelo, rosto, chapéus, acessórios, itens de mão) e `PEOPLE` (só as faixas de altura e porte). O desenho dos 44 retratos
é do `-three`.
