# Migration: `PlantasSDK` commercial content to `@adatechnology/game-floorplan-commercial`

Source: `sdk/plantas/plantas.js` (PlantasSDK, about v3) with its `teste.mjs`, `README.md` and `montar-visor.mjs`. The SDK was split into four packages:
the generic engine, a residential content pack, a commercial content pack and a post-apocalyptic genre pack.

Commercial content: the market and the pharmacy, their shop items, library ids, style and zones. API, options and result fields are in
[`game-floorplan/MIGRATION.md`](../game-floorplan/MIGRATION.md); the residential pieces they share (garage, yard, bathroom libraries) are in
[`game-floorplan-residential/MIGRATION.md`](../game-floorplan-residential/MIGRATION.md). Register the residential pack first.

## Behaviour

The generator logic is unchanged. For the same seed and options (after the id mapping below) the new packages produce the same positions,
rotations, sizes, colours, palette integers, state items and slots as the old SDK. This was checked with a throw-away script that ran both
generators over all templates, variants, states, seeds, sizes and styles and compared every number, boolean and colour: 0 differences.
Names and labels are strings and come from the locale files; the `pt-BR` locale reproduces the old Portuguese texts.
The only deliberate behaviour additions are opt-in: the `zone` option (urban zoning) and the `locale` option. Without them nothing changes.

## Template ids

| Old | New | Use |
|---|---|---|
| `mercado` | `market` | `commercial` |
| `farmacia` | `pharmacy` | `commercial` |

Both declare party walls on the left and right, so the side setback of a zone does not apply to them.

## Style

| Old | New |
|---|---|
| `comercial` | `commercial` |

The palette stream name `comercial` stays in `legacy-seeds.ts`.

## Room types
| Old | New |
|---|---|
| `loja` | `shop` |
| `balcao` | `counter` |
| `estoque` | `stockroom` |
| `escritorio` (consultório in the pharmacy) | `office` (room id `consulting_room`) |

Room ids: `caixas` is `checkouts`; names are in the locale (`Mercadinho`, `Caixas`, `Loja`, `Estoque`, `Consultório`...).

## Library ids

| Old | New |
|---|---|
| `loja_mercado` | `shop_market` |
| `balcao_mercado` | `counter_market` |
| `loja_farmacia` | `shop_pharmacy` |
| `balcao_farmacia` | `counter_pharmacy` |
| `loja` (alias) | `shop` (alias of `shop_market`) |
| `balcao` (alias) | `counter` (alias of `counter_market`) |

## Item types (commercial)

| Old type | New type | Old category | New category |
|---|---|---|---|
| `gondola` | `gondola_shelf` | `gondola` | `gondola_shelf` |
| `gondola_curta` | `gondola_shelf_short` | `gondola` | `gondola_shelf` |
| `freezer` | `freezer` | `freezer` | `freezer` |
| `refrig_exp` | `display_fridge` | `refrig_exp` | `display_fridge` |
| `geladeira_med` | `display_fridge_medium` | `refrig_exp` | `display_fridge` |
| `prat_parede` | `wall_shelving` | `prat_parede` | `wall_shelving` |
| `balcao_caixa` | `checkout_counter` | `balcao_caixa` | `checkout_counter` |
| `registradora` | `cash_register` | `registradora` | `cash_register` |
| `cestas` | `baskets` | `cestas` | `baskets` |
| `carrinho` | `shopping_cart` | `carrinho` | `shopping_cart` |
| `hortifruti` | `produce_stand` | `hortifruti` | `produce_stand` |
| `frutas` | `fruit_crate` | `frutas` | `fruit_crate` |
| `display` | `display_stand` | `display` | `display_stand` |
| `estante_metal` | `metal_shelf` | `estante_metal` | `metal_shelf` |
| `palete` | `pallet` | `palete` | `pallet` |
| `caixas` | `boxes` | `caixas` | `boxes` |
| `mesa_conf` | `meeting_table` | `mesa_conf` | `meeting_table` |
| `balcao_farm` | `pharmacy_counter` | `balcao_farm` | `pharmacy_counter` |
| `vitrine` | `display_case` | `vitrine` | `display_case` |
| `expositor` | `display_rack` | `expositor` | `display_rack` |
| `espera` | `waiting_bench` | `espera` | `waiting_bench` |
| `balanca` | `scale` | `balanca` | `scale` |
| `cacamba` | `dumpster` | `cacamba` | `dumpster` |

## Item categories (commercial)

| Old category | New category |
|---|---|
| `balanca` | `scale` |
| `balcao_caixa` | `checkout_counter` |
| `balcao_farm` | `pharmacy_counter` |
| `cacamba` | `dumpster` |
| `caixas` | `boxes` |
| `carrinho` | `shopping_cart` |
| `cestas` | `baskets` |
| `display` | `display_stand` |
| `espera` | `waiting_bench` |
| `estante_metal` | `metal_shelf` |
| `expositor` | `display_rack` |
| `freezer` | `freezer` |
| `frutas` | `fruit_crate` |
| `gondola` | `gondola_shelf` |
| `hortifruti` | `produce_stand` |
| `mesa_conf` | `meeting_table` |
| `palete` | `pallet` |
| `prat_parede` | `wall_shelving` |
| `refrig_exp` | `display_fridge` |
| `registradora` | `cash_register` |
| `vitrine` | `display_case` |

## Zones

| Zone id | Intent | Uses | Floors | Max height |
|---|---|---|---|---|
| `zc` | Commercial / central | `commercial`, `mixed`, `residential_multi` | 24 | 80 m |
| `zi` | Industrial | `industrial`, `commercial` | 4 | 20 m |

Open values with `engine.getZone('zc')`. Labels are in the `zones` locale namespace.
