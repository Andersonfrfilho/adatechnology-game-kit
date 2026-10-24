# @adatechnology/game-floorplan-rural

Rural content for [`@adatechnology/game-floorplan`](../game-floorplan): an American wood frame house, a mountain A-frame chalet, a log cabin, a shack of scrap boards and a campsite with tents.
It brings the `rural` style (wire fence, board and log facades), the palette and decor profile, the slot libraries, the wood, cabin and camp items, and the en / pt-BR names.
The five plans are the ones of the team page (Visor de casas 3D): 375 recorded plans match list by list.

## Install

```sh
pnpm add @adatechnology/game-floorplan @adatechnology/game-floorplan-residential @adatechnology/game-floorplan-rural
```

Browser without a bundler (the global is `GameFloorplanRural`):

```html
<script src="https://unpkg.com/@adatechnology/game-floorplan/dist/index.global.js"></script>
<script src="https://unpkg.com/@adatechnology/game-floorplan-residential/dist/index.global.js"></script>
<script src="https://unpkg.com/@adatechnology/game-floorplan-rural/dist/index.global.js"></script>
<script>
  GameFloorplanResidential.register(GameFloorplan.engine)
  GameFloorplanRural.register(GameFloorplan.engine, { region: 'br' })
</script>
```

## Usage

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerRural } from '@adatechnology/game-floorplan-rural'

registerResidential(engine) // first: the rural libraries extend the residential living room and laundry, the palette extends `mid`
registerRural(engine)
const plan = engine.generate('log_cabin', { seed: 4, rooms: 2, power: 'offgrid' })
plan.config // { power: 'offgrid', solar: false, bathroom: 'outhouse', water: 'tank' }
```

## Templates

| Id | Floors | Options | `construction` | `place` |
|---|---|---|---|---|
| `wood_frame_house` | 1 or 2 | `floors`, `garage`, `fireplace`, `basement` (`none`, `crawl_space`, `basement`), `attic`, `bedrooms` | `wood_frame` | `house` |
| `a_frame_chalet` | ground floor and mezzanine (double-height living room) | `foundation` (`stilts`, `slab`) | `wood_frame` | `cabin` |
| `log_cabin` | 1 | `rooms`, `power` (`grid`, `offgrid`), `solar`, `bathroom` (`outhouse`, `indoor`), `water` (`tank`, `well`) | `log` | `cabin` |
| `shack` | 1 | `rooms`, `material` (`wood`, `zinc`, `mixed`), `floorSurface` (`dirt`, `concrete`), `bathroom` (`outside`, `indoor`) | `improvised` | `shack` |
| `campsite` | 1 (tents, no walls) | `tents` (1 to 4), `tentType` (`dome`, `tunnel`) | `canvas` | `camp` |

Every option not given is drawn from the seed, as on the page. Each template is tagged `region: 'br'`. `construction` names the system the structure pack registers.

`result.config` carries what the packs read from the plan: `power` (`grid`, `offgrid`, or `tap` for a tapped line), `solar`, and per template the foundation, fireplace, attic, bathroom and water source.
An off-grid plan gets kerosene lamps (`ceiling_oil_lamp`, `oil_lamp`) instead of ceiling lights.

## Locales

`src/locales/en.json` and `pt-BR.json` name templates, rooms, floors, tents and the six facade colours. See [MIGRATION.md](MIGRATION.md) for ids, options, library ids and item types.
