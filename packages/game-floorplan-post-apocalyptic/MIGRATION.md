# Migration: `PlantasSDK` house states to `@adatechnology/game-floorplan-post-apocalyptic`

Source: `sdk/plantas/plantas.js` (PlantasSDK, about v3) with its `teste.mjs`, `README.md` and `montar-visor.mjs`. The SDK was split into four packages:
the generic engine, a residential content pack, a commercial content pack and a post-apocalyptic genre pack.

The genre pack holds everything specific to the zombie setting: the fortified and abandoned states, their items, flags and the default seed distribution.
The engine itself only knows `normal`. API, options and result fields are in [`game-floorplan/MIGRATION.md`](../game-floorplan/MIGRATION.md).

## Behaviour

The generator logic is unchanged. For the same seed and options (after the id mapping below) the new packages produce the same positions,
rotations, sizes, colours, palette integers, state items and slots as the old SDK. This was checked with a throw-away script that ran both
generators over all templates, variants, states, seeds, sizes and styles and compared every number, boolean and colour: 0 differences.
Names and labels are strings and come from the locale files; the `pt-BR` locale reproduces the old Portuguese texts.
The only deliberate behaviour additions are opt-in: the `zone` option (urban zoning) and the `locale` option. Without them nothing changes.

## States

| Old | New |
|---|---|
| `protegida` | `fortified` |
| `abandonada` | `abandoned` |

`registerState(name, plugin)` is the generic hook: a plugin has `apply(context)` (returns the state items), an optional `seedKey` (legacy RNG stream) and an optional `adjustPalette(roles)` (the abandoned state desaturates and darkens the palette before the contrast rules run).
With `register(engine)`, `generate` without `state` draws one from the seed with the default weights `{ fortified: 0.35, abandoned: 0.45, normal: 0.2 }`. Change it with `register(engine, { distribution })`; `null` makes `normal` the default.

## State item types (`estadoItens`, now `stateItems`)

| Old type | New type | New category |
|---|---|---|
| `tabuas` | `window_boards` | `window_boards` |
| `barricada` | `barricade` | `barricade` |
| `sacos_areia` | `sandbags` | `sandbags` |
| `arame_farpado` | `barbed_wire` | `barbed_wire` |
| `concertina` | `razor_wire` | `razor_wire` |
| `caixas_agua` / `enlatados` / `galao` | `water_bottle_crates` / `canned_food` / `water_jug` | `stockroom` |
| `colchao_chao` | `floor_mattress` | `floor_mattress` |
| `lanterna` / `velas` | `lantern` / `candles` | `lantern` |
| `portas_abertas` | `open_doors` | `open_doors` |
| `gavetas_reviradas` | `ransacked_drawers` | `ransacked_drawers` |
| `malas_abertas` | `open_suitcases` | `open_suitcases` |
| `roupas_chao` | `clothes_on_floor` | `clothes_on_floor` |
| `cadeira_caida` | `fallen_chair` | `fallen_chair` |
| `manchas_sangue` | `blood_stains` | `blood_stains` |
| `portao_aberto` | `open_gates` | `open_gates` |

State item fields: `janela` is `window`, `porta` is `door`, `item` is `item`, `tipoItem` is `itemType`, `portao` is `gate`, `perimetro` is `perimeter`, `topoAnterior` is `previousTop`, `portas` (open_doors) is `doors`, `itens` (ransacked_drawers) is `items`, `portoes` (open_gates) is `gates`, `estadoItem` is `stateItem`, `estado` is `state`.
Ids: `estado.<n>.<tipo>` is `state.<n>.<type>`.

## Flags on plan data

| Old | New | Where |
|---|---|---|
| `bloqueada` | `blocked` | doors (barricaded) |
| `aberta` | `open` | doors (left open) |
| `tabuas` | `boards` | windows (boarded) |
| `aberto` | `open` | gates |
| `barricada` | `barricade` | items (moved to block a door) |
| `reviradas` | `ransacked` | items (drawers pulled out) |
| `porta_aberta` | `doorOpen` | items (car with the door open) |
| `movido` | `moved` | items (`{ from, ry }` before the barricade) |
| `criado` | `created` | items created by the state |

## Item types of this pack

| Old type | New type | Old category | New category |
|---|---|---|---|
| `tabuas` | `window_boards` | `tabuas` | `window_boards` |
| `sacos_areia` | `sandbags` | `sacos_areia` | `sandbags` |
| `arame_farpado` | `barbed_wire` | `arame_farpado` | `barbed_wire` |
| `concertina` | `razor_wire` | `concertina` | `razor_wire` |
| `caixas_agua` | `water_bottle_crates` | `estoque` | `stockroom` |
| `enlatados` | `canned_food` | `estoque` | `stockroom` |
| `galao` | `water_jug` | `estoque` | `stockroom` |
| `colchao_chao` | `floor_mattress` | `colchao_chao` | `floor_mattress` |
| `lanterna` | `lantern` | `lanterna` | `lantern` |
| `velas` | `candles` | `lanterna` | `lantern` |
| `malas_abertas` | `open_suitcases` | `malas_abertas` | `open_suitcases` |
| `roupas_chao` | `clothes_on_floor` | `roupas_chao` | `clothes_on_floor` |
| `cadeira_caida` | `fallen_chair` | `cadeira_caida` | `fallen_chair` |
| `manchas_sangue` | `blood_stains` | `manchas_sangue` | `blood_stains` |

## Item categories of this pack

| Old category | New category |
|---|---|
| `arame_farpado` | `barbed_wire` |
| `cadeira_caida` | `fallen_chair` |
| `colchao_chao` | `floor_mattress` |
| `concertina` | `razor_wire` |
| `estoque` | `stockroom` |
| `lanterna` | `lantern` |
| `malas_abertas` | `open_suitcases` |
| `manchas_sangue` | `blood_stains` |
| `roupas_chao` | `clothes_on_floor` |
| `sacos_areia` | `sandbags` |
| `tabuas` | `window_boards` |

## Wall tops

`arame_farpado` is `barbed_wire` (height 0.3 m), registered with `registerWallTop('barbed_wire', 0.3)`. `concertina` is `razor_wire` and lives in the residential and commercial packs.

## Seeds

The state draw and the two state generators keep their legacy streams: `estado` (distribution), `estado:protegida`, `estado:abandonada`, and cars use `estado.<n>.carro` for their colour. They are in `src/legacy-seeds.ts`; do not translate them.
