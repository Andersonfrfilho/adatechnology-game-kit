# Migration: `Moveis3DSDK` (moveis3d.js) to `@adatechnology/game-props3d`

Source: `sdk/moveis3d/moveis3d.js` and its README. Every old name maps to exactly one new name. The builders are a mechanical port: for all 57 builders,
four different items each (defaults; a fully loaded item with palette, seed, lamps on and variants; window boards `x`; pergola `dark` with a polygon), the
sequence of primitives (positions, sizes, colors, rotations, materials, uv cells) is identical to the original's, and so are the drawing calls that fill the
three atlas canvases (6315 primitives compared one by one).

## Loading

| Old | New |
|---|---|
| global `Moveis3DSDK` (concatenated `<script>`) | ESM `import { create } from '@adatechnology/game-props3d'`, or IIFE `dist/index.global.js` exposing `GameProps3d` |
| `Moveis3DSDK.criar(THREE, opts)` | `GameProps3d.create(three, options)` (the first argument is still accepted but never used, so `undefined` is fine) |
| `Moveis3DSDK.tipos` | `GameProps3d.TYPE_DEFS` (ids and sizes only), `props.types` (with localized names) or `GameProps3d.listTypes(locale)` |
| `Moveis3DSDK.materiais` | `GameProps3d.MATERIALS` |

## Options (`criar` second argument)

| Old | New |
|---|---|
| `emitir(evento, dados)` | `emit(event, data)` |
| `document` | `document` |
| (none) | `locale` (`'en'` default, `'pt-BR'`) |

## Returned object

| Old | New |
|---|---|
| `MV.builders[tipo](M, api)` | `props.builders[type](M, api)` |
| `MV.tipos` | `props.types` |
| `MV.nomes` | `props.names` |
| `MV.atlas(nome)` | `props.atlas(name)` |
| `MV.cobrir(api, M, tipoDePiso, opcoes)` | `props.cover(api, M, floorKind, options)` |
| `MV.materiais` | `props.materials` |

## The api the host implements

| Old | New |
|---|---|
| `api.caixa(M, mat, x, y, z, w, h, d, cor, ry, rx, rz)` | `api.box(M, material, x, y, z, w, h, d, color, ry, rx, rz)` |
| `api.cil(M, mat, x, y, z, r, h, cor, rx, rz, seg)` | `api.cylinder(M, material, x, y, z, r, h, color, rx, rz, shape)` |
| `api.folha(M, x, y, z, w, h, cor, ry, rx)` | `api.leaf(M, x, y, z, w, h, color, ry, rx)` |
| `api.plano(M, mat, x, y, z, w, h, cor, ry, rx, rz, uv)` | `api.plane(M, material, x, y, z, w, h, color, ry, rx, rz, uv)` |
| `api.luz(M, x, y, z, cor, alc, tipo)` | `api.light(M, x, y, z, color, range, kind)` |
| `emitir('luz', { M, x, y, z, cor, alc, tipo })` (when the api has no `luz`) | `emit('light', { M, x, y, z, color, range, kind })` |

Argument order and meaning are unchanged. `api.light` stays optional.

### Cylinder shapes (`seg`, now `shape`)

| Old | New |
|---|---|
| `'cil'` (default, 12 sides) | `'cyl'` |
| `'cil6'` | `'cyl6'` |
| `'cone'` | `'cone'` |
| `'esf'` (ellipsoid) | `'sphere'` |

### Materials (`mat`, now `material`; data ids)

| Old | New |
|---|---|
| `liso` | `plain` |
| `metal` | `metal` |
| `madeira` | `wood` |
| `vidro` | `glass` |
| `tecido` | `fabric` |
| `planta` | `plant` |
| `agua` | `water` |
| `emissivo` | `emissive` |
| `atlas-quadro` | `atlas_picture` |
| `atlas-piso` | `atlas_floor` |

## Item fields (`M`)

| Old | New | Notes |
|---|---|---|
| `x`, `z`, `ry` | `x`, `z`, `ry` | read by the host's api |
| `w`, `d`, `h` | `w`, `d`, `h` | |
| `y` | `y` | mounting height |
| `teto` | `ceiling` | ceiling height, default 2.9 |
| `cor` | `color` | |
| `cores` | `palette` | |
| `seed` | `seed` | |
| `var` | `variant` | |
| `poly` | `poly` | |
| `ligado` | `on` | lamp on (ceiling light, track spot, chandelier) |
| `luz` | `light` | also emit a real light (pendant, chandelier) |
| `acesa` | `lit` | lantern, candles; default true |
| `aberta` | `open` | curtain |
| `recolhida` | `retracted` | blinds |
| `arte` | `art` | picture art index |
| `fruta` | `fruit` | |
| `ang` | `angle` | door opening angle |
| `arrasto` | `drag` | blood drag marks |

### Variant values (`var`, now `variant`)

| Item | Old | New |
|---|---|---|
| `persiana` / `blinds` | `'madeira'` | `'wood'` |
| `pergolado` / `pergola` | `'escuro'` | `'dark'` |
| `tabuas_janela` / `window_boards` | `'x'` | `'x'` |

