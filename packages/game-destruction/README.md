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

Brittle materials that `shatter` (glass, ceramic) take blunt and ballistic damage multiplied by `fragility(ductility, thickness)` (x1 from 2 cm up, to x118
for 3 mm glass), so a 9 mm shatters a window pane in one shot while a 5 cm block of glass takes several.

`hit(objectId, hit)` finds the part along `direction`; `hitPart` targets a known part; `shoot` and `raycast` work in world space.

## Fire, melting and leaks

`update(dt)` advances everything that is hot. Burning parts consume fuel (`burnRate * surface`), lose hit points, char and finally turn to ashes
(`fuelFraction >= 0.8`) or stay charred. Heat flows through closed joints by conductivity and to parts of other objects within `fireSpread`. With `blastFrontSpeed` (m/s, 340 is the speed of sound; default off) the glass an explosion reaches breaks `distance / speed` seconds later, in `update`, instead of on the spot. Heat
only moves towards a source temperature, so a wood fire (800 °C) never melts steel (1450 °C) but melts aluminium and plastic, and a 3000 °C torch
melts anything. Melting emits `melt` and `drip`; a melted part is lost and its joints open. Pressurized gas that leaks near fire burns (or explodes
when the part has `explodes`). `contains` parts leak through punctures: the `leak` event carries the hole's world point, the outward normal as
`direction` and the rate in litres per second, and `PartState.liters` drops in `update` (`setLiters` fills or empties a container).

### Ignition of a leak

A round that goes through a `contains` part with a flammable fluid (`gas`, `fuel`: a tank, a jerrycan, a gas bottle) **leaks and does not light by itself**. The leak lights
(a jet that burns, or the explosion of a part with `explodes`) when:

- the round carries a **spark** and hits **metal**: `Hit.ignition.spark` (the weapons build it from the core and the jacket of the round) times the factor of the struck
  material (`ignition.sparkTarget`: steel and iron 1, aluminium 0.25, other metals `sparkMetalDefault` 0.5, a part that is not metal never sparks);
- the round carries a **flame**: `Hit.ignition.flame`, or the flags `Hit.incendiary` / `Hit.tracer` (0.7 and 0.2 when the host sends only the flags), whatever the wall;
- a **fire is near**: a burning part or a jet within `ignition.fireNear.radius` (1.5 m) lights the leak at `chancePerSecond` (0.5); or
- a **blast** (`explode`) goes off within its radius of the leaking container.

Both chances are weighed by how full the container is, `ignition.fillCurve` (points `[filled, factor]`; a full container is too rich to burn and mostly leaks, a nearly empty one lights
easiest; default 0.6 empty, 1 at 10 percent, 0.6 at 35, 0.3 at 65, 0.15 at 90, 0.12 full; the flame feels half of it, `flameFillInfluence` 0.5) and rolled with the seeded generator of the
world. `createDestruction({ ignition })` changes any number (`IgnitionRules` and `DEFAULT_IGNITION_RULES` of `@adatechnology/game-contracts`, which also export `ignitionChance` and
`fillFactor`). A round without `ignition`, `incendiary` and `tracer` never lights a leak; a part heated to 350 degrees C still does, as before.

### Chain reaction

A part with `explodes.chain` (fuel barrel, gas bottle, car tank, gas pump, station tank) answers to what happens around it: `shot` (a bullet, once it has taken off
`shotDamageFraction` of the hit points), `fire` (the part reaches `explodes.atC`, 300 °C by default) and `explosion` (a blast reaches it). Each gives the seconds until the
blast, fixed or `[min, max]` drawn from the world seed. The world emits `primed` when it arms a part and `explode` when the delay ends; a bullet or a blast arms the part
instead of tearing it apart on the spot, and a part goes off once. Blasts resolve in order of time, then object, then part, and the delay counts from the blast that armed the
part, so the timeline does not depend on the `dt` you pass to `update`. `explosivePart(explosive, part)` builds the part from an `ExplosiveDef` of `@adatechnology/game-weapons`
(`explosives.get('fuel_barrel')`), so energy, reach and delays come from one place and a game changes them with `patch.explosives`.

