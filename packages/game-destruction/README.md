# @adatechnology/game-destruction

Engine-agnostic destruction model. An object is an assembly of **parts** (box, cylinder or sphere with a material) held together by **joints**.
Materials decide what a hit does: steel dents and gets holes, glass cracks and shatters, wood splinters and burns to ash, concrete crumbles,
aluminium and plastic melt and drip. Joints break under impulse, open when their parts are destroyed (the object breaks apart) or are undone with
the right tool (the object is taken apart). The world reports everything as **events** that a renderer draws. No dependencies, no renderer, no game.

Units: metres, kilograms, seconds, joules, degrees Celsius.

Contracts live in [`@adatechnology/game-contracts`](../game-contracts); the types are re-exported here, so existing imports keep working.

## Install

```sh
pnpm add @adatechnology/game-destruction
```

In a browser without a bundler, load `dist/index.global.js`; it exposes the `GameDestruction` global.

## Quick start

```ts
import { createDestruction } from '@adatechnology/game-destruction'

const world = createDestruction({ seed: 42 })
world.on('*', (e) => draw(e)) // dent, hole, crack, fracture, detach, ignite, melt, leak, explode...

const chair = world.add({
  name: 'chair',
  parts: [
    { id: 'seat', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.04, 0.4] }, position: [0, 0.42, 0] },
    { id: 'leg_fl', material: 'wood_soft', shape: { kind: 'box', size: [0.04, 0.4, 0.04] }, position: [0.18, 0.2, 0.18] },
    // ...joints are inferred from touching parts unless you pass `joints`
  ],
})

world.shoot([0, 1, 5], [0, 0, -1], 500, 9) // 9 mm, 500 J: raycast, hit, continue through
world.hit(chair, { type: 'blunt', point: [0.2, 0.2, 0.18], direction: [-1, 0, 0], energy: 300, radius: 0.05 })
world.hit(chair, { type: 'fire', point: [0, 0.4, 0], temperature: 1000, radius: 0.5, duration: 2 })

world.disassemble(chair, 'seat~leg_fl', 'screwdriver', dt) // progress 0..1, -1 for the wrong tool
for (const e of world.update(dt)) draw(e) // burning, melting, heat transfer, leaks, delayed explosions
```

The renderer or physics engine owns transforms: call `setTransform` to keep the world in sync, and after a `detach` use `splitGroup` to turn a loose
piece into its own object (and body).

## Materials

26 built-in materials in `src/data/materials.json` (override or extend with the `materials` option). Hit points per kilogram, penetration energy per
millimetre, ductility and fracture style drive the model.

| Family | Ids | Behaviour |
|---|---|---|
| Metal | `steel`, `cast_iron`, `aluminium`, `copper` | dent, holes, sparks, ricochet, glow when hot; melt at 1450 / 1200 / 660 / 1085 °C. Never fracture (cast iron cracks and snaps) |
| Wood | `wood_soft`, `wood_hard`, `plywood`, `mdf` | splinter or snap, ignite near 300 °C, burn, char, turn to ash |
| Glass and ceramic | `glass`, `tempered_glass`, `ceramic` | crack, then `shatter` into shards (`tempered_glass` is `crumble` into tiny chunks); thermal shock |
| Masonry and soil | `concrete`, `brick`, `plaster`, `stone`, `soil` | `crumble` with dust and chips; do not burn |
| Plastics | `plastic`, `rubber`, `foam`, `wax` | plastic snaps and melts near 200 °C, rubber and foam burn with black smoke, wax melts at 60 °C |
| Soft | `fabric`, `leather`, `paper` | `tear`, ignite easily and burn fast |
| Plants | `foliage`, `green_wood`, `cactus`, `flesh_fruit` | `tear` / `splinter`, hard to ignite (high water content) |

`guessMaterial(name)` maps a mesh name to a material id from the keyword table in `src/data/material-hints.json` (English keywords, longest match
wins): `guessMaterial('Chrome_Bumper') === 'steel'`.

### Tuning

A hit removes `energy * 0.02 * damageScale` hit points. A 9 mm (500 J) breaks a 0.6 m glass pane in 5 hits, tempered glass in 11, a wooden chair leg in 3,
and never breaks steel (it collects holes). A projectile goes through when `energy > penetration (J/mm) * thickness (mm)`: 9 mm through 1 mm steel
makes a through hole, through 5 cm concrete it only cracks and lodges. Grazing hits count a longer path through the material and can ricochet.

## Damage types

| Type | Inputs | Effect |
|---|---|---|
| `ballistic` | `energy`, `caliber` | hole (through or lodged), dent, crack, ricochet, debris, joint wear next to the impact |
| `blunt` | `energy`, `radius` | dents on ductile parts, cracks on brittle ones, wears every joint of the part (a hard kick pulls a leg off) |
| `slash` | `energy` | like blunt, with extra damage on fabric, foliage and wood; opens fabric |
| `explosive` | `energy`, `radius` | falloff `(1 - d/r)^2`, damage, dents facing the blast, joints break, fragments fly (capped at 40 m/s), flammables ignite |
| `fire` | `temperature`, `radius`, `duration` | heats towards the flame temperature and ignites at the material's ignition point |
| `heat` | same | heat without flame (cutting torch, hot plate); melts what it can reach |

