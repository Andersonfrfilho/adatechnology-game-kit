# @adatechnology/game-props3d

Procedural low-poly props for 3D games: ceiling lights, wall decor, modern furniture, yard items, ground covers and "house state" clutter
(barricades, sandbags, supplies, stains...). 57 builders, no assets.

The builders **only describe primitives** (boxes, cylinders, leaves, planes, lights) through an `api` object that the host passes in. The host draws
each primitive however it likes, for instance by pushing them into one `BufferGeometry` per material to keep draw calls low. Nothing here depends on
a renderer, and `three` is not even required.

## Install

```sh
pnpm add @adatechnology/game-props3d
```

Browser without a bundler (the global is `GameProps3d`):

```html
<script src="https://unpkg.com/@adatechnology/game-props3d/dist/index.global.js"></script>
<script>
  const props = GameProps3d.create(undefined, { document })
</script>
```

## Usage

```ts
import { create, type PropsApi } from '@adatechnology/game-props3d'

const props = create(undefined, { document, locale: 'en' })

// 1. implement the api: translate primitives into your renderer. Coordinates are local to the item.
const api: PropsApi = {
  box: (M, material, x, y, z, w, h, d, color, ry, rx, rz) => { /* base of the box at y */ },
  cylinder: (M, material, x, y, z, r, h, color, rx, rz, shape) => { /* shape: 'cyl' | 'cyl6' | 'cone' | 'sphere' */ },
  leaf: (M, x, y, z, w, h, color, ry, rx) => { /* diamond leaf, tip toward +y */ },
  plane: (M, material, x, y, z, w, h, color, ry, rx, rz, uv) => { /* normal +z; uv = atlas cell */ },
  light: (M, x, y, z, color, range, kind) => { /* optional: a real light */ },
}

// 2. draw items. M.x, M.z and M.ry are for your api to apply; builders work in local space.
props.builders.sofa_l({ w: 2.8, d: 1.7, h: 0.85, x: 4, z: -2, ry: Math.PI / 2, seed: 'living-room', palette: { fabric_main: 0x6e7078 } }, api)
props.builders.lantern({ x: 1, z: 1, y: 0.9 }, api)

// 3. atlases: one canvas per atlas, you make one texture each
const floor = props.atlas('floor') // { canvas, uv(kind, variant), size(kind), variants(kind), cells }
const pictures = props.atlas('picture') // { canvas, uv(i), mirror(), n, names }
const water = props.atlas('water') // { canvas } tiles; scroll texture.offset for the shimmer

// 4. ground covers and pools use atlas planes
props.cover(api, { w: 6, d: 4 }, 'lawn') // or { poly: [[x, z], ...] }
```

Test or preview without a renderer:

```ts
import { createRecorder } from '@adatechnology/game-props3d'
const { api, primitives } = createRecorder()
props.builders.sauna({ w: 2, d: 1.8, h: 2.1 }, api)
console.log(primitives.length, primitives[0])
```

## The item `M`

Front is local `+z`, origin at the center of the footprint on the floor, `M.w` (x), `M.d` (z), `M.h` (y), in meters. Without `w/d/h` the defaults of
the type apply.

| Field | Meaning |
|---|---|
| `x`, `z`, `ry` | Position and turn, applied by your api |
| `y` | Mounting height (split, pictures, TV, table plants, boards...) |
| `ceiling` | Ceiling height, default 2.9 |
| `color` | Main color (wins over the palette) |
| `palette` | House palette by role: `wood`, `fabric_main`, `fabric_accent`, `metal`, `picture_accent`, `wall_living`, `wall_kitchen`, `wall_bedroom`, `exterior_floor`, `plant` |
| `seed` | Seed of the details draw (number or string); default is a hash of the position |
| `variant` | `'wood'` (blinds), `'dark'` (pergola), `'x'` (window boards) |
| `poly` | Polygon `[[x, z], ...]` for ground covers |
| `on` / `light` / `lit` | Lamp on / also emit a real light / lantern and candles lit (default true) |
| `open`, `retracted`, `art`, `fruit`, `angle`, `drag` | Curtain open, blinds retracted fraction, picture art 0..6, fruit color, door angle, blood drag |

Colors are `0xRRGGBB` numbers or `'#rrggbb'` strings.

## The api