A fluid with `contains.outflow` (object-local direction) leaves a hole that way instead of out of the hole: the water on a roof membrane runs down
(`[0, -1, 0]`) into the floor below.

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

- **A slab or beam is held by the sum of its supports.** Its load is shared among the supports it rests on that are still there (columns, bearing
  walls, beams), so a slab on four columns puts a quarter on each; lose one and the other three carry the load of the four, lose two and the
  two left carry twice their share. The structure falls when the capacity that is left (the sum over the supports) is less than the load.
  Everything is config: the capacity of a part is `structure.capacity` or `material.compressive` times its section (set `compressive` on a
  `MaterialDef` passed in `materials`), `sizeStructure({ safety, redundancy })` sizes them (`safety` 0.72 with `redundancy` 0.97 on four columns:
  rest 0.72, one lost 0.96, two lost 1.44), and the world option `structure: { safetyFactor }` (default 1) multiplies every load before it meets
  the capacities (stress = `load * safetyFactor / capacity`): above 1 the whole building is loaded harder than it was sized for.
- **Capacity** is `structure.capacity` when the spec gives it. Otherwise, for a material with real strengths (`MaterialDef.strength`: concrete C25
  and ceramic brick ship with them), it is the compressive strength times the section, divided by g: a 0.3 x 0.3 m plain concrete column of 3 m
  carries 203 t, a 0.2 m brick wall 2.8 m tall 41 t per metre. Masonry and plain concrete walls and columns (`strength.slender`, default for
  `masonry` materials without steel) get the NBR 16868-1 reduction `(1 - 2e)(1 - (h/t/40)^3)` (`structure.masonry`: `minEccentricity` 0.05,
  `slendernessLimit` 40); a reinforced column carries `0.85 fck Ac + As fy` (`masonry.concreteFactor` 0.85). Materials without `strength` keep
  `material.compressive` (kg per m²: softwood 100 000, steel 2 000 000). The section is the two smallest dimensions for columns, beams, roofs and
  stairs (foundations x10), thickness times longest side for slabs, thickness times horizontal length for walls. Because each storey passes its
  load down, a bearing wall that carries too many storeys crushes at the ground floor first. `bearingWallThickness({ storeys, storeyHeight,
  floorLoad, material })` gives the thickness a designer would give each storey (γf 1.4, γm 2.0, minimum 0.14 m): 16 storeys of 3.75 m with
  26 kN/m of floor per wall give 1.49 m at the base (the Monadnock Building has 1.8 m).
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
  `continuousColumns` makes each column rest on the one below instead of on the slab (a tall frame needs it: otherwise the first-floor beams carry
  the tower in bending), `columnCage` gives the columns a rebar cage and `roofThickness` sets the roof slab (default 0.75 x `slabThickness`).
- `sizeStructure(spec, { safety?, redundancy?, redundancyRoles?, safetyByRole? })` returns a copy of the spec with `structure.capacity` set from the loads the world itself solves
  for the intact spec, so every structural part rests at stress `safety` (default 0.65). With `redundancy` (e.g. 0.97) the capacities are also
  raised where needed so that losing any single `column` keeps every other part at or below that stress: the structure stands with one column
  gone and, without help, falls with two neighbours gone. Raw material capacities are rarely a sensible design (a 54 t roof on 20 cm columns is
  already over 1 at rest); size the structure instead of hand-tuning. Parts without `structure` or with role `none` are untouched.
  `redundancyRoles` (default `['column']`) says which parts the N-1 check removes one at a time: a house uses `['column', 'wall']` so it also
  stands with a bearing wall gone. `safetyByRole` overrides `safety` per role: `{ beam: 0.45, slab: 0.45, roof: 0.45, stair: 0.45 }` keeps the
  floors well under their limit so they outlast the member that fails.

### Bending: concrete cracks in tension, the steel holds

