# @adatechnology/game-interactables-household

Household content pack for [`@adatechnology/game-interactables`](../game-interactables): 37 objects for houses and yards (fridge, cabinets, wardrobe,
drawers, stove, gas bottle, sinks, shower, toilet, sockets, service entrance, TV, sofa, beds, blinds, bins, mailbox, dog house, barbecue,
clothesline...) modeled **with real depth**: doors hinged on the front edge that never go through the wall, hollow carcasses with lighter inner
liners, real open-top drawers, door trays, handles, hinges and gaps between doors.

Each type draws through an `api` the host passes in (the same primitives as [`@adatechnology/game-props3d`](../game-props3d), plus `part`) and
returns an `ObjectSpec` (parts, containers with slots, seats, fixtures, devices, wires, emitters, mirrors, soft volumes, colliders...) that
`@adatechnology/game-interactables` runs. Nothing here depends on a renderer or on a game; `three` is not even required.

## Install

```sh
pnpm add @adatechnology/game-interactables-household @adatechnology/game-interactables
```

Browser without a bundler (the global is `GameInteractablesHousehold`):

```html
<script src="https://unpkg.com/@adatechnology/game-interactables-household/dist/index.global.js"></script>
<script>
  const hh = GameInteractablesHousehold.createHousehold({ locale: 'pt-BR', region: 'br' })
</script>
```

## Usage

```ts
import { createHousehold } from '@adatechnology/game-interactables-household'
import { createWorld } from '@adatechnology/game-interactables'

const hh = createHousehold({ locale: 'pt-BR', region: 'br' })
const world = createWorld({ locale: 'pt-BR', strings: hh.strings, items: hh.items, loot: hh.loot, seed: 'house-1' })

// `api` is yours. Parts become movable groups; everything else is drawn as usual.
const api: HouseholdApi = {
  box: (M, material, x, y, z, w, h, d, color, ry, rx, rz) => { /* base of the box at y */ },
  cylinder: (M, material, x, y, z, r, h, color, rx, rz, shape) => { /* ... */ },
  leaf: () => {},
  plane: (M, material, x, y, z, w, h, color, ry, rx, rz, uv) => { /* ... */ },
  part(id, pivot, ry, draw) {
    const group = makeGroup(id, pivot, ry) // one movable group per part
    withGroup(group, draw) // everything `draw` emits is in the part frame
  },
}

const item = { x: 2, z: 3, ry: 0, seed: 1, contents: { fridge: [{ type: 'milk_carton', qty: 2 }, null] } }
const spec = hh.build('fridge', item, api) // draws the static parts and the movable ones, returns the ObjectSpec
world.add('fridge-1', spec, { x: 2, y: 0, z: 3, ry: 0 })
```

Every frame the host calls `world.update(dt)`, reads `world.partT(id, 'door_fridge')` to turn the matching group, `world.sway(...)` for soft
volumes (clothes, curtains, glass), `world.emitters()` for flames, smoke, steam and water, and `world.mirrors(...)` for reflections.

## API

| Member | Description |
|---|---|
| `createHousehold({ locale?, region? })` | Creates the pack. `locale` is `en` (default) or `pt-BR`; `region` is `br` or `us` (default: `br` for `pt-BR`, else `us`) |
| `hh.types` | `[{ id, name, group, w, d, h, y, solid }]`, `name` localized. `y` is the default mounting height, `solid: false` marks wall items and wires |
| `hh.items` | `ItemCatalog`, 90 household items with `size`, `weight`, `stack`, `shape`, `color`, category |
| `hh.loot` | `LootTables` for `fridge`, `freezer`, `kitchen_cabinet`, `kitchen_drawer`, `pantry`, `wardrobe`, `dresser`, `nightstand`, `bathroom_cabinet`, `under_sink`, `trash`, `mailbox`, `bbq_counter`, `garage_shelf` |
| `hh.strings` | `{ en, 'pt-BR' }`: `type.<id>`, `item.<id>`, `prompt.<x>` (with `.open` / `.closed` / `.on` / `.off` variants) and `letter.*` texts. Pass it to `createWorld({ strings })` |
| `hh.region` | Data of the region (`regions/<id>.json`): gas bottle, socket standard and voltage, mailbox style, clothesline style |
| `hh.build(type, item, api)` | Draws through `api` and returns the `ObjectSpec`. Deterministic for the same `item.seed` |
| `createRecorder()` | `{ api, primitives, parts }`: records static primitives in `primitives` and the ones drawn inside a part under `parts[id]` (`{ id, pivot, ry, primitives }`), for tests and previews |
| `cornersOf`, `motionPoint`, `sweepOf` | Geometry helpers used for sweep rects and tests |

