# @adatechnology/game-floorplan-commercial

Commercial content for [`@adatechnology/game-floorplan`](../game-floorplan): the market and the pharmacy templates, the shop item catalogue (gondolas, freezers, checkouts, display cases...), their slot libraries, the `commercial` style and palette, and the commercial and industrial zones of region `br`.
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

Zones in region `br`: `zc` (commercial / central, up to 24 floors and 80 m, mixed and multi-family allowed) and `zi` (industrial, 4 floors, 20 m, large lots). A shop placed in a houses-only zone such as `zr1` is reported as a `use` violation.

See [MIGRATION.md](MIGRATION.md) for the old-to-new tables.

## Português

Conteúdo comercial para o `@adatechnology/game-floorplan`: os modelos `market` (mercadinho) e `pharmacy` (farmácia), o catálogo de itens de loja, bibliotecas de slots, estilo e paleta `commercial` e as zonas comercial (`zc`) e industrial (`zi`) da região `br`. Usa as bibliotecas de garagem, quintal e banheiro do pacote residencial, que deve ser registrado antes.

```ts
commercial(engine, { region: 'br' })
engine.generate('market', { seed: 4, locale: 'pt-BR' })   // "Mercadinho"
```

`mercado` é `market` e `farmacia` é `pharmacy`. Uma loja em zona só de casas (ZR1) aparece como violação de `use`. Tabelas completas em [MIGRATION.md](MIGRATION.md).
