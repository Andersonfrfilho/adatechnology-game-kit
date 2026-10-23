# @adatechnology/game-floorplan

Seeded procedural floor plans: house shells, lots, recorded furniture slots, seeded fill, a colour-harmony palette, state plugins and urban zoning.
The engine is generic. Content (templates, furniture, regional data, house states) comes from the packs below, so a game ships only what it uses.
Zero runtime dependencies; works in the browser and in Node. The same seed and options always give the same plan.

| Package | Global | Adds |
|---|---|---|
| `@adatechnology/game-floorplan` (this one) | `GameFloorplan` | engine, zoning, locales, palette algorithm, 2D viewer |
| [`@adatechnology/game-floorplan-residential`](../game-floorplan-residential) | `GameFloorplanResidential` | 10 house and apartment templates, furniture, decor, region `br` |
| [`@adatechnology/game-floorplan-commercial`](../game-floorplan-commercial) | `GameFloorplanCommercial` | market and pharmacy |
| [`@adatechnology/game-floorplan-post-apocalyptic`](../game-floorplan-post-apocalyptic) | `GameFloorplanPostApocalyptic` | `fortified` and `abandoned` house states |

## Install

```sh
pnpm add @adatechnology/game-floorplan @adatechnology/game-floorplan-residential
```

Browser without a bundler:

```html
<script src="https://unpkg.com/@adatechnology/game-floorplan/dist/index.global.js"></script>
<script src="https://unpkg.com/@adatechnology/game-floorplan-residential/dist/index.global.js"></script>
<script>
  GameFloorplanResidential.register(GameFloorplan.engine)
  const plan = GameFloorplan.engine.generate('townhouse', { seed: 3 })
</script>
```