`HouseholdApi` is `PropsApi` plus `part(id, pivot, ry, draw)`: everything drawn inside `draw` is in the part's frame (relative to the pivot,
rotated by `ry`, which is always 0 in this pack), so the host makes one movable group per part. Conventions are those of props3d: front = local
`+z`, origin at the center of the footprint on the floor, `box` and `cylinder` base at `y`, `plane` centered, material keys `plain`, `metal`,
`wood`, `glass`, `fabric`, `emissive`.

### The item

`HouseholdItem` is a props3d `PropItem` (`w`, `d`, `h`, `y`, `color`, `palette`, `seed`, `variant`, `on`, `open`, `retracted`...) plus:

| Field | Meaning |
|---|---|
| `contents` | `{ [containerId]: Array<{ type, qty, data? } \| null> }`, slot by slot. Wins over the loot table |
| `hinge` | `'left'` or `'right'`, side of the hinge of single-door types |
| `circuit` | Circuit of a `wall_socket` and of the shower heater |
| `controls` | Device ids a `wall_switch` toggles |
| `points` | `conduit_run`: polyline in object-local coordinates |
| `house`, `sag` | `service_entrance`: where the drop wire ends (object-local) and how much it sags |
| `variant` | `fridge`: `'steel'`; `pantry`: `'garage'` (open steel shelves, loot `garage_shelf`); `blinds`: `'wood'`, `'closed'` (starts with the slats closed); `dog_house`: `'no_bowl'` |

## Types

Dimensions are the defaults (w x d x h in meters; `y` = mounting height). Every part, container and seat id is stable and snake_case.

### Storage with real depth

| Type | Size | What it exposes |
|---|---|---|
| `fridge` | 0.7 x 0.7 x 1.8 | `door_fridge`, `door_freezer` hinged on the **front** edge (97 degrees), five lighter inner faces, glass shelves, door trays as slots that follow the door; containers `fridge`, `freezer`; `compressor` device with cord |
| `fridge_compact` | 0.5 x 0.55 x 0.85 | `door_fridge` plus a `door_freezer` flap hinged at the bottom; same containers |
| `kitchen_cabinet_base` | 0.8 x 0.6 x 0.9 | `drawer` and `door_1`, `door_2` (one door under 0.6 m), shelf; containers `cupboard`, `drawer` |
| `kitchen_cabinet_wall` | 0.8 x 0.35 x 0.7, y 1.4 | `door_1`, `door_2`, shelf; container `cupboard` |
| `pantry` | 0.8 x 0.45 x 2.0 | `door_1`, `door_2`, five shelves; container `shelves`. `variant: 'garage'` = open steel shelf, loot `garage_shelf` |
| `wardrobe` | 1.6 x 0.6 x 2.1 | 2 doors (3 from 1.4 m), hanging rod with clothes, vertical divider, shelves, `drawer_n` under the doors; **mirror** = plane on the outer face of door 2, 4 mm proud, drawn inside that door's part, plus a `MirrorSpec` with `part`. Containers `shelves`, `drawer_n` |
| `dresser` | 1.0 x 0.5 x 0.9 | `drawer_1..4`, legs, overhanging top; containers `drawer_n` |
| `nightstand` | 0.45 x 0.4 x 0.55 | `drawer`, `door`; containers `drawer`, `cupboard` |
| `bathroom_cabinet` | 0.6 x 0.15 x 0.75, y 1.3 | `door` carries the mirror (plane + `MirrorSpec`), glass shelves; container `cabinet` |

**Drawers** are real open-top boxes (bottom, two sides, back and a front panel with raised center and handle). Nothing sticks out of the carcass
when closed, the slide distance is 0.75 x the inner depth, slots sit on the drawer bottom and carry `part`.

