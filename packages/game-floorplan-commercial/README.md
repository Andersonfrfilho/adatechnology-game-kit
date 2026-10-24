# @adatechnology/game-floorplan-commercial

Commercial content for [`@adatechnology/game-floorplan`](../game-floorplan): the market and the pharmacy templates, the interior buildings of a city (supermarket, drugstore, gun shop, police station, emergency room, school, gas station, church, metalworks, farm), the shop item catalogue (gondolas, freezers, checkouts, display cases...), their slot libraries, the `commercial` and `farm` styles and palettes, and the commercial, industrial and agricultural zones of region `br`.
It reuses the garage, yard and bathroom libraries of the residential pack, so register that one first.

## Install

```sh
pnpm add @adatechnology/game-floorplan @adatechnology/game-floorplan-residential @adatechnology/game-floorplan-commercial
```

Browser without a bundler (the global is `GameFloorplanCommercial`):

```html
<script src="https://unpkg.com/@adatechnology/game-floorplan/dist/index.global.js"></script>
<script src="https://unpkg.com/@adatechnology/game-floorplan-residential/dist/index.global.js"></script>
<script src="https://unpkg.com/@adatechnology/game-floorplan-commercial/dist/index.global.js"></script>
<script>
  GameFloorplanResidential.register(GameFloorplan.engine)
  GameFloorplanCommercial.register(GameFloorplan.engine, { region: 'br' })
</script>
```

## Usage

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as residential } from '@adatechnology/game-floorplan-residential'
import { register as commercial, commercialTemplateIds } from '@adatechnology/game-floorplan-commercial'

residential(engine); commercial(engine, { region: 'br' })
const shop = engine.generate('market', { seed: 4, zone: 'zc' })
```

## Content

| Template | Use | Notes |
|---|---|---|
| `market` | `commercial` | checkouts, shop floor, stockroom, bathroom, office; steel front door, cargo gate, no garden; party walls left and right |
| `pharmacy` | `commercial` | counter, shop floor, consulting room; same shell rules |
| `supermarket` | `commercial` | 18 x 13 m: checkouts, shop floor with four gondola runs, bakery, butcher with cold chamber, stockroom, manager's office with safe |
| `drugstore` | `commercial` | 11 x 9 m: sales floor, dispensing counter, compounding room, grated store with vaccine fridge and safe |
| `gun_shop` | `commercial` | 20 x 9 m: long-gun rack, showcase, reload bench, trophies, armored vault, four-lane shooting range |
| `police_station` | `institutional` | 16 x 11 m: reception, chief's office, squad room, two cells, arsenal, locker room, evidence depot, patrol yard in front |
| `emergency_room` | `institutional` | 18 x 11 m: emergency floor (stretchers, crash cart, oxygen cylinders), wards A and B, ICU |
| `school` | `institutional` | 18 x 15 m: library, cafeteria, kitchen, locker corridor, classroom with 16 desks, sports court |
| `gas_station` | `commercial` | 22 x 7 m building (convenience store, outside restroom, utility room, oil-change bay) and a forecourt with three pump islands and four canopy columns |
| `church` | `institutional` | 12 x 20 m, 7 m ceiling: parish hall, nave with 14 pews, sanctuary with altar and cross, sacristy, bell tower in the lot |
| `metalworks` | `industrial` | 30 x 20 m, 8 m ceiling: presses, conveyor line, furnace, pallet racks, forklift, canteen, lockers, mezzanine office |
| `farm` | `agricultural` | 12 x 9 m farmhouse (style `farm`) with veranda posts, well, coop, corral, barn, silo, machine shed, tractors and hay bales in the lot |

Each interior building declares `place` and `construction`; `interiorFindsHints[templateId]` lists what each place can hold (the loot pins of the team's gallery scene) for the finds provider.

Zones in region `br`: `zc` (commercial / central, up to 24 floors and 80 m, institutional, mixed and multi-family allowed), `zi` (industrial, 4 floors, 20 m, large lots) and `za` (agricultural, large lots). A shop placed in a houses-only zone such as `zr1` is reported as a `use` violation.

See [MIGRATION.md](MIGRATION.md) for the old-to-new tables.

## Português

Conteúdo comercial para o `@adatechnology/game-floorplan`: os modelos `market` (mercadinho) e `pharmacy` (farmácia), o catálogo de itens de loja, bibliotecas de slots, estilo e paleta `commercial` e as zonas comercial (`zc`) e industrial (`zi`) da região `br`. Usa as bibliotecas de garagem, quintal e banheiro do pacote residencial, que deve ser registrado antes.

```ts
commercial(engine, { region: 'br' })
engine.generate('market', { seed: 4, locale: 'pt-BR' })   // "Mercadinho"
```

`mercado` é `market` e `farmacia` é `pharmacy`. Uma loja em zona só de casas (ZR1) aparece como violação de `use`. Tabelas completas em [MIGRATION.md](MIGRATION.md).
