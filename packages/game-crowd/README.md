# @adatechnology/game-crowd

Any crowd as a struct of arrays, pure and seeded: a horde, but also a street of people or a herd. Relevance bands with hysteresis, perception by sight,
hearing and smell, a sliced flow field, a spatial hash and separation, six attack slots, chain alerts, doors that take blows, piles of bodies against
walls, special moves as type traits, corpses, a blood trail, the population and migrations. No three.js, no audio, no game content: it emits events
(`sound`, `effect`, `message`, `kill`...) and the game plays, draws and shows them.

It is a literal port of the team game's horde (`jogo.js` G 66714-67430: `hordeUpdate` and everything it calls, with the doors of G 63796-64050). Every
number is in `src/data/defaults.json` with its source line, and the golden `game-crowd.json` (8 scripted scenes of the game code in `node:vm`, recorded by
`tools/characters-catalog`) is replayed frame by frame by the tests.

- **The pack is data.** Types (health, speeds, damage, bite, multipliers, perception, size), ages, outfits, segments and the clothes palette come in
  `pack`. `@adatechnology/game-characters-undead` gives the undead one (`undeadCrowdPack()`, the game's 13 types); any game writes its own.
- **Special moves are traits** of a type (`vaultsLow`, `pounce`, `heavySwing`, `soundSeeker`, `caller`, `burns`, `waterWeak`, `submerged`, `ambush`,
  `burst`, `eatsCorpses`, `tracker`...). A type without traits only walks, hears, sees and hits. `plugins` add moves without touching the core.
- **The normal world comes first.** With no target (`target: null`) nobody chases: agents wander and pause. The target is anything with the
  `CrowdTarget` shape; `game-player`'s `Player` is one as it is.
- **The world** is a `NavGrid` (`createNavGrid`, the game's 0.5 m grid with occupancy codes and heights) and `water(x, z)`; doors are `createDoors`.
- **Every draw is in the game's order** on the stream you pass (`random`); the flow field's time budget reads `flow.clock` (pass `() => 0` to finish
  each field in one frame, as the golden does).

## Install

```sh
pnpm add @adatechnology/game-crowd
```

Browser without a bundler (the global is `GameCrowd`):

```html
<script src="https://unpkg.com/@adatechnology/game-crowd/dist/index.global.js"></script>
```

## Usage

```ts
import { createCrowd, createNavGrid } from '@adatechnology/game-crowd'
import { undeadCrowdPack } from '@adatechnology/game-characters-undead'

const grid = createNavGrid() // 768 m, 0.5 m cells, a solid border
grid.fillRect(x0, z0, x1, z1, 1, 3) // a wall 3 m tall
const crowd = createCrowd({ pack: undeadCrowdPack(), seed: 7, grid, water: (x, z) => pool.contains(x, z) })
crowd.doors.add(0, -2.1, 'x', 1.2)
crowd.on('sound', (s) => host.audio?.play({ sound: s.sound, volume: s.volume, position: s.position }))
crowd.on('effect', (e) => host.effects?.play({ effect: e.effect, point: e.point }))
crowd.on('message', ({ id, seconds }) => hud.show(id, seconds))

crowd.target = player // game-player's Player, or { state, grab, hurt, knock, release }
player.setWorld({ ...world, crowd: crowd.asPlayerCrowd() })
player.on('noise', ({ x, z, radius }) => crowd.emitNoise(x, z, radius))

// every frame, in the game's order
crowd.updateTrail(dt)
crowd.update(dt, { nightFactor, viewYaw: camera.yaw })
crowd.updatePopulation(dt, { x: camera.x, z: camera.z, yaw: camera.yaw, far: fog.far }, { target: 1200, migration })
crowd.updateCorpses(dt)

crowd.damage(i, { region: 0, amount: 35, distance: 12, caliber: { id: '9x19', class: 'pistol', skull: 1 } })
crowd.store.x[i] // the struct of arrays: x, z, y, yaw, state, hp, missing, band, variant...
```

## Civilians, herds, flocks and the region model

```ts
import { HERD_ROLES, bindInfection, carrionCenter, createCivilians, createFlock, createHerd } from '@adatechnology/game-crowd'

// people with a routine by the hour; agents that are closer to them than to the target hunt them
const civilians = createCivilians(crowd, { people: [{ id: 'ana', home: 'house_2', routine: [[19, 'market']] }], buildings, hour: () => clock.hour })
civilians.on('bitten', ({ id, near }) => diary(id, near))
civilians.join('ana') // follows the target
civilians.flee('ana', path) // leaves; `gone` at the end

// animals: wander, rest, flee, call; their calls are noises the crowd hears
const herd = createHerd(crowd, { blocked: insideABuilding })
herd.add({ ...HERD_ROLES.cow, species: 'cow', x, z, walkHz: cow.walkHz, runHz: cow.runHz, size: quadrupedLayout(cow.body).size })
const vultures = createFlock({ count: 3, mode: 'carrion' })
// every frame, after crowd.updateTrail and before crowd.update
civilians.update(dt)
herd.update(dt)
vultures.update(herd.time, dt, carrionCenter(crowd.corpses.entries.map((e) => e.data), carcass), [camera.x, camera.z])

// the region model of game-infection: numbers become agents near the player and go back when far
const binding = bindInfection(crowd, infection, { place: (region, seed, k) => spotIn(region, seed, k), civilians, regionOf })
binding.materialize('downtown', 40)
binding.giveBack()
```

Civilians are a literal port of the game's survivors on the block (`jogo.js` G 69960-70175: `pontos`, `rota`, `npcZombies`, `zChaseNpc`, `npcMorre`,
`npcVira`, `npcMove`, `npcUpdate`) without their names, lines, radio and diary; the herd of `bichoLivre`, `zumbiPerto` and `bichosUpdate` (G 66601-66700)
without the rig; the vultures of G 66700-66708 and the live map's ring of birds of the Bancada de Hordas (G 53609-53615). Two goldens replay them
with the horde: `game-crowd-civilians.json` (3 scenes) and `game-crowd-herd.json`.

## Physics: a dense horde and the chain of a blast

`CrowdOptions.physics` is off by default and then the horde is the game's, bit for bit (the team goldens run with it off). `CROWD_PHYSICS_DEFAULTS` turns everything on:

```ts
const crowd = createCrowd({ pack, seed, physics: { ...CROWD_PHYSICS_DEFAULTS, playerPressure: { enabled: true, knockThreshold: 1500, crushDamagePerSecond: 6 } } })
// fixed steps only: the same seed gives the same result at 30, 60 and 144 fps
crowd.update(1 / 60, { target, bandCentre: [x, z] })
crowd.blast({ point: [x, y, z], energy: 200000, radius: 15, lethalRadius: 5 }) // resolved at the start of the next step, in one pass over the agents
crowd.stats.physics // falls by cause, fallsBeyondBlast, climbers, moundMax, thrownPeak, blastChecks...
```

- **Contact:** inelastic impulses between bodies (symmetric Gauss-Seidel, so a low index has no advantage) and a position correction by the mean of what each agent was asked to move; it never adds energy.
- **Pressure:** a field apart from the contact that moves one hop per fixed step, so a file of N agents pushing on a wall gives its front `N` times the drive (`design-chain-horde.md` section 4.5).
- **Balance:** standing, staggering, fallen, getting up and thrown, by pressure over a critical value of the body (`CrowdType.balance` and the personality), shoves, trips, landings and collapses.
- **Mound:** lying bodies are a height per cell (integer millimetres) that others climb, trample and bring down when the base goes.
- **Thrown bodies:** a pool of 32 simulated here (`crowd.thrown`) and only drawn by the renderer; `thrown.priority` is `'mixed'` (half the slots to the fastest, half to the nearest to the band centre), `'fastest'` or `'nearest'`.
- **Personality:** speed, reaction, stability, trip, drive, cadence, aggression, gait and idle from the identity of each agent, never from the shared random stream.
- **Far band (R1):** no pairs. Every 12th step a coarse grid of 2 m counts the standing walkers of band R1 per cell; above 4 bodies the wanted speed is `4 / bodies` and the field is `(bodies − 4) · 150` N, which the same balance rule reads (`physics.density`, needs `balance`). A body that falls there lies without entering the mound, and joins it when it comes into R0.
- **Player pressure:** `playerPressure` reports the pressure of the horde on the target through `knock` and `hurt` (off in the package; a game turns it on).

### The contact and the pressure in a worker

`physics.worker` is `'off'` by default (the step runs where it always did). `'auto'` moves the contact and the pressure to a worker when one can be made and stays in the step when it cannot; `'on'` throws instead of staying.
The worker is **one step behind**: it is handed the state at the end of step *k*, and step *k + 1* (`workerLatency: 1`, default) or *k + 2* (`workerLatency: 2`) adds what it computed as deltas of position, push and velocity and replaces the pressure field. With the same inputs per step the answer is the same whichever thread computed it: `inline` (the same kernel on the calling thread) is the reference, and the tests compare it with a worker byte for byte. Balance, mound, thrown bodies and blasts stay on the main thread.

```ts
const crowd = createCrowd({ pack, seed, physics: { ...CROWD_PHYSICS_DEFAULTS, worker: 'auto', workerLatency: 2 } })
// ...
crowd.dispose() // stops the worker
```

- `workerTransport: 'shared'` (default where `SharedArrayBuffer` is usable): frame in a `SharedArrayBuffer`, control word with `Atomics`. The main thread waits for the answer, so the run is reproducible. A browser needs the page **cross-origin isolated**: serve it with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`), and every cross-origin sub-resource with `Cross-Origin-Resource-Policy` or CORS. `crossOriginIsolated` is then `true`. Node has `SharedArrayBuffer` always.
- `workerTransport: 'transfer'`: without isolation; the frame goes by `postMessage` with its buffer transferred. The main thread cannot wait for an event, so it applies the answer when it has arrived and runs without it otherwise (the contact then lags more): it is not reproducible. `'auto'` picks it when the page is not isolated.
- `workerFactory`: the default makes a module worker from `physics-worker.js`, which sits next to `index.js` in `dist`, with `new Worker(new URL('./physics-worker.js', import.meta.url), { type: 'module' })` (Vite, webpack 5 and esbuild resolve it); the `index.global.js` build has no `import.meta`, so there give a `workerFactory`. A host that bundles its own worker (or runs node `worker_threads`) gives the factory and calls `attachPhysicsWorker(port)` inside the worker; `tests/fixtures/node-physics-worker.mjs` is a node example.
- The frame copies the grid occupancy every step (1 byte per cell, 2.4 MB for the default 768 m grid): a `NavGrid` no bigger than the playable area keeps that copy small.

Measured with `bench/dense-update.mjs` (node, 2000 agents pressed against a wall, all in band R0, `WORKER=shared LATENCY=2`): `crowd.update` on the main thread goes from 3.0 ms to 1.7 to 1.9 ms mean; with one step of latency the main thread waits for the worker for a third of its step, so it gains little. See `specs/005-camadas-e-quadro/evidence.md`, row T4b.perf.

`bench/dense-update.mjs` measures `crowd.update` with 1000 and 2000 agents pressed against a wall, with and without the physics.

## What is not here yet

The drawing and the test area are in `@adatechnology/game-crowd-three`. The game's multi-floor houses (`ANDARES`) and the roof (`ROOF`) are not ported: the crowd walks one
ground grid (`floor` is kept on each agent for a game that adds floors).