`hit(objectId, hit)` finds the part along `direction`; `hitPart` targets a known part; `shoot` and `raycast` work in world space.

## Fire, melting and leaks

`update(dt)` advances everything that is hot. Burning parts consume fuel (`burnRate * surface`), lose hit points, char and finally turn to ashes
(`fuelFraction >= 0.8`) or stay charred. Heat flows through closed joints by conductivity and to parts of other objects within `fireSpread`. Heat
only moves towards a source temperature, so a wood fire (800 °C) never melts steel (1450 °C) but melts aluminium and plastic, and a 3000 °C torch
melts anything. Melting emits `melt` and `drip`; a melted part is lost and its joints open. Pressurized gas that leaks near fire burns (or explodes
when the part has `explodes`). `contains` parts leak through punctures: the `leak` event carries the hole's world point, the outward normal as
`direction` and the rate in litres per second, and `PartState.liters` drops in `update` (`setLiters` fills or empties a container).

## Joints and tools

| Kind | Strength | Tools | Seconds |
|---|---|---|---|
| `screw` | 80 | screwdriver | 2.5 |
| `bolt` | 200 | wrench | 4 |
| `nail` | 60 | pry_bar, hammer | 2 |
| `weld` | 600 | cutting_torch, saw | 8 |
| `glue` | 50 | pry_bar, knife | 3 |
| `hinge` | 120 | screwdriver | 3 |
| `clip` | 20 | hand | 0.6 |
| `tie` | 15 | knife, hand | 1 |
| `mortar` | 400 | hammer | 6 |
| `fused` | 1000 | none (can only break) | 0 |
| `stem` | 40 | knife, saw, hand | 1.5 |
| `rebar` | 1500 | cutting_torch, saw | 20 |
| `resting` | 30 | hand | 1 |

`inferJoints` joins parts whose bounds touch (default tolerance 1 cm) with the kind from `JOINT_BY_MATERIALS`. Joints open when their hit points
run out (`detach` with `by: 'break'`), when a part is lost (`'part_lost'`) or when a tool finishes the work (`'tool'`). `ObjectState.groups` lists
the connected pieces; index 0 keeps the object's id (the anchored one, else the heaviest).

## Structural integrity

Give parts a `structure: { role, capacity? }` (`foundation`, `column`, `beam`, `slab`, `wall`, `partition`, `roof`, `stair`, `none`) and the world
solves loads: each structural part carries its own mass plus what rests on it, down to the anchored parts (`foundation` implies `anchored`).
`PartState.load` is in kg and `PartState.stress` is `load / capacity`. Parts without a role (windows, doors, furniture) carry nothing. Objects
without any `structure` behave exactly as before.

- **Capacity** defaults to `material.compressive` (kg per m²: concrete 444 000, brick 40 000, softwood 100 000, steel 2 000 000) times the section:
  the two smallest dimensions for columns, beams, roofs and stairs (foundations x10), thickness times longest side for slabs, thickness times
  horizontal length for walls. A 0.3 m concrete column carries 40 t, a 0.2 m brick wall 8 t per metre, a 0.1 x 0.2 m softwood beam 2 t.
- **Joints** carry load when `bears` is true (default when both parts have a role). `bears: 'a_on_b'` means part `a` rests on `b`: load flows only
  that way. A `partition` is supported but supports nothing, so breaking it never drops anything.
- **Overload**: above stress 1 a part loses `min(0.6, 0.12 + 0.8 * (stress - 1))` of its `maxHp` per second (stress 1.02 gives way in ~7 s, 1.1 in ~5 s,
  1.5 in ~2 s, anything above 1.7 in ~1.7 s; deterministic), emits `stress` (once per 0.5 s) and cascades; brittle
  parts `crack` from stress 0.8. Metal never fractures, so overloaded steel only reports stress.
- **Collapse**: a part with no support path to an anchored part falls: it is cut from the supported pieces into its own group (index 1 or more) and
  one `collapse` event lists the group, and every part in it that is not already lost gets `PartState.status === 'collapsed'` (kept through
  `serialize`/`load`, cleared by `reset`; a part that later breaks becomes `broken`). Non-structural parts that hang only on collapsed parts fall with them. Make the group its own object with
  `splitGroup`.
- `buildFrame({ spanX, spanZ, columnsX, columnsZ, height, floors, walls, roof, columnCapacity, ... })` returns a test structure: columns on
  foundations (`rebar`), beams, a slab per floor, optional brick walls (`mortar`) with a door opening, and a roof that rests (`resting`) on the top beams.
- `sizeStructure(spec, { safety?, redundancy? })` returns a copy of the spec with `structure.capacity` set from the loads the world itself solves
  for the intact spec, so every structural part rests at stress `safety` (default 0.65). With `redundancy` (e.g. 0.97) the capacities are also
  raised where needed so that losing any single `column` keeps every other part at or below that stress: the structure stands with one column
  gone and, without help, falls with two neighbours gone. Raw material capacities are rarely a sensible design (a 54 t roof on 20 cm columns is
  already over 1 at rest); size the structure instead of hand-tuning. Parts without `structure` or with role `none` are untouched.

