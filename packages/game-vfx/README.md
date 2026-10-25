# @adatechnology/game-vfx

Visual effects with no renderer, deterministic and testable in Node. It knows nothing about any game: the host gives it a camera position and a clock,
calls `update(dt)`, and reads plain pools (`puffs`, `sparks`, `glows`, `chunks`, `shocks`, `rings`, lights, marks) that a renderer draws (see
[`@adatechnology/game-vfx-three`](../game-vfx-three)).

It is a literal port of the Explosion Lab of the effects team: the layer compositor (`blast`) and the simulation loops, with the same draws from the
same seeded stream in the same order, so the same seed gives the same explosion.

- **Layers of an explosion**, in the Lab's order: flash and light, fireball that cools into smoke, the explosion's own smoke, shock wave (it pushes the
  smoke it meets), low dust, shrapnel and embers, glowing debris, then marks on the ground (scorch, crater with a dented ground field and rim rocks),
  mushroom cloud, lingering fires. Six layers can be turned off one by one (`flash`, `fire`, `shock`, `smoke`, `shrapnel`, `mark`).
- **Pools** (`OrderedPool`): live records in the order they were added, reused instead of allocated, compacted in place. A full pool drops the oldest
  record (chunks drop a resting one first).
- **Random** (`lehmer`, `lcg`, `streamFor`): `randomMode: 'per_event'` (default) gives each explosion a stream of its own seed, so a LAN client repeats the
  visual from a few bytes whatever else is playing; `'shared'` uses one stream for everything, like the Lab page (the goldens).
- **LOD and cap**: `LOD_GAME` (15 / 40 / 80 m, scales 1 / .5 / .2 / .1, default) and `LOD_LAB`; the game's area cap (the 7th explosion within 40 m in 4 s
  is made at 0.3, `AREA_CAP_GAME`).
- **Screen** (`screen()`): shake, flash (the flash grenade blinds only who is near), and the Workshop's white, red, sides, chroma, desaturation, gas and beat,
  with the same decays.
