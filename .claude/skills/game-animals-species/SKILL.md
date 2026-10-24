---
name: game-animals-species
description: Use quando precisar das espécies de animais do kit, como vaca, cavalo, porco, javali, capivara, onça, cachorro, gato, galinha, quero-quero, urubu, jararaca, rato, espécie que vira zumbi, que morre da infecção ou é imune, alcance do som do animal, carcaça que atrai urubu. Pacote de conteúdo do game-animals, com nomes en e pt-BR.
---

# @adatechnology/game-animals-species

## Objetivo
O pacote de conteúdo do `game-animals` (T4.3a da Fase 4): as **13 espécies** do Bichos do Vale (`cow`, `horse`, `pig`, `wild_boar`, `capybara`, `jaguar`, `dog`, `cat`,
`chicken`, `southern_lapwing`, `vulture`, `lancehead`, `rat`), cada uma com spec de corpo, `walkHz`, `runHz`, grupo, fase, desfecho da infecção (vira 6, morre 3,
imune 4), alcance do som e o campo opcional **`outbreak`** (tempo para virar, chance de infecção do rato, horas até morrer, carcaça que atrai) que o motor ignora.
Os textos do vale (onde vive, papel, cuidado) e as zonas ficam no jogo (`game-slice/animals/`). Dados gerados por `tools/animals-catalog`.

## Quando usar e quando não usar
- Use para: povoar um jogo de campo, fazenda ou selva; montar a lista de animais de uma tela; ler o desfecho de uma mordida.
- Não use para: desenhar (`game-animals-three`), comportamento (Fase 8) ou textos do vale (jogo).

## Como usar
```ts
import { createAnimals } from '@adatechnology/game-animals'
import { SPECIES, createSpeciesPack, getSpecies, SPECIES_LOCALES } from '@adatechnology/game-animals-species'

const kit = createAnimals({ packs: [createSpeciesPack()] })
getSpecies('pig')?.outcome            // 'turns'
getSpecies('rat')?.outbreak           // { turnMinutes: { min: 2, max: 2 }, biteInfectionChance: 0.05 }
getSpecies('cow')?.soundRangeMetres   // 80
SPECIES_LOCALES['pt-BR'].outcomes.dies // 'Morre'
```

## API principal
| Export | Para que serve |
|---|---|
| `SPECIES`, `getSpecies(id)` | as 13 espécies na ordem de produção da página |
| `createSpeciesPack()` | `AnimalPack` para `createAnimals({ packs })` |
| `SPECIES_LOCALES` | `en` e `pt-BR`: grupos, fases e desfechos |

## Compõe com
- `@adatechnology/game-animals`: o motor; `game-animals-three`: o desenho (as espécies com `hasExtraBuilder` têm partes feitas por código).
- `game-characters-undead` (T4.3c): a regra de surto lê `outbreak`.

## Ambiente de teste
O `animals-test-area` (T4.4b) lista as 13 espécies. Por enquanto, `tests/species.test.ts` confere contagens, desfechos e o golden da página.

## Cuidados
- Dado gerado: não editar `src/data/species.json` à mão; mude `tools/animals-catalog/decisions.json` e rode `catalog`.
- Cores são inteiros `0xRRGGBB`; texturas são marcadores (`stripes` no gato, `spots` na onça), pintados por quem desenha.
- `hasExtraBuilder` marca vaca, cavalo, javali, galinha e quero-quero: o desenho tem partes por código para eles.
- O sinal da infecção varia por fonte: o desfecho é o da página (`vira`, `morre`, `imune`).

## O que vem pela migração
Bichos do Vale: `SPECIES`, `SPEC`, `ORDER` e as faixas de som. Fica no jogo: textos do vale, zonas e terreno (`game-slice/animals/`).