## Contracts: implement your own or use the default world

The kit defines contracts; each game module implements them for the objects it owns, and the world in this package is the optional default
implementation. A module implements `DestructibleImpl` (`describe`, `hit`, `update`, `state`, `reset`, `disassemble`, `extinguish`,
`serialize`, `load`) and registers it:

```ts
const id = world.register(myVehicleDoor, { position: [10, 0, 0] })
world.shoot(origin, dir, 500, 9) // passes through default objects and impls in order
```

The world routes raycast, shoot, explode, hit, disassemble, extinguish, update, state, reset, remove and `on` to the impl; its events go through the
same listeners in order. The impl receives hits in world space and returns events in world space (the transform given to `register` and
`setTransform` is only used for raycast and blast range). `splitGroup` on an impl throws. After a shot that goes through an impl the world assumes
half of the energy continues when a through `hole` was reported. `checkDestructible(impl, { materials })` returns `{ ok, problems }`: `describe()`
valid (unique ids, known materials, joints reference parts), a 500 J ballistic hit returns events of this impl naming known parts, `state()` matches
`describe()`, hit points never go negative, `update(0.016)` returns an array, events are finite JSON.

### Impact contract (what weapons must produce)

| `type` | Required | Optional | Notes |
|---|---|---|---|
| `ballistic` | `point`, `direction`, `energy`, `caliber` | `space`, `source` | joules, diameter in millimetres |
| `blunt` | `point`, `energy` | `direction`, `radius`, `space`, `source` | contact radius in metres |
| `slash` | `point`, `energy` | `direction`, `radius`, `space`, `source` | axes, knives |
| `explosive` | `point`, `energy`, `radius` | `space`, `source` | `point` is the blast centre |
| `fire` | `point`, `temperature`, `radius` | `duration`, `space`, `source` | call every frame with `duration: dt` |
| `heat` | `point`, `temperature`, `radius` | `duration`, `space`, `source` | cutting torch, hot plate |

`IMPACT_CONTRACT` holds this table as data and `checkHit(hit)` returns the problems of a hit.

## Events

`damage`, `dent`, `hole`, `crack`, `ricochet`, `debris`, `fracture` (with oriented `fragments` in world space), `detach`, `disassemble_progress`,
`ignite`, `extinguish`, `burnout`, `melt`, `drip`, `leak`, `explode`, `stress`, `collapse`, `destroyed`. All points are in world space. Subscribe with
`world.on(type | '*', fn)` or the `onEvent` option; `hit` and `update` also return their events.

## Determinism and LAN

Every random choice comes from the world seed (mulberry32), never `Math.random`, and the generator state is part of the snapshot. A LAN host can
run the world and send only the inputs (hits, `update(dt)` calls), or the events. `serialize()` / `load()` give a plain JSON round trip: a loaded
world continues with the same events as the original. The loading world must use the same materials.

## API

`createDestruction(options)` returns a `DestructionWorld`: `add`, `remove`, `has`, `ids`, `setTransform`, `splitGroup`, `hit`, `hitPart`, `explode`,
`raycast`, `shoot`, `disassemble`, `workableJoints`, `nearestJoint`, `extinguish`, `setLiters`, `update`, `state`, `part`, `reset`, `on`,
`register`, `serialize`, `load`, `time`. `state()` and `part()` return live views; do not mutate them.

Also exported: `buildFrame`, `sizeStructure`, `partCapacity`, `checkDestructible`, `checkHit`, `IMPACT_CONTRACT`, `MATERIALS`, `JOINT_DEFAULTS`, `JOINT_BY_MATERIALS`, `inferJoints`, `guessMaterial`, `partVolume`, `partMass`, `partThickness`, the
helpers `vec`, `quat`, `quatFromEuler`, `rotateVec`, `toLocal`, `toWorld`, the locale (`locales`, `resolveStrings`, `DestructionStrings`) and all types.

The locale table has `en` and `pt-BR` strings for material names, part statuses, joint kinds, tools, damage types, event labels and fracture styles:
`resolveStrings('pt-BR').materialNames.glass === 'vidro'`. Unknown locales fall back to `en`.

## Português

Modelo de destruição independente de engine. Um objeto é um conjunto de peças (caixa, cilindro ou esfera com um material) unidas por juntas. O
material decide o efeito: o aço amassa e fura, o vidro trinca e estilhaça, a madeira lasca e vira cinza, o concreto esfarela, o alumínio e o
plástico derretem e pingam. As juntas cedem com impacto, quando a peça é destruída ou quando se usa a ferramenta certa (chave de fenda para
parafuso, chave inglesa para porca e parafuso, maçarico para solda). O mundo devolve tudo como eventos para o renderizador desenhar. É
determinístico (semente fixa) e serializável, então um host de LAN pode rodar o mundo e enviar só as entradas. Os nomes em português
(materiais, ferramentas, juntas, eventos) estão em `resolveStrings('pt-BR')`.