- **Budgets**: `PROFILES` (`high` bench and goldens, `medium` game default, `low`), `EVENT_BUDGET` (400 particles, 40 debris, 4 + 2 lights) and
  `estimateCost(def)` (the number of the Lab's effect sheet).
- **Side requests** (`onRequest`): what an effect cannot do alone. `crater` (dig a ground you own), `blast_front` (glass, characters, with `speed` 340 m/s so
  the host delays by distance) and `ignite` (characters inside the radius catch fire).

```ts
import { createGroundField, createVfx, LOD_LAB } from '@adatechnology/game-vfx'

const vfx = createVfx({
  seed: 42,
  profile: 'high',
  lod: LOD_LAB,
  ground: createGroundField(), // optional: craters dig it, bouncing things read it
  explosions: myExplosions, // Record<string, ExplosionDef>; the 16 of the Lab arrive with the catalogue
  onRequest: (request) => host.handle(request),
})
vfx.setCamera([10, 6.5, 14])
vfx.explosion('m67', [0, 0.1, 0], { seed: 7 }) // or { direction: [1, 0, 0], scale: 2, delay: 0.5 }
vfx.fire({ point: [2, 0, 0], radius: 1.4, life: 7 })

// every frame
vfx.update(dt)
render(vfx.pools(), vfx.screen())
```

`explosion` answers a handle (or `null` for an unknown id), `stop(handle)` ends a fire, `clear()` takes everything away and restarts the clock, `stats()`
reports what is alive, what the last explosion made, the scale it was made at and the seconds since.


## Workshop recipes, sprites and event effects

`vfx.play(id, point, { direction?, normal?, seed?, param? })` plays one of the **39 recipes of the Workshop of VFX** (the 36 of the first pass and the weather ones: `rain_and_puddles` three intensities, `fog_and_ash`, `headlights_in_rain`; the rain lives in `workshop().rain`, a `RainField` that `game-weather-three` also drives) (blood by infection age, headshot,
dismemberment, bloater cloud, scream, muzzle flashes by weapon, impact by material, glass, doors, collapses, fires, cars, the screen effects) into the
Workshop pools (`vfx.workshop()`: additive and normal sprites, streaks, physics debris, decals, rings, flash and fire lights, screen state). The recipes
are **data** (`WORKSHOP_EFFECTS`, `EffectDef`: a small language of expressions and steps) that a runner executes in the page's own order of random draws,
so the goldens (`tests/workshop-golden.test.ts`, 162 assertions over 54 runs) replay the recording of the page. `param` picks the variant of a recipe by
index or id (`'fresh'`, `'ak'`, `'concrete'`); `anchor` and `heading` of the recipe place and turn it at `point` and `direction`; `seed` makes it
repeatable on a LAN client. `patchEffects(base, changes)` tunes, adds or removes recipes like `patchExplosions` does.

The Workshop also keeps **solids**, not only sprites: the `mesh` step spawns a `MeshSpawn` (cone, open cone, sphere or icosahedron with its segments, additive or lit
material, a place and a turn inside a group, a scale ramp, growth, drag, gravity, spin and a fading opacity) into `workshop().meshes` (`MeshPool`), aged each frame in
the order of the gallery's `Particles`. `play` can also take the thing's whole turn (`orientation`, a unit quaternion, pitch and roll included, instead of the turn
about the vertical axis `direction` gives) and named numbers (`values`, read with `variable(name)`). `VIEWMODEL_EFFECTS` use all three: the first-person muzzle flash
(`viewmodel_muzzle_flash`: an open cone, four small cones and a core for 55 ms, a light that holds, six spheres of smoke), `weapon_smoke_puff`, `launcher_backblast` and
`flame_jet`, written in the weapon's own axes (x along the barrel) with the Arsenal gallery's numbers and the order it drew them in.

`vfx.burst(kind, point, normal, count, speed?)` and `vfx.spawn(kind, point, velocity)` are the **sprite kinds** that destruction, fluids and weapons share
(debris, sparks, ash, steam, drips, leaks...: `data/sprite-kinds.json`, `patchSpriteKinds`), with `onLand(owner, ...)` to hear where a drop touched the ground.

`effectForEvent(event)` maps the destruction events to effects (`data/event-effects.json`): `spall` plays `impact_<material>`, the stages `stage_crack`,
`breach_dust` and `collapse_dust`, `expose` `rebar_expose`, a fracture of glass `glass_burst`; `muzzle_*` and `casing_*` are the weapon slices. `GAME_EFFECTS`
is the recipes plus these, what a world plays by default. Texts of every recipe (name, cost, when, look, budget, network) are in `locales` (`en`, `pt-BR`).

## Vehicle effects

`VEHICLE_EFFECTS` write the Garagem's recipes around a car: `vehicle_fire` and `vehicle_exhaust` (`engine_smoke`), `vehicle_leak` and `vehicle_leak_ignited` (`fuel_leak`). A normal bullet through a tank only leaks, so
`vehicle_leak` is the page's pool and drips without the fire and the explosion (`FUEL_LEAK_ONLY`: the same `decal` and `emit` steps); `vehicle_leak_ignited` is the whole sequence (the spark, the fire running along
the pool to the tank and the blast at 7.2 s), played when the leak catches fire.

## Install

```sh
pnpm add @adatechnology/game-vfx
```

Browser without a bundler (the global is `GameVfx`):

```html
<script src="https://unpkg.com/@adatechnology/game-vfx/dist/index.global.js"></script>
<script>
  const vfx = GameVfx.createVfx({ seed: 1 })
</script>
```

## Port invariants

Each one has a test: pools iterate in insertion order and compact in place; every puff draws its seed even when the caller gives one; chunks draw
rotation and spin first and a hot one adds a halo drawn after; due timers run from the last added to the first; colours are converted once, at spawn;
no pool grows past its profile. The goldens (`tests/team-golden.test.ts`) replay the Lab's 16 scenes against a recording of the page.