### Kitchen and bathroom

| Type | Size | What it exposes |
|---|---|---|
| `stove` | 0.6 x 0.65 x 0.9 | four burners (`burner_1..4`) and an `oven`, each with a `knob_*` part, `fuel: 'auto'`, flame emitters, `oven_door` hinged at the bottom, `gas_hose` wire to the connection point behind |
| `gas_bottle` | 0.36 x 0.36 x 0.58 | region data (BR 13 kg P13, US 20 lb), `valve` part, `gas` fuel source, damage kind `gas`, protective guard |
| `sink_kitchen` | 1.2 x 0.6 x 1.2 | basin, drainboard, `tap` fixture with `tap_handle` part and water emitter, `door_1`, `door_2`, container `under_sink` |
| `sink_bathroom` | 0.55 x 0.45 x 1.05 | basin in a vanity, same tap, `door`, container `under_sink` |
| `shower` | 0.9 x 0.9 x 2.1 | tray, tiled walls (the only colliders), head, `valve` part, `shower` fixture with `heater` device, water and steam emitters, glass: `glass_door` (sliding part) and `glass_fixed` as **soft panels, never colliders** |
| `toilet` | 0.4 x 0.7 x 0.8 | bowl, cistern, `lid` part, `flush_button` part, `flush` fixture and water emitter |
| `utility_sink` | 0.6 x 0.55 x 1.2 | deep laundry tub on a frame, washboard, `tap` and `basin` fixtures |

### Electrical

| Type | Size | What it exposes |
|---|---|---|
| `wall_socket` | 0.08 x 0.03 x 0.08, y 0.3 | plate with the holes of the region standard (BR NBR 14136 three round holes, US NEMA 5-15); `socket` |
| `wall_switch` | 0.08 x 0.03 x 0.08, y 1.2 | `rocker` part; `switch` with `controls` from `item.controls` |
| `service_entrance` | 0.6 x 0.5 x 6.5 | concrete pole, cross arm with insulators, meter box with `meter_door`; wires: `drop` (catenary to `item.house`), `riser` conduit, `earth` cable |
| `conduit_run` | - | no primitives; `item.points` becomes a `conduit` wire |
| `tv` | 1.0 x 0.22 x 0.68 | stand, bezel, back shell, screen (the only `emissive` plane), `power` part; `tv` screen device with `socket: 'auto'`, `plug`, 6 channels, cord wire |
| `microwave` | 0.5 x 0.38 x 0.3, y 0.9 | hollow cavity with turntable, `door`, `dial`; appliance device (plugged) |
| `washing_machine` | 0.6 x 0.6 x 0.85 | cabinet with drum, round `door`, `dial`; appliance device (plugged) |

### Seating

| Type | Size | What it exposes |
|---|---|---|
| `sofa` | 2.0 x 0.9 x 0.85 | `seat_n` (`sit`, from the width) and one `lie` seat; arms, cushions, back cushions |
| `armchair` | 0.85 x 0.85 x 0.85 | `seat_1` |
| `dining_chair` | 0.45 x 0.45 x 0.9 | `seat` |
| `bed_double`, `bed_single` | 1.6 x 2.05 x 0.95, 0.95 x 2.0 x 0.9 | `lie_1`, `lie_2` / `lie`; headboard, mattress, duvet, pillows |
| `bench` | 1.5 x 0.5 x 0.85 | slatted bench with cast-iron frame, `seat_n` from the width |

Seats face `+z` of the object (`ry = PI`, because yaw 0 is -z in `game-interactables`) and have an exit point in front (beds: beside them).

### Windows

| Type | Size | What it exposes |
|---|---|---|
| `blinds` | 1.2 x 0.08 x 1.4, y 0.9 | one hinged part per slat (`slat_1`...) in the part group `tilt`, so a single interaction closes (slats ~80 degrees, overlapping) or opens (flat) the whole blind; a separate `raise` part (scale along y) lifts the cord ladders, rail and pull. Parts are flat groups, so the slats do not stack when raised |
| `curtain` | 1.6 x 0.1 x 1.6, y 0.7 | `panel_l`, `panel_r` (scale along x, bunching toward the end) in the part group `panels`: one interaction opens and closes both. Each has a **soft curtain** (`soft.part` = the panel, so walking through sways it); rod, rings, folds |