### Palette roles (`cores`, now `palette`; data ids)

| Old | New |
|---|---|
| `madeira` | `wood` |
| `tecido_principal` | `fabric_main` |
| `tecido_acento` | `fabric_accent` |
| `metal` | `metal` |
| `quadro_acento` | `picture_accent` |
| `parede_sala` | `wall_living` |
| `parede_cozinha` | `wall_kitchen` |
| `parede_quarto` | `wall_bedroom` |
| `ext_piso` | `exterior_floor` |
| `planta` | `plant` |

## Type metadata (`tipos[]`)

| Old | New |
|---|---|
| `id` | `id` |
| `nome` | `name` (from the locale table) |
| `interno` | `interior` |
| `w`, `d`, `h`, `y` | `w`, `d`, `h`, `y` |
| `fisico` | `solid` |
| `grupo` | `group` |

Group ids (data ids):

| Old | New |
|---|---|
| `teto` | `ceiling` |
| `parede` | `wall` |
| `plantas` | `plants` |
| `moveis` | `furniture` |
| `chao` | `floor` |
| `quintal` | `yard` |
| `estado` | `house_state` |

## Type ids (`tipo`, every builder)

| Old `tipo` | New type id | Group (old -> new) | Name `pt-BR` (unchanged) | Name `en` |
|---|---|---|---|---|
| `plafon` | `ceiling_light` | `teto` -> `ceiling` | Plafon | Ceiling light |
| `pendente` | `pendant` | `teto` -> `ceiling` | Pendente | Pendant lamp |
| `spot_trilho` | `track_spot` | `teto` -> `ceiling` | Spot de trilho | Track spot |
| `lustre` | `chandelier` | `teto` -> `ceiling` | Lustre | Chandelier |
| `split_interno` | `wall_ac` | `parede` -> `wall` | Split interno | Indoor AC unit (split) |
| `quadro_peq` | `picture_small` | `parede` -> `wall` | Quadro pequeno | Small picture |
| `quadro_grande` | `picture_large` | `parede` -> `wall` | Quadro grande | Large picture |
| `espelho` | `mirror` | `parede` -> `wall` | Espelho | Mirror |
| `cortina` | `curtain` | `parede` -> `wall` | Cortina | Curtain |
| `persiana` | `blinds` | `parede` -> `wall` | Persiana | Blinds |
| `tv_plana` | `flat_tv` | `parede` -> `wall` | TV plana | Flat TV |
| `vaso_chao` | `floor_plant` | `plantas` -> `plants` | Vaso de chão | Floor plant |
| `vaso_mesa` | `table_plant` | `plantas` -> `plants` | Vaso de mesa | Table plant |
| `pendente_planta` | `hanging_plant` | `plantas` -> `plants` | Planta pendente | Hanging plant |
| `rack_tv_plana` | `tv_stand` | `moveis` -> `furniture` | Rack com TV plana | TV stand with flat TV |
| `bancada_americana` | `breakfast_bar` | `moveis` -> `furniture` | Bancada americana | Breakfast bar |
| `sofa_l` | `sofa_l` | `moveis` -> `furniture` | Sofá em L | L-shaped sofa |
| `cama_casal_moderna` | `double_bed_modern` | `moveis` -> `furniture` | Cama de casal moderna | Modern double bed |
| `home_office` | `home_office` | `moveis` -> `furniture` | Home office | Home office |
| `closet` | `closet` | `moveis` -> `furniture` | Closet | Closet |
| `lavabo` | `vanity` | `moveis` -> `furniture` | Lavabo | Bathroom vanity |
| `condensadora` | `ac_condenser` | `quintal` -> `yard` | Condensadora | AC condenser |
| `gramado` | `lawn` | `chao` -> `floor` | Gramado | Lawn |
| `piso_ceramico` | `tile_floor` | `chao` -> `floor` | Piso cerâmico | Ceramic tile floor |
| `cimentado` | `concrete` | `chao` -> `floor` | Cimentado | Concrete slab |
| `deck_madeira` | `deck_floor` | `chao` -> `floor` | Deck (piso) | Deck (flooring) |
| `terra` | `dirt` | `chao` -> `floor` | Terra batida | Packed dirt |
| `bancada_gourmet` | `gourmet_counter` | `quintal` -> `yard` | Bancada gourmet | Gourmet counter |
| `sauna_cabine` | `sauna` | `quintal` -> `yard` | Sauna | Sauna |
| `ofuro` | `soaking_tub` | `quintal` -> `yard` | Ofurô | Soaking tub |
| `piscina` | `pool` | `quintal` -> `yard` | Piscina | Pool |
| `deck` | `deck` | `quintal` -> `yard` | Deck elevado | Raised deck |
| `espreguicadeira` | `sun_lounger` | `quintal` -> `yard` | Espreguiçadeira | Sun lounger |
| `canteiro_horta` | `garden_bed` | `quintal` -> `yard` | Canteiro de horta | Vegetable garden bed |
| `arvore_frutifera` | `fruit_tree` | `quintal` -> `yard` | Árvore frutífera | Fruit tree |
| `palmeira` | `palm_tree` | `quintal` -> `yard` | Palmeira | Palm tree |
| `pergolado` | `pergola` | `quintal` -> `yard` | Pergolado | Pergola |
| `escorregador` | `slide` | `quintal` -> `yard` | Escorregador | Slide |
| `balanco` | `swing` | `quintal` -> `yard` | Balanço | Swing |
| `churrasqueira_simples` | `bbq_simple` | `quintal` -> `yard` | Churrasqueira simples | Simple barbecue |
| `carro_garagem` | `garage_car` | `quintal` -> `yard` | Carro | Car |
| `tabuas_janela` | `window_boards` | `estado` -> `house_state` | Tábuas na janela | Boards on the window |
| `barricada` | `barricade` | `estado` -> `house_state` | Barricada | Barricade |
| `sacos_areia` | `sandbags` | `estado` -> `house_state` | Sacos de areia | Sandbags |
| `arame_farpado` | `barbed_wire` | `estado` -> `house_state` | Arame farpado | Barbed wire |
| `concertina` | `razor_wire` | `estado` -> `house_state` | Concertina | Razor wire |
| `caixas_agua` | `water_bottle_crates` | `estado` -> `house_state` | Caixas de água mineral | Mineral water crates |
| `enlatados` | `canned_food` | `estado` -> `house_state` | Enlatados | Canned food |
| `galao` | `water_jug` | `estado` -> `house_state` | Galão de água | Water jug |
| `colchao_chao` | `floor_mattress` | `estado` -> `house_state` | Colchão no chão | Mattress on the floor |
| `lanterna` | `lantern` | `estado` -> `house_state` | Lanterna | Lantern |
| `velas` | `candles` | `estado` -> `house_state` | Velas | Candles |
| `malas_abertas` | `open_suitcases` | `estado` -> `house_state` | Malas abertas | Open suitcases |
| `roupas_chao` | `clothes_on_floor` | `estado` -> `house_state` | Roupas no chão | Clothes on the floor |
| `cadeira_caida` | `fallen_chair` | `estado` -> `house_state` | Cadeira caída | Fallen chair |
| `manchas_sangue` | `blood_stains` | `estado` -> `house_state` | Manchas de sangue | Blood stains |
| `porta_aberta` | `open_door` | `estado` -> `house_state` | Porta aberta | Open door |