| Call | Description |
|---|---|
| `box(M, material, x, y, z, w, h, d, color, ry, rx, rz)` | Box with its **base** at `y`, rotated around its center (order YXZ: `ry` last) |
| `cylinder(M, material, x, y, z, r, h, color, rx, rz, shape?)` | Vertical cylinder with its base at `y` (if `rx`/`rz` are not 0, `y` is the center); `shape` is `'cyl'` (12 sides, default), `'cyl6'`, `'cone'` or `'sphere'` (ellipsoid) |
| `leaf(M, x, y, z, w, h, color, ry, rx)` | Diamond-shaped leaf, base at (x, y, z), tip toward +y; `ry` turns it, `rx` leans it forward; double-sided |
| `plane(M, material, x, y, z, w, h, color, ry, rx, rz, uv?)` | `w` x `h` quad centered at `y`, normal +z (use `rx = -PI/2` to lay it flat); `uv = { u0, v0, u1, v1 }` is the atlas cell |
| `light?(M, x, y, z, color, range, kind)` | A real light (optional; at most one per room). Without it, `emit('light', data)` is called |

`material` is one of `plain`, `metal`, `wood`, `glass`, `fabric`, `plant`, `water`, `emissive`, `atlas_picture`, `atlas_floor`.

## Types

`props.types` lists `{ id, name, interior, w, d, h, y, solid, group }` for every prop; `name` is localized (`en` or `pt-BR`). `solid: false` marks
items without collision (wall, ceiling, floor and decals). Groups:

- **ceiling**: `ceiling_light`, `pendant`, `track_spot`, `chandelier`
- **wall**: `wall_ac`, `picture_small`, `picture_large`, `mirror`, `curtain`, `blinds`, `flat_tv`
- **plants**: `floor_plant`, `table_plant`, `hanging_plant`
- **furniture**: `tv_stand`, `breakfast_bar`, `sofa_l`, `double_bed_modern`, `home_office`, `closet`, `vanity`
- **floor** (no collision): `lawn`, `tile_floor`, `concrete`, `deck_floor`, `dirt`
- **yard**: `ac_condenser`, `gourmet_counter`, `sauna`, `soaking_tub`, `pool`, `deck`, `sun_lounger`, `garden_bed`, `fruit_tree`, `palm_tree`,
  `pergola`, `slide`, `swing`, `bbq_simple`, `garage_car`
- **house_state**: `window_boards`, `barricade`, `sandbags`, `barbed_wire`, `razor_wire`, `water_bottle_crates`, `canned_food`, `water_jug`,
  `floor_mattress`, `lantern`, `candles`, `open_suitcases`, `clothes_on_floor`, `fallen_chair`, `blood_stains`, `open_door`

## Atlases

Built lazily from canvases created with `options.document` (or the global `document`), then cached: `atlas('picture')` (7 artworks plus a mirror cell),
`atlas('floor')` (lawn, tile_floor, concrete, deck_floor, dirt, pool_tile, paving), `atlas('water')`. Make one `CanvasTexture` and one material per
atlas. `cover(api, M, kind, { w, d, y, size, color, poly })` emits atlas squares (clipped at the edge) through `api.plane('atlas_floor')`.

Coming from the Portuguese `Moveis3DSDK`? The complete old-to-new table is in [MIGRATION.md](./MIGRATION.md).

## Português

Builders low-poly de decoração, móveis modernos, quintal e "estado da casa", sem nada de jogo específico. O pacote só descreve **primitivas**
(`box`, `cylinder`, `leaf`, `plane`, `light`) através de uma `api` que o jogo passa; o jogo desenha cada uma nos seus acumuladores.

```ts
const props = create(undefined, { document, locale: 'pt-BR' })
props.builders.sofa_l({ w: 2.8, d: 1.7, h: 0.85, seed: 'sala' }, api)
props.types.find((t) => t.id === 'sofa_l')!.name // "Sofá em L"
```

Com `locale: 'pt-BR'` os nomes dos tipos e das artes dos quadros ficam idênticos aos do SDK original. Os ids viraram inglês (`quadro_peq` ->
`picture_small`, `split_interno` -> `wall_ac`, `sacos_areia` -> `sandbags`...); a tabela completa está em [MIGRATION.md](./MIGRATION.md).
