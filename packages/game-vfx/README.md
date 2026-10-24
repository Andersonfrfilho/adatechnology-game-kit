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
