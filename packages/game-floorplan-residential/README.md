# @adatechnology/game-floorplan-residential

Residential content for [`@adatechnology/game-floorplan`](../game-floorplan): ten house and apartment templates, the furniture catalogue, slot libraries, the decor pass
(ceiling lights, air conditioners, pictures, plants, curtains), per-style facade and colour tables, and region data (`br`, with a Brazilian zoning table).
Everything is data-first: templates are plain objects, so adding or tuning one does not touch the engine.

## Install

```sh
pnpm add @adatechnology/game-floorplan @adatechnology/game-floorplan-residential
```

Browser without a bundler (the global is `GameFloorplanResidential`):

```html
<script src="https://unpkg.com/@adatechnology/game-floorplan/dist/index.global.js"></script>
<script src="https://unpkg.com/@adatechnology/game-floorplan-residential/dist/index.global.js"></script>
<script>GameFloorplanResidential.register(GameFloorplan.engine, { region: 'br' })</script>
```

## Usage

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register, residentialTemplateIds } from '@adatechnology/game-floorplan-residential'

register(engine, { region: 'br' })   // region defaults to 'br'; { decor: false } skips the decor pass
const plan = engine.generate('mid_modern_townhouse', { seed: 12, floors: 3, zone: 'zr_ap' })
```

## Templates

| Id | Style | Use | Floors |
|---|---|---|---|
| `single_storey_a` | budget | residential_single | 1 |
| `townhouse` | budget | residential_single | 2 |
| `apartment_basic` | budget | residential_multi | one unit, 1 per floor |
| `budget_slab_house` | budget | residential_single | 1 to 3 (`floors`, or `randomFloors`; side stair; party wall right) |
| `budget_semi_detached` | budget | residential_single | 1 (party wall left) |
| `mid_modern_single_storey` | mid | residential_single | 1 |
| `mid_modern_townhouse` | mid | residential_single | 2 to 3 |
| `high_end_contemporary` | high | residential_single | 2 to 3 |
| `mansion` | high | residential_single | 1 to 3 (optional elevator) |
| `apartment_modern` | mid / high (`tier`) | residential_multi | one unit of a 3 to 20 floor building |

### Residential tower

`residential_tower` (`residentialTowerTemplate`, `RESIDENTIAL_TOWER_DEFAULTS`) is the plan of an apartment skyscraper built from the layout of `game-floorplan-structure` (`skyscraperLayout`): 30 storeys by default (`floors`, 20 to 60, the default maximum `SKYSCRAPER_MAX_STOREYS`), 2.8 m clear height, 9 m bays, a punched masonry facade, a plant floor every 25 storeys and a damper above 150 m. Every storey has the stairs, the elevators and the lobby in the core and the corridors around it; the ground floor has the entrance lobby (3 m door), the concierge and the bicycle room; a typical storey has six apartments (living, bedroom, kitchen, hall, bathroom) and a shared laundry and a storage room at the ends. `buildResidentialTower(options)` is the destructible tower of the same layout (core, piles, facade, wind). The numbers are options: `options.tower` takes any `SkyscraperOptions`, and `residentialTowerTemplate(preset, plan)` builds a template with other numbers to register. The zone `zt` (towers, 60 storeys and 240 m) is in the `br` region.

## Regions

`register(engine, { region })` takes `'br'` or a `ResidentialRegion` object. A region carries the house paint swatches, the facade colour names and the zone table, all in `src/regions/<id>/`, so a `regions/us` can be added without changing templates. Region texts live in the locale files.

Zones in `br`: `zr1` (low-density, houses only, 2 floors, 9 m), `zr_ap` (gated high-end, houses up to 3 floors and 12 m, larger setbacks and lot), `zr2` (medium density, houses and small apartment buildings up to 4 floors), `zr3_zm` (mixed use, up to 12 floors). Commercial and industrial zones come with the commercial pack. Zone names are in the `zones` locale namespace (`ZR-1 – Residencial de baixa densidade` in `pt-BR`).

Each template declares `use`, `floorRange` and `partyWalls`. The tests assert that every template generates a valid plan inside at least one zone and that a plan breaking a zone is reported.

## Locales

`src/locales/en.json` and `pt-BR.json` hold room, floor, template, style, facade colour and zone names. `locale: 'pt-BR'` reproduces the Portuguese names of the old SDK exactly.

See [MIGRATION.md](MIGRATION.md) for template ids, room types, library ids, item types, categories, styles and facade values.

## Português

Conteúdo residencial para o `@adatechnology/game-floorplan`: dez modelos de casa e apartamento, catálogo de móveis, bibliotecas de slots, regras de decoração (luzes, ar-condicionado, quadros, plantas, cortinas), tabelas de fachada e cor por estilo, e dados de região (`br`).

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register } from '@adatechnology/game-floorplan-residential'

register(engine, { region: 'br' })
engine.generate('townhouse', { seed: 3, locale: 'pt-BR' })   // "Sobrado (2 andares)"
```

- Ids antigos: `casaA` é `single_storey_a`, `sobrado` é `townhouse`, `apartamento` é `apartment_basic`, `popular_laje` é `budget_slab_house`, `popular_geminada` é `budget_semi_detached`, `media_terrea_moderna` é `mid_modern_single_storey`, `sobrado_medio_moderno` é `mid_modern_townhouse`, `alto_padrao_contemporanea` é `high_end_contemporary`, `mansao` é `mansion`, `apartamento_novo` é `apartment_modern`.
- **Zoneamento (região `br`):** ZR1 (baixa densidade, só casas, 2 pavimentos, ~9 m), ZR-AP (alto padrão, casas até 3 pavimentos, ~12 m, recuos e lote mínimo maiores), ZR2 (média densidade, casas e prédios pequenos até 4 pavimentos), ZR3/ZM (uso misto, até 12 pavimentos). A região é um objeto de dados, então `regions/us` pode ser adicionada sem mexer nos modelos.
- Tabela completa de nomes antigos e novos em [MIGRATION.md](MIGRATION.md).

### Configurar pelo jogo (torre residencial)

`floors` é o número de andares (vence `tower.storeys`) e `tower` aceita qualquer `SkyscraperOptions` (andares, `height`, `bay`, `facade`, `mechanicalEvery`, `damperAbove`, `piles`, `wind`, `range`). O máximo padrão é 60; o jogo o sobe com `range` (e com uma zona própria no lugar de `zt`, que limita a 60).

```ts
const plan = engine.generate('residential_tower', {
  seed: 4, floors: 45,
  tower: { height: 2.9, bay: [8, 8], facade: 'punched', mechanicalEvery: 15, damperAbove: false, range: [20, 70] },
})
const structure = buildResidentialTower({ storeys: 45, piles: { diameter: 1.2 } })
```
