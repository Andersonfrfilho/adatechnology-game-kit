# @adatechnology/game-vegetation-species

JSON content pack for [`@adatechnology/game-vegetation`](../game-vegetation): 71 species (trees, palms, shrubs, flowers, cacti, succulents, grasses, vines,
potted plants), en and pt-BR names and descriptions, and regional planting tables (`br`, `default`). Global in browsers: `GameVegetationSpecies`.

```ts
import { generate } from '@adatechnology/game-vegetation'
import { toSpec, getSpecies, byTag, name, regions, pickForContext } from '@adatechnology/game-vegetation-species'

const mesh = generate(toSpec('mandacaru'), { seed: 3, lod: 1 })
name('mandacaru', 'pt-BR') // 'Mandacaru'
const id = pickForContext(regions.br, 'front_yard', 42) // weighted, deterministic
```

API: `species`, `getSpecies(id)`, `listIds()`, `byTag(tag)`, `toSpec(idOrSpecies)` (hex strings become ints), `loadLocale(locale)` (falls back to en), `name`, `description`, `regions`, `pickForContext(region, context, seedOrRng)`.
Contexts: front_yard, backyard, sidewalk_tree, square, vacant_lot, indoor, semiarid.

## Em português

Pacote de conteúdo em JSON com 71 espécies, nomes e descrições em pt-BR e en, e tabelas de plantio por região (`br` e `default`).