### Floor kinds (also valid for `cobrir` / `cover`)

The five ground-cover items in the table (`gramado`, `piso_ceramico`, `cimentado`, `deck_madeira`, `terra`) plus two kinds that only exist in the floor atlas:

| Old | New |
|---|---|
| `azulejo_piscina` | `pool_tile` |
| `pedra` | `paving` |

## Atlas (`atlas(nome)`)

| Old | New |
|---|---|
| `atlas('quadro')` | `atlas('picture')` |
| `atlas('piso')` | `atlas('floor')` |
| `atlas('agua')` | `atlas('water')` |

Fields of the result:

| Old | New |
|---|---|
| `canvas` | `canvas` |
| quadro: `uv(i)`, `n` | picture: `uv(i)`, `n` |
| quadro: `espelho()` | picture: `mirror()` |
| quadro: `nomes` (art names) | picture: `names` (from the locale table) |
| piso: `uv(tipo, variante)` | floor: `uv(kind, variant)` |
| piso: `tam(tipo)` | floor: `size(kind)` |
| piso: `variantes(tipo)` | floor: `variants(kind)` |
| piso: `celulas` | floor: `cells` |

## `cobrir` options (`cover` options)

| Old | New |
|---|---|
| `w`, `d`, `y` | `w`, `d`, `y` |
| `tam` | `size` |
| `cor` | `color` |
| `poly` | `poly` |

## User-facing strings (now in the locale table)

`pt-BR` equals the previous Portuguese strings exactly; `en` is new.

| Old | New |
|---|---|
| `tipos[].nome` | `locales[locale].typeNames[id]` / `props.types[].name` (see the type table above) |
| `atlas('quadro').nomes` | `locales[locale].pictureNames` / `atlas('picture').names` |

Art names (pt-BR -> en): `abstrato quente` -> `warm abstract`, `abstrato azul` -> `blue abstract`, `blocos de cor` -> `color blocks`, `minimal` -> `minimal`,
`pôr do sol` -> `sunset`, `montanhas e lago` -> `mountains and lake`, `praia com coqueiro` -> `beach with palm tree`, `espelho` -> `mirror`.

## Behaviour changes beyond renaming

- `create` no longer needs `THREE` (it never used it); the argument is kept so the call stays mechanical.
- Without a `document` (no option and no global), asking for an atlas now throws a clear error instead of a `TypeError` on `null`.
- New exports: `createRecorder()` (an api that records primitives, handy for tests and previews), `listTypes(locale)`, `hex`, `shade`, `mix`, `rng`,
  `seedOf`, and the `Primitive` / `PropsApi` / `PropItem` types.
- The Portuguese type names are no longer hard-coded in the catalog; they come from the locale table.
