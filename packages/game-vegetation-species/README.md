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
`scatterRulesFor(region, context, seed, options?)` turns a context into scatter rules: it draws species from the regional table (60 draws by default, the same seed draws the same), leaves out the vines and, with `noLarge`, the big trees, and splits the picks into trees, hedges, the middle layer and the ground cover, each with its density, spacing and scale. It returns `{ rules, picks }`; give the rules to `scatter` of `@adatechnology/game-vegetation`. Every number is an option (`n`, `draws`, `skipArchetypes`, `maxCount` by group, `treeDensity`, `groupRules`, `classify`).

```ts
const { rules } = scatterRulesFor(regions.br, 'front_yard', 'quintal-1', { n: 12, noLarge: true, maxCount: { trees: 1, hedges: 10, mid: 14, ground: 40 } })
const placements = scatter({ rect: { x: 0.5, z: 0.5, w: 11, d: 5.6 } }, rules, { seed: 'quintal-1:f:0' })
```

Contexts: front_yard, backyard, sidewalk_tree, square, vacant_lot, indoor, semiarid.

## Em português

Pacote de conteúdo em JSON com 71 espécies, nomes e descrições em pt-BR e en, e tabelas de plantio por região (`br` e `default`).
