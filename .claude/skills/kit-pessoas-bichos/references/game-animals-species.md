# @adatechnology/game-animals-species

Content pack for @adatechnology/game-animals: 13 species (cow, horse, pig, wild boar, capybara, jaguar, dog, cat, chicken, southern lapwing, vulture, lancehead, rat) with body specs, gaits, sound ranges and the outbreak rule as data, in en and pt-BR. A game that never reads the outbreak field gets plain animals.

API completa: `packages/game-animals-species/README.md`.

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
