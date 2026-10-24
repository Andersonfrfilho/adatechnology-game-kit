---
name: game-animals
description: Use quando precisar de animais num jogo, sem engine, como espécie, quadrúpede, ave, cobra, proporções do corpo, patas, pescoço, cabeça, orelha, cauda, andar, trote, galope, fase das patas, estado visual vivo infectado morto, altura do corpo, registro de espécies com packs. O motor do kit de animais, sem three.js.
---

# @adatechnology/game-animals

## Objetivo
O motor dos animais, **sem three.js e sem jogo** (T4.3a da Fase 4): o **spec de corpo** de quadrúpede, ave e cobra (`AnimalBodySpec`: comprimento e raio,
perfil, patas `fu/fl/hu/hl`, pescoço, cabeça, orelhas, cauda, cores, marcador de textura), as **três tabelas de fase das patas** (`GAIT_PHASES`: andar, trote, galope),
os **estados visuais** (`alive`, `infected`, `dead`), a **conta da pose de repouso** (altura das patas e do corpo, tamanho) e o **registro de espécies** com
`packs`, `patch` e `remove`. As espécies vêm do `game-animals-species`; o desenho é do `game-animals-three`; a regra de surto (vira, morre) é do
`game-characters-undead` (T4.3c), e o motor ignora o campo `outbreak`.

## Quando usar e quando não usar
- Use para: descrever um animal, saber quão alto o corpo fica, escolher a fase das patas, decidir o visual depois da mordida, montar o catálogo de um jogo.
- Não use para: desenhar (o `game-animals-three`), comportamento de bando e IA (Fase 8, `game-crowd`) nem regra de zumbi.

## Como usar
```ts
import { createAnimals, quadrupedLayout, visualStateOf, GAIT_PHASES } from '@adatechnology/game-animals'
import { createSpeciesPack } from '@adatechnology/game-animals-species'

const kit = createAnimals({ packs: [createSpeciesPack()], remove: ['rat'], patch: { dog: { walkHz: 1.8 } } })
const cao = kit.get('dog')                       // AnimalSpecies: body, walkHz, runHz, outcome, outbreak
if (cao?.body.kind === 'quadruped') quadrupedLayout(cao.body) // { frontHipHeight, hindHipHeight, bodyHeight, span, size }
visualStateOf('turns', true)                     // 'infected'  ('dies' → 'dead', 'immune' → 'alive')
visualStateOf('immune', false, true)             // 'dead': o visual de morto vale para qualquer espécie
kit.gait('gallop')                               // fases das quatro patas, em radianos
```

## API principal
| Export | Para que serve |
|---|---|
| `createAnimals(options)` | kit: `species` (na ordem de produção), `get(id)`, `gait(name)`; opções `packs`, `patch`, `remove`, `gaits` |
| `GAIT_PHASES` | `walk`, `trot`, `gallop`: fase de cada pata (dianteira direita, dianteira esquerda, traseira direita, traseira esquerda) |
| `quadrupedLayout(spec)`, `birdSize(spec)`, `lineUpLength(body)` | conta da pose de repouso: onde ficam os quadris, a altura do corpo, o tamanho e o espaço numa fila |
| `visualStateOf(outcome, isBitten, forceDead?)` | o visual depois de uma mordida |
| tipos `AnimalSpecies`, `QuadrupedSpec`, `BirdSpec`, `SnakeSpec`, `AnimalOutbreak`, `TextureMarker` | o contrato dos dados |
| `mergeById`, `applyPatches`, `removeIds` | os registros por id |

## Compõe com
- `@adatechnology/game-animals-species`: as 13 espécies; `game-animals-three`: o desenho e a animação; `game-props3d`: a pele de GPU (`node-skin`).
- `game-characters-undead` (T4.3c): a regra de surto lê `outbreak` e `outcome`; `game-infection`: tipos estruturais, sem import.

## Ambiente de teste
O módulo do `animals-test-area` (`createAnimalsTestModule`, no `game-animals-three`) mostra as 13 espécies, o estado visual, a marcha, a regra de surto e 40 bichos em pele de nós. `tests/animals.test.ts` confere a conta do layout, as fases e o registro.

## Cuidados
- Unidades: metros e radianos. As tabelas de fase estão em radianos (a página usa `Math.PI * 0.92` no galope).
- O campo `hasExtraBuilder` avisa que a página monta partes com código (cupim, crina, crista...): o `game-animals-three` as traz por id de espécie.
- Nada de `Math.random`: a fase inicial do passo é do desenho.
- O visual `dead` vale para as 13 espécies (a página só o usava nas que morrem).

## O que vem pela migração
Bichos do Vale: `SPECIES`, `SPEC`, `GAIT`, `ORDER` (gerados por `tools/animals-catalog`) e a conta de pose de `quad`/`bird`. O desenho (`quad`, `bird`, `snake`) e a animação estão no `game-animals-three`.