Beams, slabs, roofs and stairs of a material with `strength.tensileMPa` that declare their steel (`structure.rebar: { ratio, yieldMPa?, cover? }`,
`ratio: 0` is plain concrete) also bend. The span comes from the supports (twice the farthest distance to one, so two walls 4 m apart give 4 m,
corner columns give the long side, a cantilever of c gives 2c, and losing a column doubles it); the bending load is the part's own weight plus
what rests on it away from the supports (a load within one depth of a support goes straight down, EN 1992-1-1 6.2.2(6)). `M = wL²/8` meets the
section: cracking moment `1.5 fct b h²/6` (NBR 6118 17.3.1) and the steel moment with the NBR 6118 rectangular block (`0.85 fck` over `0.8x`,
`x/d` at most 0.45, the rest as double reinforcement), CA-50 at 500 MPa, 3 cm cover. `PartState.flexure = M / capacity` (after cracking only the
steel counts) and `stress` is the larger of that and compression.

- **Blast**: a single-degree-of-freedom check (Biggs: KL 0.64, KM 0.5) with the Sadovsky impulse of the TNT-equivalent charge (4.184 MJ/kg),
  reflected `2 + 4/Z`. Above the cracking moment the tension face cracks (`crack` on the face away from the charge, `PartState.cracked`); a part
  without steel snaps (`fracture` style `snap`); with steel, yielding adds plastic rotation and at 10° (PDC-TR 06-08) the part hinges and falls in
  one piece (`detach` from its supports, `collapse`).
- **At rest**: `flexure > 1` wears the part like a compression overload; a reinforced part then hinges and falls, a plain one snaps.
- **Joints**: `rebar` joints of a reinforced part are monolithic: blows and blasts do not wear them.
- **Options** (`structure.flexure`, `FLEXURE_DEFAULTS`): `enabled`, `roles`, `scope` (`'rebar'` default: only parts with `structure.rebar`;
  `'reinforced'`: also parts with only a `reinforcement` cage; `'all'`: every concrete beam and slab, plain when they have no steel),
  `crackFactor`, `rebarYieldMPa`, `cover`, `neutralAxisLimit`, `failRotationDeg`, `loadFactor`, `massFactor`, `tntJoules`, `impulse`,
  `reflection`, `reflectionNear`, `nearScaled`. Helpers: `crackingMoment`, `steelMoment`, `sectionMoments`, `blastImpulse`, `slendernessFactor`,
  `spanOf`, `bearingWallThickness`.
- **Sizing**: `sizeRebar(spec, { safety, redundancy, redundancyRoles, safetyByRole })` (also run at the end of `sizeStructure`) raises the steel
  ratio of each reinforced beam or slab so it rests at `safety` and stays at or below `redundancy` after losing any part of `redundancyRoles`
  (at most 4%, NBR 6118 17.3.5.2.4); plain concrete stays plain. `buildFrame({ rebar })` declares beams at 1% and slabs at 0.5% (`false` for
  plain concrete).

### Soil and foundations

Give the spec a `soil` (a soil class id such as `clay_soft`, or `{ layers: [{ soil, thickness }, ...], surface?, footingWidth? }`) and its foundations
bear on the ground instead of being fixed. Without it nothing changes.

- **Soil classes** (`SOILS`, `soils.json`, extend with `soil.soils`): allowable footing pressure (NBR 6122 basic pressures: dense sand 400 kPa,
  stiff clay 200, medium clay 100, soft clay 30, rock 3000), SPT N, Young's modulus (Teixeira & Godoy) and Poisson's ratio.
- **Footings** (a `foundation` part: pad, strip or raft): a grid of springs with the subgrade modulus of a rigid footing `E / (B (1 - nu^2) Iw)`
  that give way at `safety` (3, NBR 6122) times the allowable pressure of the weakest layer within two widths below. Structural parts resting on a
  foundation tagged `terrain` get a footing at least 0.6 m wide each.
- **Piles** (`structure.pile: { length, diameter, count?, method? }` on the cap): end bearing and skin friction by Décourt-Quaresma through the
  layers. `pileLength(profile, { load, diameter })` gives the shortest pile that carries a load with safety 2 (down to firm ground).