### Yard

| Type | Size | What it exposes |
|---|---|---|
| `trash_bin` | 0.45 x 0.45 x 0.65 | hollow body with inner walls and floor, `lid` hinged at the back; container `bin` (loot `trash`) |
| `wheelie_bin` | 0.6 x 0.75 x 1.05 | same, with wheels and a grab bar |
| `mailbox` | 0.3 x 0.45 x 1.3 | box on a post with a `flap` hinged at the bottom; container `letters` (loot `mailbox`, default contents carry `data.text` locale keys) with a `read` interaction per slot; US style has a `flag` part. Region decides wall/post style and color |
| `dog_house` | 0.8 x 1.0 x 0.85 | real hollow interior: floor, lighter inner wall faces, cushion, optional bowl; the opening is an actual gap in the front wall with trim; gable roof |
| `bbq` | 1.5 x 0.6 x 1.9 | brick masonry with courses and mortar, ash door, charcoal bed, grill grate, stepped hood, chimney and flue; `coal` burner (`needsIgnition`, fuel `charcoal`), `coal_fire` and `coal_smoke` (at the flue top) emitters, side counter with `counter_door` and container `counter` (loot `bbq_counter`) |
| `clothesline` | 4.0 x 0.7 x 2.0 | two T posts (base plate 1 mm above the floor), three `wire_n` that start and end exactly at the tips and the center of the T arms, clothes as separate `cloth_w_i` parts each with a `soft` cloth entry (same id). Only the poles are colliders |

## Data

Everything is plain JSON in `src/data` (bundled): `types.json`, `items.json`, `loot.json`, `locales/en.json`, `locales/pt-BR.json` and
`regions/br.json`, `regions/us.json`. Region specifics are data, never a type suffix:

```json
{ "id": "br", "gas": { "kind": "P13", "capacityKg": 13 }, "socket": { "standard": "NBR 14136", "voltage": [127, 220], "hz": 60 }, "mailbox": { "style": "wall" } }
```

## Guarantees (tested)

For every type, with defaults and three seeds, in both regions: the build succeeds; all static primitives and all closed-part primitives stay inside
the footprint (w x d x h, 2 cm tolerance), so nothing goes through the wall; every part's `sweep` covers its open pose; ids are unique and every
reference (part, container, device, burner, fixture, seat...) resolves; slots lie inside their container volume; every loot entry fits a slot of a
container that uses its table; every locale key a spec uses exists in `en` and `pt-BR`; same seed gives identical primitives and spec.

## Português

Pack de conteúdo de casa e quintal para o `@adatechnology/game-interactables`: geladeira, armários, guarda-roupa, gavetas, fogão, botijão de gás,
pias, chuveiro, vaso, tomadas, poste de entrada de energia, TV, sofá, camas, persianas, lixeiras, caixa de correio, casinha de cachorro,
churrasqueira e varal. Os objetos têm **profundidade real**: portas com dobradiça na borda da frente (nunca atravessam a parede), corpo oco com
forro interno mais claro, gavetas de verdade (fundo, laterais, fundo traseiro e frente), bandejas na porta, puxadores e frestas entre portas.

```ts
const hh = createHousehold({ locale: 'pt-BR', region: 'br' })
const world = createWorld({ locale: 'pt-BR', strings: hh.strings, items: hh.items, loot: hh.loot })
const spec = hh.build('fridge', { seed: 1 }, api)
hh.types.find((t) => t.id === 'wardrobe')!.name // "Guarda-roupa"
```

O espelho do guarda-roupa é um plano na face **externa** de uma porta (4 mm à frente), dentro da parte da porta, e acompanha o movimento. A região
(`br` ou `us`) define o botijão (P13 de 13 kg no Brasil), o padrão de tomada (NBR 14136 de três pinos, 127/220 V) e o estilo da caixa de correio.
Os dados ficam em JSON (`src/data`); os textos em `locales/pt-BR.json`.