## Usage

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as residential } from '@adatechnology/game-floorplan-residential'
import { register as postApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'

residential(engine, { region: 'br' })
postApocalyptic(engine)                      // optional: adds the fortified / abandoned states

engine.listTemplates()                       // [{ id, name, use, style, limits, defaults, floors, options, ... }]
const plan = engine.generate('townhouse', { seed: 7, state: 'fortified', locale: 'pt-BR' })
plan.rooms; plan.doors; plan.windows; plan.items; plan.stateItems; plan.lot; plan.colors
engine.validate(plan)                        // string[] of problems, empty when the plan is sound
engine.slots('townhouse', { seed: 7 })       // the recorded slots, valid or not, with the reason when not
engine.palette({ seed: 7, style: 'mid' })    // the colour palette alone
```

### Options

| Option | Meaning |
|---|---|
| `seed` | number or string |
| `w`, `d` | lot-side width and depth in metres, inside `limitsOf(id).limits` |
| `style` | `budget`, `mid`, `high` (alias `luxury`), `commercial` |
| `state` | `normal` or a state registered by a pack; the default is drawn from the seed |
| `tier` | `mid` or `high` (`apartment_modern`) |
| `floors`, `elevator` | `mansion`, `mid_modern_townhouse`, `high_end_contemporary` |
| `floor` | storey of an apartment unit |
| `locale` | `en` (default) or `pt-BR`: `name` fields and messages |
| `zone` | zone id or definition: clamps the plan and reports adjustments |

### Result

`template, name, use, seed, style, state, w, d, floors, rooms, walls, doors, windows, openPairs, facade, lot, items, stateItems, colors, building, missing, partyWalls`
and, with a zone, `zoning`. Every localizable string has a key (`label`) and a localized `name`.

## How it fits together

- **Content is registered.** `registerItem(s)`, `registerLibrary` (slot libraries), `registerTemplate`, `registerStyle`, `registerPaletteStyle`, `registerRoomColors`, `registerDecorProfile`, `registerPass` (post-process, e.g. decor), `registerGroundOverlay`, `registerWallTop`, `registerLocale`. A pack is just a `register(engine, options)` function; packs only import the engine's types, so IIFE bundles share one registry.
- **States are plugins.** The engine knows `normal` only. `registerState(name, { apply(ctx), adjustPalette?, seedKey? })` adds a state; `setStateDistribution(weights)` sets how the default state is drawn from the seed.
- **Regions are data.** Residential and commercial take `{ region: 'br' }` (default). A region holds paint swatches, facade colour names and the zoning table; add `regions/us` without touching templates.
- **Everything visible is a key.** Names, labels, slot reasons, validation messages and viewer text live in locale tables (`en`, `pt-BR`); `registerLocale('xx', table)` adds more.

### Urban zoning

```ts
import { defineZone, checkLot } from '@adatechnology/game-floorplan'

defineZone({ id: 'my_zone', allowedUses: ['residential_single'], maxFloors: 2, maxHeight: 9,
  setbacks: { front: 5, side: 1.5, back: 3 }, maxCoverage: 0.5, maxFar: 1, minLot: 250, minFrontage: 10, permeableMin: 0.25 })

const plan = engine.generate('mansion', { seed: 1, zone: 'my_zone' })
plan.zoning.adjustments   // [{ field: 'floors', from: 3, to: 2, reason: 'max_floors' }, ...]
plan.zoning.violations    // what clamping could not fix: use, minimum lot, frontage, coverage, floor area ratio
checkLot('my_zone', plan.lot, plan)
```

Very tall buildings do not belong in house neighbourhoods, so each template declares its `use` and floor range and each zone says what it allows.
`generate` clamps floors and setbacks to the zone and turns paved yards into lawn to reach the permeable minimum; `validate` reports remaining violations.
Uses are plain strings (`residential_single`, `residential_multi`, `commercial`, `mixed`, `industrial`, ...). The Brazilian zone table (ZR1, ZR-AP, ZR2, ZR3/ZM, ZC, ZI) ships in the content packs' `regions/br`.

## 2D viewer

`viewer/` holds a plain HTML/Canvas viewer that bundles the four IIFE builds into one offline file. Template, seed, state, style, zone, options, floor and language (English or Português) are selectable; hovering an item shows its id, and the side panel shows validation and the zoning report.

```sh
pnpm build
pnpm --filter @adatechnology/game-floorplan viewer:build   # writes packages/game-floorplan/viewer/dist/floorplan-viewer.html
```

## Tests

`pnpm --filter @adatechnology/game-floorplan-post-apocalyptic test` runs the property suite ported from the old SDK on all four packs (25 seeds per template, state and variant). `FULL=1` runs the original 200 seeds.

See [MIGRATION.md](MIGRATION.md) for the old-to-new name tables.

## Português

Gerador procedural de plantas de casas e lotes, com semente: casca da casa, lote, slots de móveis, preenchimento por semente, paleta de cores harmônica, estados da casa (plugins) e zoneamento urbano.
O motor é genérico; o conteúdo vem dos pacotes de conteúdo (residencial, comercial) e do pacote de gênero (pós-apocalíptico). A mesma semente e as mesmas opções dão sempre a mesma planta.

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as residencial } from '@adatechnology/game-floorplan-residential'

residencial(engine, { region: 'br' })
const planta = engine.generate('townhouse', { seed: 7, locale: 'pt-BR' })   // nomes em português
```

- Opções antigas: `semente` é `seed`, `estado` é `state`, `estilo` é `style`, `padrao` é `tier`, `andares` é `floors`, `elevador` é `elevator`, `andar` é `floor`. A tabela completa está em [MIGRATION.md](MIGRATION.md).
- **Zoneamento:** `defineZone` define uma zona (usos permitidos, andares, altura, recuos, taxa de ocupação, coeficiente de aproveitamento, lote mínimo, testada, permeabilidade). `generate(..., { zone })` limita andares e recuos à zona e informa os ajustes; `checkLot` aponta as violações. Edifícios muito altos não entram em bairro de casas.
- **Visualizador 2D:** `pnpm build` e depois `pnpm --filter @adatechnology/game-floorplan viewer:build` geram um HTML único e offline, com seletor de idioma (English e Português).
- **Testes:** a suíte de propriedades do SDK antigo foi portada para o vitest; `FULL=1` roda as 200 sementes originais, o padrão usa 25.