- **The object is a rigid body on those springs**, out of plumb by 1/200 (EN 1992-1-1) the weak way, with P-delta. It settles at once where the
  soil holds; where it yields it moves to the new equilibrium at `sinkRate`/`tiltRate` (game time), and with no stable equilibrium it keeps sinking
  and leaning until its centre of mass passes the edge of its foundations: it tips over (`settle` with `status: 'toppled'`, then a `collapse` of
  everything).
- `ObjectState.soil` has `settlement`, `tilt`, `direction`, `bearing` (weight over what the foundations carry), `edge`, `status` and `offset`
  (the settled pose relative to the host's). `ObjectState.position`/`rotation` include it; `setTransform` sets the host's pose under it. A `settle`
  event goes out when it moves (at most every 0.5 s) or changes status.
- Options (`soil`, `SOIL_DEFAULTS`): `soils`, `site`, `safety`, `pileSafety`, `rigidity`, `influence`, `imperfection`, `cells`, `sinkRate`,
  `tiltRate`, `footingWidth`, `pileElasticGPa`. `buildFrame({ footing, raft, piles, soil })` builds test frames on the ground.

## Wind and sway
Off unless `createDestruction({ wind })` is given. Pressure `q = 0.613 V^2` grows with height by the NBR 6123 profile (terrain I-V, class by size), times a drag
coefficient, per 3 m band. The lateral system is the walls (cantilever) plus columns and T-beams (shear frame); the result is in `ObjectState.wind` (`deflection`,
`drift` against `driftLimit` H/500, `overturn`, `frequency`, `lean`, `sway`, `peak`, `status`) and a `sway` event. A gust (Davenport spectrum) shakes the first mode;
a part with `damper` (tuned mass damper, Den Hartog) reduces it. `world.setWind({ speed, direction })` changes it in play; `sizeStructure({ wind })` sizes for it;
on soft soil the wind moment tilts the building. Options and defaults: `wind`, `WIND_DEFAULTS`, `WIND_TERRAIN`. Sources in `specs/001-migracao-entregas-dos-times/design/T10-estrutura-real.md` section 10.

## Walls: layers, stages, breach and reinforcement
A wall is one part that opts in with `layers`, `units`, `reinforcement` or `breach` (`PartSpec`, all optional; parts without them behave as before).
`assemblyPart(id, { id, width, height, position, structure? })` builds one from the eight built-in **assemblies** (`ASSEMBLIES`, data in
`src/data/assemblies.json`; add or replace with `registerAssembly`): `brick_wall_plastered` (0.09 m brick, 2 x 0.02 m plaster, 0.23 x 0.075 x 0.11 m
bricks in running bond), `concrete_block_wall` (0.39 x 0.19 x 0.14 m hollow blocks), `reinforced_concrete` (0.2 m, rebar every 0.18 m, 0.6 x 0.42 m
panels), `drywall`, `wood_frame_wall`, `log_wall`, `sheet_metal_shack`, `glass_pane`.

- **Layers and spall.** A bullet spends `penetration x thickness` of every coat still on the faces it crosses, plus the core's. The outermost coat at the
  impact comes off first (`spall` event, `area`), and a patch that spalled no longer stops anything: the same round that stops at fresh plaster can
  go through once it has come off. A coat only spalls once per patch. Blunt hits spall the coat too.
- **Stages** (`PartState.stage`, `stage` event). 0 intact; 1 at the first hole, crack or spall; 2 when through damage within 0.55 m adds up to
  `breach.area` (0.25 m²): the units around the hit come out as fragments the size of one unit (`stage.fragments`, laid in the assembly's bond), the part
  stays with an `opening` (shots and rays pass through it, its mass and capacity drop) and nothing is hidden; 3 when the part fractures or collapses.
  Through damage is the area of through holes plus, for blunt, slash and explosive damage, the volume the damage takes out (`damage / (hpPerKg x
  density)`) over the thickness it crosses, times `breach.blastFactor` (6) for blasts. An opening as wide as the part cuts it instead (a pilaster, a column):
  that is a fracture. So a 9 mm burst never leaves stage 1 on plastered brick (it does not even go through), a rifle never breaches reinforced
  concrete, a sledgehammer opens plastered brick after ~47 swings and a C4 or RPG opens reinforced concrete at once. The engine stays in joules: the
  game tunes energies, `breach: { radius, blastFactor }` and each assembly's `breach.area`.
- **Reinforced concrete.** At 0 hp the concrete crumbles (`fracture`, in panels when `units` is set) but the part does not go: it becomes its rebar cage
  (`PartState.stripped`, `expose` with the bars in world space, stage 3), still part of the structure with `capacity x residualCapacity` (default 0.15).
  A bare cage under load is overloaded in seconds (`overloadRate`), so the frame fails progressively: `expose`, `stress`, the cage is lost (`expose` with
  no bars), then the neighbours and the slab (`collapse`). Bullets pass through a cage. The `rebar` joints of a reinforced part are not worn by blows:
  only the cutting torch or a saw cuts them (or the cage giving way). A breach at stage 2 exposes only the bars inside the opening.
- **Holes stay on the pieces.** Every `fracture` and breach fragment carries `marks` (`FragmentMark`: point, normal and diameter in the fragment's own
  axes) for the holes that fell inside it, at most 12 per fragment.

## Blasts: shelter, fragment hits and confinement

All three are options, **off by default** (a blast then does exactly what it always did, goldens included). Set them for the world with
`createDestruction({ blast: { shelter: true, ... } })`, or per call: `world.explode(point, energy, radius, source, { shelter: true })`, or on the
explosive `Hit` (`hit.blast`, `hit.confinement`). A call overrides the world default (`shelter: false` turns it off). Every number below is an
option; the defaults are exported as `SHELTER_DEFAULTS`, `FRAGMENT_HIT_DEFAULTS` and `CONFINEMENT_DEFAULTS`. This is the kit's own model (no team
delivery has it), approved by the owner on 2026-10-24.

**Shelter.** For each part (or impl) in range, a segment from the centre to the nearest point of the target is cut against every other part of
every object, skipping parts already lost and the target itself. A part crossed along a path `p` lets through `exp(-r / k)` of the energy, with
`r = hpPerKg * density * p * damageScale.shelter` (the hit points of the slab it crosses, per m²) and `k = 2800`. The energy that reaches the target
is `E * product(t_i)`, and it is used for both the damage and the push. Parts are served from the nearest to the farthest, so a wall takes the blast
(damage, dents, maybe breaking) before what is behind it. A blocker the same blast destroys or breaches lets `brokenTransmission` (0.5) of what it
held back go through: `t' = t + (1 - t) * 0.5`. An opening (a breach, a bare rebar cage) from before the blast lets everything through. Impls
(characters, animals) get one hit with the energy-weighted mean of the share that reaches their parts, and `Hit.shelter` carries it. Impls do not
shelter anything (they have no material).

| Blocker | Path | Lets through |
|---|---|---|
| glass pane | 6 mm | 83% (`damageScale.shelter: 3` in the material) |
| wooden door (softwood) | 4 cm | 53% |
| brick wall | 20 cm | 19% |
| reinforced concrete column | 30 cm | 3% |

**Fragment hits.** The fragments of a part the blast fractures or breaches (the `fracture` and `stage` events) become hits on the first part or impl
along their flight, in order of energy, at most `max` (24) per blast. Each is a `blunt` hit (or `ballistic` with its mass in grams and a calibre from
its size) of `energyFactor * m * v² / 2` (0.5), thrown up to `min(range 6 m, speed * flightTime 0.4 s)` within a seeded `spread` (10°) of its
direction. With `shelter` on, a fragment of a blocker whose line to a target is within `aim` (40°) of its flight goes for that target. The flights
depend only on the world seed, the blast and the fragment, never on what the world did before. Fragments of what a fragment breaks are not thrown
again. Events: `fragment_hit` (before the target's own events).

**Confinement.** `confinement: true` shoots `rays` (26) seeded rays from the centre as far as `radius * reach` (1.5) against the world's parts (impls
do not count; open doors, windows and breaches are absent parts). With `c` the share of rays that hit and `d` their mean distance:
`multiplier = min(max, 1 + gain * c^power * clamp(radius / d, 0, 2))` with `gain` 1.5, `power` 2, `max` 3. The energy of the whole blast is
multiplied. Open ground gives 1, a closed room of 6 m about 3, the same room with one wall missing about 2. A number (`confinement: 2.5`, or
`Hit.confinement`) is the multiplier itself, for a host that knows the room volume.

**What comes back.** `HitResult.blast = { shelter, parts?, confinement, fragmentHits }` per target (`shelter` is the most exposed part's share),
and one `blast` event per blast (`energy` after confinement, `shelter` per target, `fragmentHits`). `@adatechnology/game-destruction-three` takes
the results for the push on pieces: `renderer.explode(point, energy, radius, { report: results })`.

### Bullets and blasts against beams and columns

`tests/beams-and-columns.test.ts` fires the loads of the ammo table of `@adatechnology/game-weapons` against a reinforced concrete column and beam, a steel
I-beam, a hardwood beam and a brick pillar (it prints the results table with `PRINT_TABLE=1`). Two corrections came out of it:

- `Hit.penetration` (the 6th argument of `shoot` is `{ penetration }` or a bare piercing factor): millimetres the round goes through, by material class
  (`steel`, `concrete`, `brick`, `wood`). The weapons put it in the `Hit` (`shotToHit` / `shotExtras` of the contracts); the world reads no calibre names. The
  material says which entry measures it (`MaterialDef.penetrationClass`, default its id) and how much more or less it resists
  (`penetrationScale`: structural steel 1.3 against the RHA of the tables, softwood 1.5 against hardwood, aluminium 3 against steel). The round goes through when its
  millimetres times that scale exceed the thickness of the part (slant counts); a material with no entry falls back to the energy rule, where `Hit.piercing`
  (default 1) multiplies the energy against hard materials. M80 ball does not pierce an 8.5 mm structural flange, M993 AP does, and the .50 BMG M33 ball
  pierces a 30 cm reinforced column. `PIERCING_BY_KIND`, `PIERCING_BY_CALIBER` and `piercingOf` are gone: the table lives in game-weapons.
- Blast reach of a breach (no option, it is the physics): a blast only opens a breach within 0.12 m per cube root of kilojoule of the part
  (`BREACH_BLAST_REACH`). A hand grenade (200 kJ) at 1 m does not cut a reinforced column in two (at 0.2 m it strips it). Farther away the blast still
  damages, dents and cracks. The old `breach.blastReach` option (default `Infinity`) is gone: it was a second path for a correction.

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
`ignite`, `extinguish`, `burnout`, `melt`, `drip`, `leak`, `explode`, `primed`, `stress`, `collapse`, `spall`, `stage`, `expose`, `destroyed`. All points are in world space. Subscribe with
`world.on(type | '*', fn)` or the `onEvent` option; `hit` and `update` also return their events.

## Determinism and LAN

Every random choice comes from the world seed (mulberry32), never `Math.random`, and the generator state is part of the snapshot. A LAN host can
run the world and send only the inputs (hits, `update(dt)` calls), or the events. `serialize()` / `load()` give a plain JSON round trip: a loaded
world continues with the same events as the original. The loading world must use the same materials.

## API

`createDestruction(options)` returns a `DestructionWorld`: `add`, `remove`, `has`, `ids`, `setTransform`, `splitGroup`, `hit`, `hitPart`, `explode`,
`raycast`, `shoot`, `disassemble`, `workableJoints`, `nearestJoint`, `extinguish`, `setLiters`, `update`, `state`, `part`, `reset`, `on`,
`register`, `serialize`, `load`, `time`. `explode(point, energy, radius, source?, blastOptions?)`; `shoot(origin, direction, energy, caliber, source?, round?)` (`round`: `Hit.penetration`, `piercing`, `incendiary`, `tracer`, `ignition` or a bare piercing factor). `state()` and `part()` return live views; do not mutate them.

Also exported: `SHELTER_DEFAULTS`, `FRAGMENT_HIT_DEFAULTS`, `CONFINEMENT_DEFAULTS`, `buildFrame`, `sizeStructure`, `sizeRebar`, `FLEXURE_DEFAULTS`, `MASONRY_DEFAULTS`, `bearingWallThickness`, `SOILS`, `SOIL_DEFAULTS`, `pileCapacity`, `pileLength`, `pileStiffness`, `footingSoil`, `subgradeModulus`, `solveFoundation`, `assemblyPart`, `registerAssembly`, `getAssembly`, `ASSEMBLIES`, `assemblyDepth`, `partCapacity`, `checkDestructible`, `checkHit`, `IMPACT_CONTRACT`, `MATERIALS`, `JOINT_DEFAULTS`, `JOINT_BY_MATERIALS`, `inferJoints`, `guessMaterial`, `partVolume`, `partMass`, `partThickness`, the
helpers `vec`, `quat`, `quatFromEuler`, `rotateVec`, `toLocal`, `toWorld`, the locale (`locales`, `resolveStrings`, `DestructionStrings`) and all types.

The locale table has `en` and `pt-BR` strings for material names, part statuses, joint kinds, tools, damage types, event labels and fracture styles:
`resolveStrings('pt-BR').materialNames.glass === 'vidro'`. Unknown locales fall back to `en`.

## Assemblies by instance

`createAssemblies({ packs, patch, remove })` makes a set of assemblies of its own: the built-in ones plus `packs`. `packs` is a list of lists of `AssemblyDef` (`[[wallDef, doorDef], [extraDef]]`); a def with the id of a built-in replaces it.
`patch` merges fields by assembly id, `remove` lists ids to take out. The global `ASSEMBLIES`, `registerAssembly` and the rest are deprecated delegates of `defaultAssemblies()`.

## Português

Modelo de destruição independente de engine. Um objeto é um conjunto de peças (caixa, cilindro ou esfera com um material) unidas por juntas. O
material decide o efeito: o aço amassa e fura, o vidro trinca e estilhaça, a madeira lasca e vira cinza, o concreto esfarela, o alumínio e o
plástico derretem e pingam. As juntas cedem com impacto, quando a peça é destruída ou quando se usa a ferramenta certa (chave de fenda para
parafuso, chave inglesa para porca e parafuso, maçarico para solda). O mundo devolve tudo como eventos para o renderizador desenhar. É
determinístico (semente fixa) e serializável, então um host de LAN pode rodar o mundo e enviar só as entradas. Os nomes em português
(materiais, ferramentas, juntas, eventos) estão em `resolveStrings('pt-BR')`.

Estrutura real: viga e laje de concreto com `structure.rebar` dobram. Na explosão a face tracionada racha e o aço segura; sem aço a peça parte; com o aço escoado até 10° de giro ela dobra e cai inteira (`structure.flexure`). Paredes e pilares de alvenaria resistem com a resistência real do tijolo e a redução por esbeltez da NBR 16868-1, então a parede portante do térreo esmaga quando há andares demais em cima (`bearingWallThickness` dá a espessura de projeto). Valores e fontes em `specs/001-migracao-entregas-dos-times/design/T10-estrutura-real.md`.

Solo e fundação: com `soil` na spec a fundação se apoia no solo (classes com a tensão admissível da NBR 6122). Prédio pesado em sapata sobre argila mole afunda e tomba; em estacas até o chão firme (`structure.pile`, Décourt-Quaresma, `pileLength`) fica de pé; casa em radier em solo firme não sente.

Explosões: `blast.shelter` (paredes e portas entre a explosão e o alvo ficam com a sua parte: tijolo de 20 cm deixa passar ~19%, porta de madeira ~53%, vidro ~83%; a parede que quebra na mesma explosão deixa passar metade do que segurou), `blast.fragmentHits` (os pedaços do que quebra viram golpes de baixa energia no que está atrás) e `blast.confinement` (pressão num ambiente fechado, de 1 a 3 vezes). Tudo desligado por padrão, por opção do mundo ou da chamada, com os números em `SHELTER_DEFAULTS`, `FRAGMENT_HIT_DEFAULTS` e `CONFINEMENT_DEFAULTS`.
